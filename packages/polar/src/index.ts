/**
 * @module @pkg/polar
 *
 * Instance-based Polar billing client shared across the SaaS apps. Wraps the
 * official [`@polar-sh/sdk`](https://docs.polar.sh/api) so every app talks to
 * Polar through one type-safe, dependency-injectable surface: customers,
 * subscriptions, products, discounts, orders, hosted checkout/portal sessions,
 * usage-event ingestion, and Standard-Webhooks signature verification/parsing.
 *
 * The client is constructed from configuration (`{ accessToken }`) rather than
 * reading environment variables itself, so it stays compatible with
 * `@pkg/service-container` (ADR-008) and is trivial to test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@pkg/result";
import type { Checkout } from "@polar-sh/sdk/models/components/checkout.js";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { CustomerSession } from "@polar-sh/sdk/models/components/customersession.js";
import type { Discount } from "@polar-sh/sdk/models/components/discount.js";
import type { EventCreateCustomer } from "@polar-sh/sdk/models/components/eventcreatecustomer.js";
import type { EventCreateExternalCustomer } from "@polar-sh/sdk/models/components/eventcreateexternalcustomer.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";

import { failure, success } from "@pkg/result";
import { Polar } from "@polar-sh/sdk";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks.js";

export { PolarError, WebhookVerificationError };
export type { Checkout, Customer, CustomerSession, Discount, Order, Product, Subscription };

/**
 * Any webhook event the SDK can model, as returned by `validateEvent`. It is a
 * discriminated union on `type`, so callers can narrow with
 * `event.type === "order.paid"` and get a fully typed payload.
 */
export type PolarWebhookEvent = ReturnType<typeof validateEvent>;

/**
 * The subscription statuses Polar itself counts as active, i.e. the ones its
 * `subscriptions.list({ active: true })` filter returns. Exported because an app that
 * stores subscription state of its own has to answer "is this active?" against its own
 * copy, and the answer has to be the same one Polar would give — otherwise the local
 * projection and the API disagree and a reconciliation pass repairs rows forever.
 *
 * `canceled` is deliberately absent: Polar keeps a cancelled-at-period-end subscription
 * at `active` until the period actually ends, so entitlement follows the status and not
 * the `subscription.canceled` event.
 */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

/**
 * Whether a Polar subscription status grants entitlement. Takes a plain `string` so it
 * can be asked of a status read back out of a database as well as of a live
 * subscription — {@link ACTIVE_SUBSCRIPTION_STATUSES} is the definition either way.
 *
 * @param status - A Polar subscription status string.
 * @returns `true` when Polar would count the subscription as active.
 */
export function isActiveSubscriptionStatus(status: string): boolean {
	return ACTIVE_SUBSCRIPTION_STATUSES.some((active) => active === status);
}

/**
 * The subscription carried by a webhook event, or `null` for every event that carries
 * something else (an order, a checkout, a benefit grant…).
 *
 * This is the narrowing half of {@link PolarClient.parseWebhook}: the parsed event is a
 * union of ~35 payload types discriminated on `type`, and a caller that only cares about
 * subscription state would otherwise repeat the list of subscription event types itself.
 * Which event types carry a `Subscription` is a fact about Polar, so it lives here.
 *
 * @param event - A verified webhook event from {@link PolarClient.parseWebhook}.
 * @returns The event's subscription, or `null` when it isn't a subscription event.
 *
 * @example
 * ```ts
 * let result = polar.parseWebhook(request, body, secret);
 * if (isFailure(result)) return new Response(result.error.message, { status: 400 });
 * let subscription = subscriptionFromEvent(result.data);
 * if (!subscription) return new Response(null, { status: 200 });
 * ```
 */
export function subscriptionFromEvent(event: PolarWebhookEvent): Subscription | null {
	switch (event.type) {
		case "subscription.created":
		case "subscription.updated":
		case "subscription.active":
		case "subscription.canceled":
		case "subscription.uncanceled":
		case "subscription.past_due":
		case "subscription.revoked":
			return event.data;
		default:
			return null;
	}
}

