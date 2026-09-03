/**
 * The provider contract: one instance carrying every billing operation, grouped
 * by resource, with each method reporting through a `Result`. A route reads the
 * instance from its context and a job imports it, so both use the same object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import type { BillingError } from "./errors";
import type {
	BillingEvent,
	BillingInterval,
	Checkout,
	Customer,
	CustomerRef,
	Discount,
	EntitlementState,
	MeterQuantity,
	Order,
	Page,
	PortalSession,
	Product,
	Subscription,
	SubscriptionStatus,
	UsageEvent,
	UsageIngest,
	UsageRecord,
} from "./types";

/** What a customer is created with; `externalId` is required so the join key is always there. */
export interface CreateCustomerInput {
	email: string;
	/** Our own stable subject id. Platforms treat it as immutable once set. */
	externalId: string;
	name?: string;
	metadata?: Record<string, string>;
}

/** Fields a customer update may change; anything omitted keeps its stored value. */
export interface UpdateCustomerInput {
	email?: string;
	name?: string;
	/**
	 * Our own subject id, for adopting a platform customer that carries none —
	 * the record a support agent or an import created. A platform holding a
	 * different id already reports `conflict`, since it treats the join key as
	 * immutable once set.
	 */
	externalId?: string;
	metadata?: Record<string, string>;
}

/** Filters and paging for a customer list. */
export interface ListCustomersQuery {
	email?: string;
	limit?: number;
	cursor?: string;
}

/** Customer records on the platform, addressed by either identifier. */
export interface CustomerApi {
	/**
	 * Creates a customer.
	 *
	 * @param input - Email plus our own subject id, which becomes the join key.
	 * @returns The created customer, or `conflict` when `externalId` is already taken.
	 */
	create(input: CreateCustomerInput): Promise<Result<Customer, BillingError>>;

	/**
	 * Updates a customer's mutable fields.
	 *
	 * @param customer - Which customer, by either identifier.
	 * @param input - Fields to change; omitted fields keep their stored value.
	 * @returns The customer as stored after the change.
	 */
	update(
		customer: CustomerRef,
		input: UpdateCustomerInput,
	): Promise<Result<Customer, BillingError>>;

	/**
	 * Reads one customer.
	 *
	 * @param customer - Which customer, by either identifier.
	 * @returns The customer, or a `not_found` failure when the platform holds none.
	 */
	find(customer: CustomerRef): Promise<Result<Customer, BillingError>>;

	/**
	 * Reads the customer holding an email address.
	 *
	 * @param email - Address to match exactly.
	 * @returns The customer, or a `not_found` failure when no record holds it.
	 */
	findByEmail(email: string): Promise<Result<Customer, BillingError>>;

	/**
	 * Reads one page of customers.
	 *
	 * @param query - Filters plus the page size and cursor.
	 * @returns The page, with the cursor for the next one.
	 */
	list(query?: ListCustomersQuery): Promise<Result<Page<Customer>, BillingError>>;
}

/** Filters and paging for a catalog list. */
export interface ListProductsQuery {
	/** Include products the platform has archived; they stay readable for old orders. */
	archived?: boolean;
	limit?: number;
	cursor?: string;
}

/**
 * The platform's catalog, addressed by our own slugs. It is read-only: products
 * and prices are created in the platform's dashboard.
 */
export interface CatalogApi {
	/**
	 * Reads one product.
	 *
	 * @param slug - Our own name for it, as the provider was configured.
	 * @returns The product, or a `not_found` failure when the slug maps to nothing.
	 */
	find(slug: string): Promise<Result<Product, BillingError>>;

	/**
	 * Reads one page of the configured catalog.
	 *
	 * @param query - Whether to include archived products, plus the page size and cursor.
	 * @returns The page, with the cursor for the next one.
	 */
	list(query?: ListProductsQuery): Promise<Result<Page<Product>, BillingError>>;
}

