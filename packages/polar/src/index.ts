/**
 * @module @pkg/polar
 *
 * Instance-based Polar billing client wrapping `@polar-sh/sdk`: customers,
 * subscriptions, products, discounts, checkout/portal sessions, and webhooks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@pkg/result";
import type { Polar } from "@polar-sh/sdk";
import type { Checkout } from "@polar-sh/sdk/models/components/checkout.js";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { CustomerSession } from "@polar-sh/sdk/models/components/customersession.js";
import type { Discount } from "@polar-sh/sdk/models/components/discount.js";
import type { EventCreateCustomer } from "@polar-sh/sdk/models/components/eventcreatecustomer.js";
import type { EventCreateExternalCustomer } from "@polar-sh/sdk/models/components/eventcreateexternalcustomer.js";
import type { Order } from "@polar-sh/sdk/models/components/order.js";
import type { Product } from "@polar-sh/sdk/models/components/product.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";

import { failure, isFailure, success } from "@pkg/result";
import * as Webhooks from "@pkg/webhooks";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";

/**
 * The SDK's error class, re-exported so callers can catch billing failures by
 * type. Its module is a bare `Error` subclass with no schema imports, so
 * importing it eagerly costs nothing.
 */
export { PolarError };
export type { Checkout, Customer, CustomerSession, Discount, Order, Product, Subscription };

/**
 * The error the SDK's verifier throws for a bad or missing signature. Kept exported and
 * type-only so existing imports keep compiling; verification now runs through
 * `@pkg/webhooks`, and re-exporting the value would pull the SDK's webhook parser in.
 */
export type { WebhookVerificationError } from "@polar-sh/sdk/webhooks.js";

/**
 * Any webhook event the SDK can model, as returned by its `validateEvent`. It is a
 * discriminated union on `type`, so callers can narrow with
 * `event.type === "order.paid"` and get a fully typed payload.
 */
export type PolarWebhookEvent = ReturnType<
	typeof import("@polar-sh/sdk/webhooks.js").validateEvent
>;

/**
 * The vendor SDK as {@link PolarClient} uses it: one configured API client plus the
 * event parser, resolved together by {@link PolarClient.sdk} on first use.
 */
interface PolarSdk {
	/** The configured SDK client every API method delegates to. */
	client: Polar;
	/**
	 * Turns a webhook body into a typed event, or throws when it cannot model it. It also
	 * verifies the signature, but {@link PolarClient.parseWebhook} only calls it on a body
	 * `@pkg/webhooks` has already authenticated, so its verdict is read purely as typing.
	 */
	validateEvent: typeof import("@polar-sh/sdk/webhooks.js").validateEvent;
}

/**
 * The subscription statuses Polar's `list({ active: true })` filter treats as active:
 * `active` and `trialing` only. A cancelled-at-period-end subscription stays `active`
 * until the period ends, so entitlement follows status, not the cancellation event.
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
 * something else. Narrows the parsed event — a union of ~35 payload types on `type` —
 * so a caller that only cares about subscription state need not repeat that list itself.
 *
 * @param event - A verified webhook event from {@link PolarClient.parseWebhook}.
 * @returns The event's subscription, or `null` when it isn't a subscription event.
 *
 * @example
 * ```ts
 * let result = await polar.parseWebhook(request, body, secret);
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
 * Supplies the access token the first time the client actually talks to Polar, for a
 * token that only becomes available asynchronously — one read from a secret store, say.
 * Reading it eagerly would mean awaiting at module scope, which a Worker rejects.
 */
export interface AccessTokenProvider {
	/**
	 * Resolves the Polar API access token.
	 *
	 * @returns The token, or a promise for it.
	 */
	(): string | Promise<string>;
}

/**
 * Options accepted by the {@link PolarClient} constructor.
 */
export interface PolarClientOptions {
	/**
	 * Polar API access token (personal or organization). Sent as a Bearer token.
	 *
	 * A function is called once, on the first request that needs the SDK, and its result
	 * is memoized with the loaded client — see {@link AccessTokenProvider}.
	 */
	accessToken: string | AccessTokenProvider;
}

/**
 * Most events Polar accepts in one ingestion request. Polar documents no batch limit,
 * so this is a conservative self-imposed ceiling: {@link PolarClient.ingestEvents}
 * splits larger arrays across requests ahead of ever hitting Polar's real one.
 */
const INGEST_CHUNK_SIZE = 100;