/**
 * Options accepted by the {@link PolarClient} constructor.
 */
export interface PolarClientOptions {
	/** Polar API access token (personal or organization). Sent as a Bearer token. */
	accessToken: string;
}

/**
 * Most events Polar accepts in one ingestion request.
 *
 * Polar documents no batch limit, so this is a conservative self-imposed one:
 * {@link PolarClient.ingestEvents} splits a larger array across requests rather than
 * discovering the real ceiling as a rejected body. Safe to resend a whole chunk after a
 * partial failure as long as every event carries an `externalId`, which Polar
 * deduplicates on.
 */
const INGEST_CHUNK_SIZE = 100;

/**
 * A cost to attach to an ingested event, read by Polar's Cost Insights and Metrics API
 * and combined with the customer's revenue into cost, gross profit and LTV per customer.
 *
 * `amount` is **cents** — `100` is one dollar — and a **string** rather than a number on
 * purpose: JS renders any float below 1e-6 in exponential notation
 * (`(1e-7).toString() === "1e-7"`), which is not a number Polar's parser accepts, and a
 * per-unit infrastructure cost is routinely that small. Format it with `toFixed`.
 */
export interface EventCost {
	/** The amount in **cents**, as a plain decimal string (e.g. `"0.003476700"`). */
	amount: string;
	/** The currency; Polar supports only `usd`. */
	currency: "usd";
}

/**
 * A single usage event to ingest into Polar's events API.
 *
 * Exactly one of `customerId` and `externalCustomerId` identifies the customer. Both are
 * optional here because either satisfies Polar, and an app that keys customers by its own
 * id (an OIDC subject, a tenant id) never has to resolve the Polar-internal one first.
 *
 * @see https://docs.polar.sh/api-reference/events/ingest
 */
export interface IngestEvent {
	/** The Polar customer the event belongs to. Mutually exclusive with `externalCustomerId`. */
	customerId?: string;
	/** The app-owned external id of the customer. Mutually exclusive with `customerId`. */
	externalCustomerId?: string;
	/** The event name, matching a configured meter (e.g. `"mau"`, `"page_views"`). */
	name: string;
	/** Arbitrary metadata stored with the event; used by meters for aggregation. */
	metadata?: Record<string, string | number | boolean>;
	/**
	 * Cost to attach to this event for Polar Cost Insights, sent as `metadata._cost`.
	 * Kept out of `metadata` in this interface because the nesting is Polar's wire
	 * convention rather than something a caller should have to know.
	 */
	cost?: EventCost;
	/** When the event happened. Defaults to Polar's ingestion time when omitted. */
	timestamp?: Date;
	/**
	 * A caller-supplied unique id for this event, forwarded to Polar as `external_id`.
	 * Polar deduplicates on it, so re-sending an event with the same `externalId` is a
	 * no-op — the safe way to make an at-most-once reporting cron idempotent across a
	 * partial failure (the event was accepted but the local "reported" flag did not
	 * persist). Omit for events that need no deduplication.
	 */
	externalId?: string;
}

/**
 * Fields that may be updated on an existing Polar customer.
 */
export interface CustomerUpdate {
	/** New display name for the customer. */
	name?: string;
	/** Metadata to merge onto the customer record. */
	metadata?: Record<string, string>;
	/** External (app-owned) id to link to this customer. */
	externalId?: string;
}

/**
 * The result of creating a checkout or customer-portal session.
 */
export interface SessionResult {
	/** The Polar-hosted URL to redirect the customer to. */
	url: string;
}

/**
 * The result of {@link PolarClient.createCheckout}. Adds the checkout `id` on top
 * of {@link SessionResult} so callers can log it and correlate it with the webhook
 * events the checkout later produces.
 */
export interface CheckoutSessionResult extends SessionResult {
	/** The Polar checkout id. */
	id: string;
}