/** What a hosted checkout is opened with. */
export interface CreateCheckoutInput {
	/** Our own name for what is being bought. */
	product: string;
	/**
	 * Who is buying. Omitting it lets the hosted page collect the buyer's identity,
	 * which is what a sale to someone who has no account yet needs.
	 */
	customer?: CustomerRef;
	/** Email to prefill for a buyer who has no customer record yet. */
	email?: string;
	/** Where the platform sends the customer back to when the page is done. */
	returnTo?: string;
	/** Discount to apply, by the id a discount read reports. */
	discount?: string;
	quantity?: number;
	metadata?: Record<string, string>;
	/**
	 * Whether the hosted page collects a discount code the buyer types. `false`
	 * is what keeps a typed code off a price a campaign already discounted, and
	 * a platform whose page has no code field answers `unsupported` when asked
	 * to allow one.
	 */
	allowDiscountCodes?: boolean;
	/**
	 * Key correlating a retried open with the first attempt. A platform with an
	 * idempotency header answers the same session for it, so a double-submitted
	 * form bills once; a platform with none records it on the session, which
	 * makes the second session attributable but does not prevent it, so a caller
	 * wanting one session per attempt keys its own store on the same value.
	 */
	idempotencyKey?: string;
}

/** Hosted checkout sessions, which are how every purchase is made. */
export interface CheckoutApi {
	/**
	 * Opens a checkout session.
	 *
	 * @param input - What is being bought, by whom, and where to return them.
	 * @returns The session, whose `url` the route redirects to.
	 */
	create(input: CreateCheckoutInput): Promise<Result<Checkout, BillingError>>;

	/**
	 * Reads one checkout session.
	 *
	 * @param checkout - The session's identifier.
	 * @returns The session, or a `not_found` failure when the platform holds none.
	 */
	find(checkout: string): Promise<Result<Checkout, BillingError>>;

	/**
	 * Reads the state of a session a customer has just come back from, which is
	 * the call a return route makes. A delivery from the platform is handled
	 * separately, since the two differ in trust and in who is waiting.
	 *
	 * @param checkout - The session's identifier, as the return URL carries it.
	 * @returns The session with whatever it produced, or a `not_found` failure.
	 */
	finish(checkout: string): Promise<Result<Checkout, BillingError>>;
}

/** What a hosted portal session is opened with. */
export interface CreatePortalInput {
	customer: CustomerRef;
	/** Where the platform sends the customer back to when they leave the portal. */
	returnTo?: string;
}

/**
 * Hosted billing management. Upgrades, downgrades, cancellations, and
 * payment-method changes all happen here, so proration stays the platform's.
 */
export interface PortalApi {
	/**
	 * Opens a portal session.
	 *
	 * @param input - Whose billing to manage, and where to return them.
	 * @returns The session, whose `url` the route redirects to.
	 */
	create(input: CreatePortalInput): Promise<Result<PortalSession, BillingError>>;
}

/** Filters and paging for a subscription list. */
export interface ListSubscriptionsQuery {
	customer?: CustomerRef;
	/** Our own name for the subscribed product. */
	product?: string;
	/** Statuses to keep; omitted keeps every one. */
	status?: SubscriptionStatus[];
	limit?: number;
	cursor?: string;
}

/**
 * Subscription reads. A subscription is created by a completed checkout and
 * announced by an event, so there is no creation call here.
 */
export interface SubscriptionApi {
	/**
	 * Reads one subscription.
	 *
	 * @param subscription - The subscription's identifier.
	 * @returns The subscription, or a `not_found` failure when the platform holds none.
	 */
	find(subscription: string): Promise<Result<Subscription, BillingError>>;

	/**
	 * Reads one page of subscriptions.
	 *
	 * @param query - Filters plus the page size and cursor.
	 * @returns The page, with the cursor for the next one.
	 */
	list(query?: ListSubscriptionsQuery): Promise<Result<Page<Subscription>, BillingError>>;

	/**
	 * Stops a subscription renewing. It is the one write every platform in scope
	 * offers, so it stays here rather than behind a hosted portal that a platform
	 * may not have.
	 *
	 * @param subscription - The subscription's identifier.
	 * @param options - `atPeriodEnd` keeps access until the paid period runs out; omitted ends it now.
	 * @returns The subscription as stored after the change, `not_found` when the
	 * platform holds none, or `unsupported` when `atPeriodEnd` is `true` on a
	 * platform that can only cancel immediately.
	 */
	cancel(
		subscription: string,
		options?: { atPeriodEnd?: boolean },
	): Promise<Result<Subscription, BillingError>>;
}

