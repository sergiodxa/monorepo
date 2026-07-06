/**
 * @module @pkg/polar
 *
 * Instance-based Polar billing client shared across the SaaS apps. Wraps the
 * official [`@polar-sh/sdk`](https://docs.polar.sh/api) so every app talks to
 * Polar through one type-safe, dependency-injectable surface: customers,
 * subscriptions, hosted checkout/portal sessions, usage-event ingestion, and
 * Standard-Webhooks signature verification.
 *
 * The client is constructed from configuration (`{ accessToken }`) rather than
 * reading environment variables itself, so it stays compatible with
 * `@pkg/service-container` (ADR-008) and is trivial to test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Checkout } from "@polar-sh/sdk/models/components/checkout.js";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { CustomerSession } from "@polar-sh/sdk/models/components/customersession.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";

import { Polar } from "@polar-sh/sdk";
import { PolarError } from "@polar-sh/sdk/models/errors/polarerror.js";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks.js";

export { PolarError, WebhookVerificationError };
export type { Checkout, Customer, CustomerSession, Subscription };

/**
 * Options accepted by the {@link PolarClient} constructor.
 */
export interface PolarClientOptions {
	/** Polar API access token (personal or organization). Sent as a Bearer token. */
	accessToken: string;
}

/**
 * A single usage event to ingest into Polar's events API.
 *
 * @see https://docs.polar.sh/api-reference/events/ingest
 */
export interface IngestEvent {
	/** The Polar customer the event belongs to. */
	customerId: string;
	/** The event name, matching a configured meter (e.g. `"mau"`, `"page_views"`). */
	name: string;
	/** Arbitrary metadata stored with the event; used by meters for aggregation. */
	metadata?: Record<string, string | number | boolean>;
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
}

/**
 * The result of creating a checkout or customer-portal session.
 */
export interface SessionResult {
	/** The Polar-hosted URL to redirect the customer to. */
	url: string;
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
	 * Ingest one or more usage events for metered billing.
	 *
	 * @param events - The events to ingest.
	 * @throws {PolarError} When the request fails.
	 *
	 * @example
	 * ```ts
	 * await polar.ingestEvents([
	 * 	{ customerId, name: "page_views", metadata: { views: 42, day: "2026-07-04" } },
	 * ]);
	 * ```
	 */
	async ingestEvents(events: IngestEvent[]): Promise<void> {
		await this.client.events.ingest({
			events: events.map((event) => ({
				customerId: event.customerId,
				name: event.name,
				metadata: event.metadata,
				timestamp: event.timestamp,
				externalId: event.externalId,
			})),
		});
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
}