/**
 * Options accepted by {@link PolarClient.createCheckout}, covering the checkout
 * fields {@link PolarClient.createCheckoutSession} cannot express (`customerEmail`,
 * `discountId`, `allowDiscountCodes`) and making `successUrl` optional for products
 * that should land on Polar's own confirmation page.
 */
export interface CheckoutSessionOptions {
	/** The Polar product ID to sell; sent as a single-product checkout. */
	productId: string;
	/** The Polar customer ID the checkout is for; omit to let Polar create one. */
	customerId?: string;
	/**
	 * Email to pre-fill on the hosted checkout. `null` is accepted (and sent as
	 * omitted) so callers can forward an optional query param without mapping it.
	 */
	customerEmail?: string | null;
	/** A Polar discount ID to apply automatically to the checkout. */
	discountId?: string;
	/** Whether the customer may type a discount code during checkout. */
	allowDiscountCodes?: boolean;
	/** Absolute URL to redirect to after a successful checkout. */
	successUrl?: string;
	/** Additional key-value pairs stored on the checkout and surfaced on webhooks. */
	metadata?: Record<string, string>;
}

/**
 * Maps one {@link IngestEvent} onto the SDK payload for it, picking
 * `EventCreateCustomer` or `EventCreateExternalCustomer` from whichever id the caller
 * supplied and nesting `cost` under the `_cost` metadata key Cost Insights reads.
 *
 * @param event - The event to send.
 * @returns The SDK-shaped event.
 * @throws {Error} When the event identifies no customer, which Polar would reject with a
 * validation error naming neither field.
 */
function toIngestPayload(event: IngestEvent): EventCreateCustomer | EventCreateExternalCustomer {
	let metadata = event.cost ? { ...event.metadata, _cost: event.cost } : event.metadata;
	let common = {
		name: event.name,
		metadata,
		timestamp: event.timestamp,
		externalId: event.externalId,
	};

	if (event.externalCustomerId !== undefined) {
		return { ...common, externalCustomerId: event.externalCustomerId };
	}
	if (event.customerId !== undefined) return { ...common, customerId: event.customerId };

	throw new Error(`Event "${event.name}" names neither a customerId nor an externalCustomerId`);
}

/**
 * Type-safe Polar billing client.
 *
 * Wraps `@polar-sh/sdk` behind a small, stable API covering customer,
 * subscription, checkout/portal, event-ingestion, and webhook operations —
 * enough for both seat/MAU and metered usage billing. Instantiate once
 * (typically as a service-container singleton) and inject wherever needed.
 *
 * @example
 * ```ts
 * import { PolarClient } from "@pkg/polar";
 *
 * let polar = new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN });
 * let customer = await polar.createCustomer("jane@example.com", "Jane Doe");
 * ```
 */
export class PolarClient {
	/** The underlying SDK client, created once from the access token. */
	private readonly client: Polar;

	/**
	 * Create a new Polar client.
	 *
	 * @param options - Client configuration.
	 * @param options.accessToken - The Polar API access token.
	 *
	 * @example
	 * ```ts
	 * let polar = new PolarClient({ accessToken: "polar_at_..." });
	 * ```
	 */
	constructor(options: PolarClientOptions) {
		this.client = new Polar({ accessToken: options.accessToken });
	}

	/**
	 * Create a new customer in Polar.
	 *
	 * @param email - The customer's email address.
	 * @param name - The customer's display name, or `null` when unknown.
	 * @param metadata - Additional key-value pairs to store on the customer.
	 * @returns The created customer object.
	 * @throws {PolarError} When the Polar API rejects the request.
	 *
	 * @example
	 * ```ts
	 * let customer = await polar.createCustomer("jane@example.com", "Jane Doe", {
	 * 	tenant_id: "t_123",
	 * });
	 * ```
	 */
	async createCustomer(
		email: string,
		name: string | null = null,
		metadata: Record<string, string> = {},
	): Promise<Customer> {
		return await this.client.customers.create({
			email,
			name: name ?? undefined,
			metadata,
		});
	}