/**
 * The snapshot an app syncs from. It answers what a customer has right now in
 * one call, which is the read every platform can serve and the seam that
 * survives a provider change.
 */
export interface EntitlementApi {
	/**
	 * Reads everything a customer currently holds.
	 *
	 * @param customer - Which customer, by either identifier.
	 * @returns The snapshot to write into our own tables, or a `not_found` failure.
	 */
	of(customer: CustomerRef): Promise<Result<EntitlementState, BillingError>>;
}

/** Filters and paging for an order list. */
export interface ListOrdersQuery {
	customer?: CustomerRef;
	/** Our own name for the purchased product. */
	product?: string;
	subscription?: string;
	limit?: number;
	cursor?: string;
}

/** Paid-order reads, which are what a purchase history and an upgrade gate read. */
export interface OrderApi {
	/**
	 * Reads one order.
	 *
	 * @param order - The order's identifier.
	 * @returns The order, or a `not_found` failure when the platform holds none.
	 */
	find(order: string): Promise<Result<Order, BillingError>>;

	/**
	 * Reads one page of orders.
	 *
	 * @param query - Filters plus the page size and cursor.
	 * @returns The page, with the cursor for the next one.
	 */
	list(query?: ListOrdersQuery): Promise<Result<Page<Order>, BillingError>>;
}

/** Filters and paging for a discount list. */
export interface ListDiscountsQuery {
	/** Our own name for the product a discount applies to. */
	product?: string;
	limit?: number;
	cursor?: string;
}

/**
 * Discount reads. Discounts are created in the platform's dashboard, and a
 * checkout applies one by the id these reads report.
 */
export interface DiscountApi {
	/**
	 * Reads one discount.
	 *
	 * @param discount - The discount's identifier.
	 * @returns The discount, or a `not_found` failure when the platform holds none.
	 */
	find(discount: string): Promise<Result<Discount, BillingError>>;

	/**
	 * Reads the discount a customer-facing code redeems, which is how a code
	 * typed into our own form becomes an id a checkout accepts.
	 *
	 * @param code - The code as the customer typed it.
	 * @returns The discount, or a `not_found` failure when no discount redeems it.
	 */
	findByCode(code: string): Promise<Result<Discount, BillingError>>;

	/**
	 * Reads one page of discounts.
	 *
	 * @param query - Filters plus the page size and cursor.
	 * @returns The page, with the cursor for the next one.
	 */
	list(query?: ListDiscountsQuery): Promise<Result<Page<Discount>, BillingError>>;
}

/** Filters and paging for a usage read-back. */
export interface ListUsageQuery {
	customer?: CustomerRef;
	/** Our own name for the meter events counted against. */
	name?: string;
	from?: Date;
	to?: Date;
	limit?: number;
	cursor?: string;
}

/**
 * Consumption reporting. It carries no app semantics: a caller names its own
 * meter and its own metadata, and chunking to the platform's per-request limit
 * happens inside the provider.
 */
export interface UsageApi {
	/**
	 * Reports consumption events.
	 *
	 * @param events - Events to count, each naming a meter and a customer.
	 * @returns How many the platform accepted, a resent `externalId` counting once.
	 */
	ingest(events: readonly UsageEvent[]): Promise<Result<UsageIngest, BillingError>>;

	/**
	 * Reads back ingested events, which is the read a reconciliation uses to see
	 * what the platform actually counted.
	 *
	 * @param query - Filters plus the page size and cursor.
	 * @returns The page, with the cursor for the next one.
	 */
	list(query?: ListUsageQuery): Promise<Result<Page<UsageRecord>, BillingError>>;
}

/**
 * What a delivery is, before it is parsed. The delivery id and the object are
 * separate because a platform can send several distinct deliveries about one
 * object, and deduplicating on the object would drop all but the first.
 */