/**
 * Accepted clock skew on an inbound delivery, applied in both directions: five minutes,
 * the window Polar's own deliveries are built for — and the window a captured request
 * stays replayable for.
 */
const WEBHOOK_TOLERANCE = "5 minutes";

/**
 * Re-encodes a Polar webhook secret as base64 key material: senders and the SDK both
 * base64-encode the secret's UTF-8 bytes before signing, so the same encoding must
 * happen here — built byte by byte so secrets containing non-Latin-1 text encode too.
 *
 * @param secret - The webhook secret exactly as Polar issued it.
 * @returns The secret's UTF-8 bytes, base64 encoded.
 */
function toSigningSecret(secret: string): string {
	let binary = "";
	for (let byte of new TextEncoder().encode(secret)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/**
 * Rebuilds a delivery as a request whose body is still unread. Verification covers the
 * exact bytes received and a stream can be read only once, so callers hand the raw text
 * back behind the same headers, letting it be verified exactly as it arrived.
 *
 * @param request - The incoming webhook request, used for its URL and headers.
 * @param rawBody - The exact raw request body the signature was computed over.
 * @returns A request carrying the same signature headers over the same bytes.
 */
function toVerifiableRequest(request: Request, rawBody: string): Request {
	return new Request(request.url, {
		method: "POST",
		headers: new Headers(request.headers),
		body: rawBody,
	});
}

/**
 * Whether a delivery is authentic — the whole of the security boundary. A
 * `PayloadValidationError` still counts as authentic: the signature matched and only
 * the body's shape was unexpected. Every other failure means the request is inauthentic.
 *
 * @param request - The incoming webhook request, used for its headers.
 * @param rawBody - The exact raw request body the signature was computed over.
 * @param secret - The Polar webhook signing secret, as Polar issued it.
 * @returns `true` when the signature verified against the secret.
 */
async function isAuthentic(request: Request, rawBody: string, secret: string): Promise<boolean> {
	let result = await Webhooks.verify(toVerifiableRequest(request, rawBody), {
		secret: toSigningSecret(secret),
		tolerance: WEBHOOK_TOLERANCE,
	});

	if (isFailure(result)) return result.error instanceof Webhooks.PayloadValidationError;

	return true;
}

/**
 * A cost to attach to an ingested event, read by Polar's Cost Insights and combined
 * with revenue into gross profit and LTV. `amount` is **cents** as a **string**, since
 * JS renders floats below 1e-6 in exponential notation, which Polar's parser rejects.
 */
export interface EventCost {
	/** The amount in **cents**, as a plain decimal string (e.g. `"0.003476700"`). */
	amount: string;
	/** The currency; Polar supports only `usd`. */
	currency: "usd";
}

/**
 * A single usage event to ingest into Polar's events API. Exactly one of `customerId`
 * and `externalCustomerId` identifies the customer, so an app that keys customers by
 * its own id (an OIDC subject, a tenant id) never has to resolve the Polar one first.
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
	 * Kept out of `metadata` in this interface because the nesting is Polar's own wire
	 * convention, hidden behind this typed field.
	 */
	cost?: EventCost;
	/** When the event happened. Defaults to Polar's ingestion time when omitted. */
	timestamp?: Date;
	/**
	 * A caller-supplied unique id for this event, forwarded to Polar as `external_id`.
	 * Polar deduplicates on it, so re-sending an event with the same `externalId` is a
	 * no-op — the safe way to make an at-most-once reporting cron idempotent.
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
 * Options accepted by {@link PolarClient.createCheckout}: adds `customerEmail`,
 * `discountId`, and `allowDiscountCodes` to what {@link PolarClient.createCheckoutSession}
 * expresses, and makes `successUrl` optional for Polar's own confirmation page.
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
 * Type-safe Polar billing client. Wraps `@polar-sh/sdk` behind a small, stable API
 * covering customer, subscription, checkout/portal, event-ingestion, and webhook
 * operations — enough for both seat/MAU and metered usage billing.
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
	/** The access token, or the provider for it, held until the SDK is configured. */
	private readonly accessToken: string | AccessTokenProvider;

	/**
	 * The in-flight or settled SDK load, so concurrent first calls share one import and
	 * client, building the schemas only once. A rejection is discarded, so a transient
	 * failure resolving the access token clears on the client's very next call.
	 */
	private loading: Promise<PolarSdk> | undefined;

	/**
	 * Create a new Polar client. Constructing one performs no work and loads no
	 * vendor code, so an app can hold an instance (or reference the class as a
	 * service-container token) without paying the SDK's startup cost.
	 *
	 * @param options - Client configuration.
	 * @param options.accessToken - The Polar API access token, or a function resolving it
	 * on first use for a token that is only readable asynchronously.
	 *
	 * @example
	 * ```ts
	 * let polar = new PolarClient({ accessToken: "polar_at_..." });
	 * let lazy = new PolarClient({ accessToken: () => secret.get() });
	 * ```
	 */
	constructor(options: PolarClientOptions) {
		this.accessToken = options.accessToken;
	}

	/**
	 * The vendor SDK, imported and configured on first use and memoized after. Every
	 * method that talks to Polar goes through here, keeping the import out of module
	 * scope so the bundler-split chunk loads only on a code path that actually bills.
	 *
	 * @returns The configured client and the webhook event parser.
	 */
	private sdk(): Promise<PolarSdk> {
		return (this.loading ??= Promise.all([
			import("@polar-sh/sdk"),
			import("@polar-sh/sdk/webhooks.js"),
			typeof this.accessToken === "function" ? this.accessToken() : this.accessToken,
		])
			.then(([{ Polar }, { validateEvent }, accessToken]) => ({
				client: new Polar({ accessToken }),
				validateEvent,
			}))
			.catch((error: unknown) => {
				this.loading = undefined;
				throw error;
			}));
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
		let { client } = await this.sdk();
		return await client.customers.create({
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
		let { client } = await this.sdk();
		return await client.customers.get({ id: customerId });
	}

	/**
	 * Get a customer by its app-owned external id.
	 *
	 * @param externalId - The external id previously linked to the customer.
	 * @returns The customer object, or `null` when no customer has that external id.
	 */
	async getExternalCustomer(externalId: string): Promise<Customer | null> {
		try {
			let { client } = await this.sdk();
			return await client.customers.getExternal({ externalId });
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
		let { client } = await this.sdk();
		let pages = await client.customers.list({ email });
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
		let { client } = await this.sdk();
		return await client.customers.update({
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
		let { client } = await this.sdk();
		return await client.subscriptions.get({ id: subscriptionId });
	}

	/**
	 * List every subscription for a customer, following pagination to completion.
	 *
	 * @param customerId - The Polar customer ID.
	 * @returns An array with all of the customer's subscriptions.
	 * @throws {PolarError} When the request fails.
	 */
	async listSubscriptions(customerId: string): Promise<Subscription[]> {
		let { client } = await this.sdk();
		let result = await client.subscriptions.list({ customerId });
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
	 * any error (fails closed for feature gating).
	 */
	async hasActiveSubscription(externalCustomerId: string, productId: string): Promise<boolean> {
		try {
			let { client } = await this.sdk();
			let result = await client.subscriptions.list({
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
	 * Lists a customer's active subscriptions to a given product, filtering by external
	 * id and `active: true` server-side — the same shape as {@link hasActiveSubscription}.
	 * Unfiltered listing has triggered an SDK validation rejection for some accounts.
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
		let { client } = await this.sdk();
		let result = await client.subscriptions.list({
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
	 * following pagination to completion — for a reconciliation pass that repairs a
	 * local projection of subscription state in one paginated walk.
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
		let { client } = await this.sdk();
		let result = await client.subscriptions.list({ productId, active: true });
		let subscriptions: Subscription[] = [];
		for await (let page of result) subscriptions.push(...page.result.items);
		return subscriptions;
	}

	/**
	 * Revoke a subscription immediately, ending entitlement at the moment of the call.
	 *
	 * @param subscriptionId - The Polar subscription ID.
	 * @returns The revoked subscription object.
	 * @throws {PolarError} When the request fails.
	 */
	async revokeSubscription(subscriptionId: string): Promise<Subscription> {
		let { client } = await this.sdk();
		return await client.subscriptions.revoke({ id: subscriptionId });
	}

	/**
	 * Get a product by ID, including its prices and benefits, for rendering a
	 * live price sourced from Polar.
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
		let { client } = await this.sdk();
		return await client.products.get({ id: productId });
	}

	/**
	 * List the organization's discounts, following pagination to completion, leaving
	 * the caller to decide which one applies (date window, redemption limits,
	 * product scope).
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
		let { client } = await this.sdk();
		let result = await client.discounts.list({ limit });
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
		let { client } = await this.sdk();
		let result = await client.orders.list({
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
		let { client } = await this.sdk();
		let checkout: Checkout = await client.checkouts.create({
			products: [productId],
			customerId,
			successUrl,
			metadata,
		});
		return { url: checkout.url };
	}

	/**
	 * Create a hosted checkout session from an options object, covering fields
	 * {@link createCheckoutSession} cannot express. Kept as a sibling method so that
	 * method's positional signature stays exactly as existing callers and tests see it.
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
		let { client } = await this.sdk();
		let checkout: Checkout = await client.checkouts.create({
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
		let { client } = await this.sdk();
		let session: CustomerSession = await client.customerSessions.create({ customerId });
		return { url: session.customerPortalUrl };
	}

	/**
	 * Ingest one or more usage events for metered billing, or for Cost Insights
	 * when events carry a `cost`, sent in chunks of {@link INGEST_CHUNK_SIZE}. A
	 * failed chunk leaves earlier ones accepted, so give events an `externalId`.
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
		let { client } = await this.sdk();
		for (let index = 0; index < events.length; index += INGEST_CHUNK_SIZE) {
			let chunk = events.slice(index, index + INGEST_CHUNK_SIZE);
			await client.events.ingest({ events: chunk.map(toIngestPayload) });
		}
	}

	/**
	 * {@link ingestEvents}, best-effort: returns `false` on failure so a reporting cron
	 * can log it and recover by resending the same events on its next run. Idempotent
	 * when every event carries an `externalId`, since Polar deduplicates on it.
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
	 * Ingest a page-view meter event for a customer. Best-effort: returns `false` on API
	 * failure so the caller's reporting cron can retry on the next run. Pass `externalId`
	 * — e.g. `page_views:{blog_id}:{day}` — so Polar dedupes a retried event safely.
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
	 * Verify a Polar webhook signature through `@pkg/webhooks`, loading no vendor SDK.
	 * Fails **closed** on a missing secret or bad signature; an authentic body this
	 * endpoint cannot model still returns `true`, for the caller to validate itself.
	 *
	 * @param request - The incoming webhook request, used for its headers.
	 * @param rawBody - The exact raw request body used to compute the signature.
	 * @param secret - The Polar webhook signing secret; when empty or `undefined`, verification fails.
	 * @returns `true` when the request is authentic, `false` otherwise.
	 *
	 * @example
	 * ```ts
	 * let body = await request.text();
	 * if (!(await polar.verifyWebhook(request, body, env.POLAR_WEBHOOK_SECRET))) {
	 * 	return new Response("invalid signature", { status: 401 });
	 * }
	 * ```
	 */
	async verifyWebhook(
		request: Request,
		rawBody: string,
		secret: string | undefined,
	): Promise<boolean> {
		if (!secret) return false;

		return await isAuthentic(request, rawBody, secret);
	}

	/**
	 * Verify a Polar webhook signature and return the parsed event, complementing
	 * {@link verifyWebhook}. Authentication runs through `@pkg/webhooks`; anything the
	 * SDK objects to afterward is a payload failure, since the boundary already passed.
	 *
	 * @param request - The incoming webhook request, used for its headers.
	 * @param rawBody - The exact raw request body used to compute the signature.
	 * @param secret - The Polar webhook signing secret; when empty or `undefined`, parsing fails.
	 * @returns `success(event)` with the validated event, or `failure(error)`.
	 *
	 * @example
	 * ```ts
	 * let result = await polar.parseWebhook(request, await request.text(), env.POLAR_WEBHOOK_SECRET);
	 * if (isFailure(result)) return new Response(result.error.message, { status: 400 });
	 * if (result.data.type === "order.paid") await tagCustomer(result.data.data.customer.email);
	 * ```
	 */
	async parseWebhook(
		request: Request,
		rawBody: string,
		secret: string | undefined,
	): Promise<Result<PolarWebhookEvent, Error>> {
		if (!secret) return failure(new Error("Missing Polar webhook secret"));

		if (!(await isAuthentic(request, rawBody, secret))) {
			return failure(new Error("Invalid Polar webhook signature"));
		}

		let headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		let { validateEvent } = await this.sdk();

		try {
			return success(validateEvent(rawBody, headers, secret));
		} catch (error) {
			let message = error instanceof Error ? error.message : String(error);
			return failure(new Error(`Invalid Polar webhook payload: ${message}`));
		}
	}
}