	/**
	 * Get a customer by ID.
	 *
	 * @param customerId - The Polar customer ID.
	 * @returns The customer object.
	 * @throws {PolarError} When the customer does not exist or the request fails.
	 */
	async getCustomer(customerId: string): Promise<Customer> {
		return await this.client.customers.get({ id: customerId });
	}

	/**
	 * Get a customer by its app-owned external id.
	 *
	 * @param externalId - The external id previously linked to the customer.
	 * @returns The customer object, or `null` when no customer has that external id.
	 */
	async getExternalCustomer(externalId: string): Promise<Customer | null> {
		try {
			return await this.client.customers.getExternal({ externalId });
		} catch {
			return null;
		}
	}

	/**
	 * Find a customer by exact email match.
	 *
	 * @param email - The customer's email address.
	 * @returns The first matching customer, or `null` when none exist.
	 * @throws {PolarError} When the request fails.
	 */
	async findCustomerByEmail(email: string): Promise<Customer | null> {
		let pages = await this.client.customers.list({ email });
		for await (let page of pages) {
			let customer = page.result.items.at(0);
			if (customer) return customer;
		}
		return null;
	}

	/**
	 * Update a customer's mutable fields.
	 *
	 * @param customerId - The Polar customer ID.
	 * @param updates - The fields to update.
	 * @returns The updated customer object.
	 * @throws {PolarError} When the request fails.
	 */
	async updateCustomer(customerId: string, updates: CustomerUpdate): Promise<Customer> {
		return await this.client.customers.update({
			id: customerId,
			customerUpdate: {
				name: updates.name,
				metadata: updates.metadata,
				externalId: updates.externalId,
			},
		});
	}

	/**
	 * Get a subscription by ID.
	 *
	 * @param subscriptionId - The Polar subscription ID.
	 * @returns The subscription object.
	 * @throws {PolarError} When the subscription does not exist or the request fails.
	 */
	async getSubscription(subscriptionId: string): Promise<Subscription> {
		return await this.client.subscriptions.get({ id: subscriptionId });
	}

	/**
	 * List every subscription for a customer, following pagination to completion.
	 *
	 * @param customerId - The Polar customer ID.
	 * @returns An array with all of the customer's subscriptions.
	 * @throws {PolarError} When the request fails.
	 */
	async listSubscriptions(customerId: string): Promise<Subscription[]> {
		let result = await this.client.subscriptions.list({ customerId });
		let subscriptions: Subscription[] = [];
		for await (let page of result) subscriptions.push(...page.result.items);
		return subscriptions;
	}