export interface WebhookReference {
	/** Identifies this delivery, for deduplication. */
	deliveryId: string;
	/** Which object changed, for routing; `null` when the delivery names none. */
	object: { id: string; type: string } | null;
}

/**
 * The three narrow questions a webhook endpoint asks its provider. Verification
 * stays here because the signing schemes differ per platform, while
 * deduplication, persistence, and dispatch are the same everywhere.
 */
export interface WebhookApi {
	/**
	 * Answers whether a delivery is authentic, against the exact bytes received.
	 *
	 * @param request - The inbound request, for its signature headers.
	 * @param rawBody - The body as received, before any parsing.
	 * @returns `true` only for a delivery this connection's secret proves.
	 */
	verify(request: Request, rawBody: string): Promise<boolean>;

	/**
	 * Names which delivery this is, for deduplication and routing, without
	 * committing to a normalized shape. The request comes along because a
	 * platform can carry its per-delivery id in a header rather than the body.
	 *
	 * @param request - The inbound request, for its delivery headers.
	 * @param rawBody - The body as received.
	 * @returns The delivery id and the object it names, or `null` when unreadable.
	 */
	reference(request: Request, rawBody: string): WebhookReference | null;

	/**
	 * Normalizes a delivery into our own event vocabulary. It is asynchronous
	 * because a platform whose delivery carries only an identifier has to read
	 * the object back before it can say what happened.
	 *
	 * @param request - The inbound request, for whatever the body omits.
	 * @param rawBody - The body as received.
	 * @returns The event, `unrecognized` for a shape outside this vocabulary, or a failure when unreadable.
	 */
	event(request: Request, rawBody: string): Promise<Result<BillingEvent, BillingError>>;
}

/**
 * What a meter read is asked about. The window and the bucket width are stated
 * rather than defaulted, because a platform that aggregates demands both and a
 * default chosen inside a provider makes the same query mean different things.
 */
export interface MeterQuantityQuery {
	/** Our own name for the meter. */
	meter: string;
	customer?: CustomerRef;
	/** Start of the window, inclusive. */
	from: Date;
	/** End of the window, inclusive. */
	to: Date;
	/** Width the platform aggregates the window into. */
	interval: BillingInterval;
}

/** Meter readings, for a view that shows a customer what they have consumed. */
export interface MeterApi {
	/**
	 * Reads what a platform has counted on one meter.
	 *
	 * @param query - Which meter, for whom, over which window.
	 * @returns The quantity and its cost when the platform prices it.
	 */
	quantities(query: MeterQuantityQuery): Promise<Result<MeterQuantity, BillingError>>;
}

/**
 * One configured billing platform. Every operation hangs off the instance, so
 * a cron job with no request works the same way a route does, and a platform
 * that lacks an optional group leaves that property absent.
 *
 * @example
 * let checkout = await billing.checkouts.create({ product: "pro", customer, returnTo });
 * if (isFailure(checkout)) return serverError();
 * return redirect(checkout.data.url, { status: redirect.Status.SeeOther });
 */
export interface Billing {
	/**
	 * The configured credential set this instance bills against. It names an
	 * account, since a vendor can hold several, and it is the value stored beside
	 * every provider id we keep.
	 */
	readonly connection: string;

	readonly customers: CustomerApi;
	readonly catalog: CatalogApi;
	readonly checkouts: CheckoutApi;
	readonly subscriptions: SubscriptionApi;
	readonly entitlements: EntitlementApi;
	readonly orders: OrderApi;
	readonly webhooks: WebhookApi;

	/** Hosted billing management, present only on a platform that hosts a payer-facing page. */
	readonly portal?: PortalApi;

	/** Discount reads, present only on a platform whose API exposes its coupons. */
	readonly discounts?: DiscountApi;

	/** Consumption reporting, present only on a platform that accepts usage. */
	readonly usage?: UsageApi;

	/** Meter readings, present only on a platform that meters. */
	readonly meters?: MeterApi;

	/** The configured HTTP client, for what the contract does not model. */
	readonly native: unknown;
}