	/**
	 * Checks whether a customer (identified by external id) has an active
	 * subscription to a given product. Used to gate metered features on billing
	 * status without resolving the Polar-internal customer id first.
	 *
	 * @param externalCustomerId - The app-owned external id linked to the customer.
	 * @param productId - The Polar product id the subscription must be for.
	 * @returns `true` when an active subscription to `productId` exists; `false` on
	 * any error (fails closed for feature gating, matching the OLD APP's behavior).
	 */
	async hasActiveSubscription(externalCustomerId: string, productId: string): Promise<boolean> {
		try {
			let result = await this.client.subscriptions.list({
				externalCustomerId,
				active: true,
			});
			for await (let page of result) {
				if (page.result.items.some((subscription) => subscription.productId === productId)) {
					return true;
				}
			}
			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Lists a customer's active subscriptions to a given product, filtering by
	 * external id and `active: true` server-side (the same query shape as
	 * {@link hasActiveSubscription}) rather than resolving the Polar-internal
	 * customer id first and listing unfiltered — that alternate path has been
	 * observed to return a response shape the SDK's own validation rejects for
	 * some accounts. Used to revoke subscriptions on team deletion.
	 *
	 * @param externalCustomerId - The app-owned external id linked to the customer.
	 * @param productId - The Polar product id to filter to.
	 * @returns Every matching active subscription.
	 * @throws {PolarError} When the request fails.
	 */
	async listActiveSubscriptions(
		externalCustomerId: string,
		productId: string,
	): Promise<Subscription[]> {
		let result = await this.client.subscriptions.list({
			externalCustomerId,
			active: true,
		});
		let subscriptions: Subscription[] = [];
		for await (let page of result) {
			subscriptions.push(...page.result.items.filter((sub) => sub.productId === productId));
		}
		return subscriptions;
	}

	/**
	 * Lists every active subscription to a product across the whole organization,
	 * following pagination to completion. The organization-wide counterpart to
	 * {@link listActiveSubscriptions}, for a reconciliation pass that repairs a local
	 * projection of subscription state: it answers "who is paying right now?" in one
	 * paginated walk instead of one point read per customer.
	 *
	 * @param productId - The Polar product id to filter to.
	 * @returns Every active subscription to that product.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let active = await polar.listActiveSubscriptionsByProduct(PRODUCT_ID);
	 * for (let subscription of active) await Subscription.upsert(db, subscription);
	 * ```
	 */
	async listActiveSubscriptionsByProduct(productId: string): Promise<Subscription[]> {
		let result = await this.client.subscriptions.list({ productId, active: true });
		let subscriptions: Subscription[] = [];
		for await (let page of result) subscriptions.push(...page.result.items);
		return subscriptions;
	}

	/**
	 * Revoke a subscription immediately, ending entitlement now rather than at
	 * period end.
	 *
	 * @param subscriptionId - The Polar subscription ID.
	 * @returns The revoked subscription object.
	 * @throws {PolarError} When the request fails.
	 */
	async revokeSubscription(subscriptionId: string): Promise<Subscription> {
		return await this.client.subscriptions.revoke({ id: subscriptionId });
	}

	/**
	 * Get a product by ID, including its prices and benefits. Used to render a
	 * price from Polar rather than hardcoding it in the app.
	 *
	 * @param productId - The Polar product ID.
	 * @returns The product object.
	 * @throws {PolarError} When the product does not exist or the request fails.
	 *
	 * @example
	 * ```ts
	 * let product = await polar.getProduct(env.POLAR_PRODUCT_ID);
	 * let [price] = product.prices;
	 * ```
	 */
	async getProduct(productId: string): Promise<Product> {
		return await this.client.products.get({ id: productId });
	}

	/**
	 * List the organization's discounts, following pagination to completion. The
	 * caller decides which one applies (date window, redemption limits, product
	 * scope) — the client stays app-agnostic and does not filter.
	 *
	 * @param limit - Polar page size (1-100), defaulting to 12.
	 * @returns Every discount, in the order Polar returns them.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let discounts = await polar.listDiscounts();
	 * let applicable = discounts.find((discount) => isApplicable(discount, new Date()));
	 * ```
	 */
	async listDiscounts(limit = 12): Promise<Discount[]> {
		let result = await this.client.discounts.list({ limit });
		let discounts: Discount[] = [];
		for await (let page of result) discounts.push(...page.result.items);
		return discounts;
	}

	/**
	 * List orders, optionally filtered by customer and/or product, following
	 * pagination to completion. Used to check whether a customer already bought a
	 * given product before offering them an upgrade.
	 *
	 * @param options - The filters to apply; an empty object lists every order.
	 * @param options.customerId - Only orders belonging to this Polar customer.
	 * @param options.productId - Only orders for this Polar product.
	 * @returns Every matching order.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let orders = await polar.listOrders({ customerId, productId });
	 * if (orders.length === 0) return redirect(fullPriceCheckoutUrl);
	 * ```
	 */
	async listOrders(options: { customerId?: string; productId?: string }): Promise<Order[]> {
		let result = await this.client.orders.list({
			customerId: options.customerId,
			productId: options.productId,
		});
		let orders: Order[] = [];
		for await (let page of result) orders.push(...page.result.items);
		return orders;
	}

	/**
	 * Create a hosted checkout session for a subscription.
	 *
	 * @param productId - The Polar product ID to sell.
	 * @param customerId - The Polar customer ID the checkout is for, or `undefined`
	 *   to let Polar create the customer during hosted checkout.
	 * @param successUrl - Absolute URL to redirect to after a successful checkout.
	 * @param metadata - Additional key-value pairs stored on the checkout (and
	 *   later surfaced on the resulting webhook events).
	 * @returns An object with the hosted checkout `url`.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let { url } = await polar.createCheckoutSession(
	 * 	env.POLAR_PRODUCT_ID,
	 * 	customerId,
	 * 	`${origin}/dashboard`,
	 * 	{ account_id: accountId },
	 * );
	 * return redirect(url);
	 * ```
	 */
	async createCheckoutSession(
		productId: string,
		customerId: string | undefined,
		successUrl: string,
		metadata: Record<string, string> = {},
	): Promise<SessionResult> {
		let checkout: Checkout = await this.client.checkouts.create({
			products: [productId],
			customerId,
			successUrl,
			metadata,
		});
		return { url: checkout.url };
	}

	/**
	 * Create a hosted checkout session from an options object, for the checkout
	 * fields {@link createCheckoutSession} cannot express: a pre-filled
	 * `customerEmail`, an automatically applied `discountId`, `allowDiscountCodes`,
	 * and an optional `successUrl`. Also returns the checkout `id`, so a caller can
	 * log it and correlate it with the webhook events the checkout produces.
	 *
	 * Kept as a sibling method rather than an overload of {@link createCheckoutSession}
	 * so the positional signature stays exactly as callers (and their test doubles)
	 * already see it.
	 *
	 * @param options - The checkout configuration.
	 * @returns The hosted checkout `url` and the checkout `id`.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let { url, id } = await polar.createCheckout({
	 * 	productId: env.POLAR_PRODUCT_ID,
	 * 	customerEmail: url.searchParams.get("email"),
	 * 	discountId: discount?.id,
	 * 	allowDiscountCodes: false,
	 * });
	 * log.info("checkout_started", { checkoutId: id });
	 * return redirect(url);
	 * ```
	 */
	async createCheckout(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
		let checkout: Checkout = await this.client.checkouts.create({
			products: [options.productId],
			customerId: options.customerId,
			customerEmail: options.customerEmail ?? undefined,
			discountId: options.discountId,
			allowDiscountCodes: options.allowDiscountCodes,
			successUrl: options.successUrl,
			metadata: options.metadata ?? {},
		});
		return { url: checkout.url, id: checkout.id };
	}

	/**
	 * Create a customer-portal session so a customer can manage payment methods,
	 * invoices and cancellation.
	 *
	 * @param customerId - The Polar customer ID.
	 * @returns An object with the hosted customer-portal `url`.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let { url } = await polar.createPortalSession(customerId);
	 * return redirect(url);
	 * ```
	 */
	async createPortalSession(customerId: string): Promise<SessionResult> {
		let session: CustomerSession = await this.client.customerSessions.create({ customerId });
		return { url: session.customerPortalUrl };
	}

	/**
	 * Get the total quantity recorded on a usage meter for a customer (identified by
	 * external id) within a date range, optionally narrowed by metadata matching the
	 * shape the usage events were ingested with (e.g. `{ teamId }`). Used to show a
	 * customer's consumption for a billing period without exposing Polar's raw
	 * meter/event query shapes to callers.
	 *
	 * @param externalCustomerId - The app-owned external id linked to the customer.
	 * @param meterId - The Polar meter id to query (e.g. a "ping" usage meter).
	 * @param range - The inclusive `start`/`end` of the period to sum.
	 * @param metadata - Optional metadata filter matching the event's ingested metadata.
	 * @returns The summed quantity for the period.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * let consumed = await polar.getMeterUsage(ownerId, meterId, {
	 * 	start: startOfMonth(new Date()),
	 * 	end: endOfMonth(new Date()),
	 * }, { teamId });
	 * ```
	 */
	async getMeterUsage(
		externalCustomerId: string,
		meterId: string,
		range: { start: Date; end: Date },
		metadata: Record<string, string> = {},
	): Promise<number> {
		let { total } = await this.client.meters.quantities({
			externalCustomerId,
			startTimestamp: range.start,
			endTimestamp: range.end,
			interval: "month",
			id: meterId,
			metadata,
		});
		return total;
	}

	/**
	 * Ingest one or more usage events for metered billing, or for Cost Insights when the
	 * events carry a `cost`.
	 *
	 * Sent in chunks of {@link INGEST_CHUNK_SIZE}, so a caller reporting a day's worth of
	 * events per customer hands over one array and never has to know Polar's request
	 * shape. A chunk that fails throws with the earlier chunks already accepted; give
	 * every event an `externalId` and re-sending the whole array is a no-op for those.
	 *
	 * @param events - The events to ingest.
	 * @throws {PolarError} When the request fails.
	 * @throws {Error} When an event names neither a customer nor an external customer.
	 *
	 * @example
	 * ```ts
	 * await polar.ingestEvents([
	 * 	{ customerId, name: "page_views", metadata: { views: 42, day: "2026-07-04" } },
	 * ]);
	 * ```
	 */
	async ingestEvents(events: IngestEvent[]): Promise<void> {
		for (let index = 0; index < events.length; index += INGEST_CHUNK_SIZE) {
			let chunk = events.slice(index, index + INGEST_CHUNK_SIZE);
			await this.client.events.ingest({ events: chunk.map(toIngestPayload) });
		}
	}

	/**
	 * {@link ingestEvents}, best-effort: returns `false` instead of throwing so a reporting
	 * cron can log the failure and let its next run resend the same events rather than
	 * failing the job that produced them. Idempotent when every event carries an
	 * `externalId`, since Polar deduplicates on it.
	 *
	 * @param events - The events to ingest.
	 * @returns `true` when every chunk was accepted, `false` when any request failed.
	 *
	 * @example
	 * ```ts
	 * if (!(await polar.ingestEventsSafe(events))) log.error("cost.ingest_failed");
	 * ```
	 */
	async ingestEventsSafe(events: IngestEvent[]): Promise<boolean> {
		try {
			await this.ingestEvents(events);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Report a Monthly Active Users (MAU) count for an entity. Thin wrapper over
	 * {@link ingestEvents} that emits a single `"mau"` event, for a daily
	 * reporting cron.
	 *
	 * @param customerId - The Polar customer ID to bill.
	 * @param mau - The monthly active user count.
	 * @param entityId - The entity (tenant) the count is for; stored as `tenant_id`.
	 * @param month - The reported month in `YYYY-MM` format.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * await polar.reportMAU(customerId, 1200, tenantId, "2026-07");
	 * ```
	 */
	async reportMAU(customerId: string, mau: number, entityId: string, month: string): Promise<void> {
		await this.ingestEvents([
			{
				customerId,
				name: "mau",
				metadata: { tenant_id: entityId, month, count: mau },
			},
		]);
	}

	/**
	 * Ingest a page-view meter event for a customer. Best-effort: returns `false`
	 * instead of throwing on API failure so the caller's reporting cron can retry
	 * on the next run.
	 *
	 * Pass `externalId` to make retries idempotent: Polar deduplicates on it, so if a
	 * previous run's event was accepted but the caller failed to record it locally, the
	 * next run re-sending the same `externalId` will not double-bill. A deterministic key
	 * derived from the reported entity and day (e.g. `page_views:{blog_id}:{day}`) is the
	 * natural choice.
	 *
	 * @param customerId - The Polar customer ID to bill.
	 * @param views - The number of page views to report.
	 * @param day - The day being reported in `YYYY-MM-DD` format.
	 * @param externalId - Optional deduplication id forwarded to Polar as `external_id`.
	 * @returns `true` when the event was accepted, `false` when ingestion failed.
	 *
	 * @example
	 * ```ts
	 * let ok = await polar.ingestPageViews(customerId, 128, "2026-07-04", `page_views:${blogId}:2026-07-04`);
	 * if (ok) await UsageDaily.markReported(db, usage.id);
	 * ```
	 */
	async ingestPageViews(
		customerId: string,
		views: number,
		day: string,
		externalId?: string,
	): Promise<boolean> {
		try {
			await this.ingestEvents([
				{ customerId, name: "page_views", metadata: { views, day }, externalId },
			]);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Verify a Polar webhook signature using the Standard Webhooks scheme
	 * (`webhook-id` / `webhook-timestamp` / `webhook-signature` headers).
	 *
	 * Fails **closed**: a missing/empty secret or an invalid signature returns
	 * `false`. When the signature is valid but the SDK cannot model the event type
	 * (a {@link https://docs.polar.sh Polar} event not yet in the SDK), the security
	 * boundary has still passed, so the webhook is accepted and `true` is returned —
	 * the caller is expected to validate the payload shape itself.
	 *
	 * @param request - The incoming webhook request, used for its headers.
	 * @param rawBody - The exact raw request body used to compute the signature.
	 * @param secret - The Polar webhook signing secret; when empty or `undefined`, verification fails.
	 * @returns `true` when the request is authentic, `false` otherwise.
	 *
	 * @example
	 * ```ts
	 * let body = await request.text();
	 * if (!polar.verifyWebhook(request, body, env.POLAR_WEBHOOK_SECRET)) {
	 * 	return new Response("invalid signature", { status: 401 });
	 * }
	 * ```
	 */
	verifyWebhook(request: Request, rawBody: string, secret: string | undefined): boolean {
		if (!secret) return false;

		let headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		try {
			validateEvent(rawBody, headers, secret);
			return true;
		} catch (error) {
			// A bad/missing signature is a WebhookVerificationError -> fail closed.
			if (error instanceof WebhookVerificationError) return false;
			// The signature verified but the SDK could not type the event (an event
			// type it does not model); the security boundary passed, so accept it.
			return true;
		}
	}

	/**
	 * Verify a Polar webhook signature and return the parsed event, so callers can
	 * branch on `event.type` with full types instead of re-parsing the raw body
	 * themselves. Complements {@link verifyWebhook}, which only proves authenticity.
	 *
	 * Fails **closed**: a missing/empty secret is a failure without calling the
	 * verifier. The failure error distinguishes a rejected signature from an
	 * authentic body the SDK could not model, so the caller can log them apart.
	 *
	 * @param request - The incoming webhook request, used for its headers.
	 * @param rawBody - The exact raw request body used to compute the signature.
	 * @param secret - The Polar webhook signing secret; when empty or `undefined`, parsing fails.
	 * @returns `success(event)` with the validated event, or `failure(error)`.
	 *
	 * @example
	 * ```ts
	 * let result = polar.parseWebhook(request, await request.text(), env.POLAR_WEBHOOK_SECRET);
	 * if (isFailure(result)) return new Response(result.error.message, { status: 400 });
	 * if (result.data.type === "order.paid") await tagCustomer(result.data.data.customer.email);
	 * ```
	 */
	parseWebhook(
		request: Request,
		rawBody: string,
		secret: string | undefined,
	): Result<PolarWebhookEvent, Error> {
		if (!secret) return failure(new Error("Missing Polar webhook secret"));

		let headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		try {
			return success(validateEvent(rawBody, headers, secret));
		} catch (error) {
			// A bad/missing signature is a WebhookVerificationError -> fail closed.
			if (error instanceof WebhookVerificationError) {
				return failure(new Error("Invalid Polar webhook signature"));
			}
			// The signature verified but the SDK could not validate/type the payload.
			let message = error instanceof Error ? error.message : String(error);
			return failure(new Error(`Invalid Polar webhook payload: ${message}`));
		}
	}
}
