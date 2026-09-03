/**
 * Vendor-neutral billing models: money, customers, catalog, subscriptions,
 * orders, entitlements, usage, and the normalized event union. Apps program
 * against these, so every call site speaks one vocabulary of our own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * ISO 4217 alphabetic code, lowercase, as every platform in scope spells it.
 * How many decimals it has comes from {@link minorUnitDigits}, since a minor
 * unit runs from zero to three decimals depending on the currency.
 */
export type Currency = string;

/**
 * Currencies whose minor unit differs from the ISO 4217 default of two
 * decimals. Anything absent from the table has two.
 */
const MINOR_UNIT_EXCEPTIONS: Readonly<Record<string, number>> = {
	bhd: 3,
	bif: 0,
	clp: 0,
	djf: 0,
	gnf: 0,
	iqd: 3,
	isk: 0,
	jod: 3,
	jpy: 0,
	kmf: 0,
	krw: 0,
	kwd: 3,
	lyd: 3,
	omr: 3,
	pyg: 0,
	rwf: 0,
	tnd: 3,
	ugx: 0,
	uyw: 4,
	vnd: 0,
	vuv: 0,
	xaf: 0,
	xof: 0,
	xpf: 0,
};

/** Two decimals, the ISO 4217 default for any currency outside the exception table. */
const DEFAULT_MINOR_UNIT_DIGITS = 2;

/**
 * How many decimal places one unit of a currency divides into, so a caller
 * formats and a provider converts from the table.
 *
 * @param currency - ISO 4217 alphabetic code, in any letter case.
 * @returns Digits after the decimal separator: 0 for JPY, 3 for KWD, 2 otherwise.
 *
 * @example
 * minorUnitDigits("jpy"); // 0
 */
export function minorUnitDigits(currency: Currency): number {
	return MINOR_UNIT_EXCEPTIONS[currency.toLowerCase()] ?? DEFAULT_MINOR_UNIT_DIGITS;
}

/** An amount a customer is charged, carried as an integer so no rounding happens in transit. */
export interface Money {
	/** Minor units, always an integer: 500 is five dollars, 500 is also five hundred yen. */
	amount: number;
	currency: Currency;
}

/**
 * A usage cost, kept as a decimal string because per-unit infrastructure costs
 * fall below `1e-6`, where a number switches to exponential notation and a
 * platform's parser rejects it.
 */
export interface Cost {
	/** Minor units as a plain decimal string, e.g. `"0.003476700"`. */
	amount: string;
	currency: Currency;
}

/** Someone who can be billed, as the platform holds them. */
export interface Customer {
	id: string;
	/** Our own identifier, set at creation and the join key across providers. */
	externalId: string | null;
	/** Address on file; `null` on a platform that holds a payer without one. */
	email: string | null;
	name: string | null;
	metadata: Record<string, string>;
	createdAt: Date;
	/** The provider's own payload for this object. Never interpreted here. */
	providerData: Readonly<Record<string, unknown>>;
}

/**
 * How a call names a customer. A union, so a call naming neither identifier is
 * a type error the compiler reports. A provider whose platform stores no
 * external identifier answers `unsupported` for the `externalId` arm, so an app
 * on such a platform keeps the subject-to-provider-id mapping in its own table
 * and names the customer by `id`.
 */
export type CustomerRef = { id: string } | { externalId: string };

/** How often a price recurs; `null` bills once. */
export type BillingInterval = "day" | "week" | "month" | "year";

/** What a price charges for: a fixed amount, a recurring amount, or metered consumption. */
export type PriceKind = "one_time" | "recurring" | "metered";

/** One way to buy a product, as the platform's catalog defines it. */
export interface Price {
	id: string;
	kind: PriceKind;
	/** How often a recurring price renews; `null` for a one-time or metered price. */
	interval: BillingInterval | null;
	/** Fixed amount charged per period; `null` when the price is metered or free. */
	amount: Money | null;
	/** Meter this price consumes, addressed by our own slug; `null` unless metered. */
	meter: string | null;
	providerData: Readonly<Record<string, unknown>>;
}

/**
 * Something for sale, addressed by our own slug so no platform product id
 * reaches a call site. Products are read-only here: they are created in the
 * platform's dashboard.
 */
export interface Product {
	id: string;
	/** Our own name for it, the key a provider is configured with. */
	slug: string;
	name: string;
	description: string | null;
	prices: Price[];
	/** Entitlement flags this product grants, keyed by our own feature slugs. */
	features: Readonly<Record<string, boolean>>;
	archived: boolean;
	createdAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}

/**
 * Our vocabulary for where a subscription stands. A platform status that maps
 * to none of these is a provider mapping failure, so no unmapped value is ever
 * written through as if it were ours.
 */
export type SubscriptionStatus =
	| "trialing"
	| "active"
	| "past_due"
	| "canceled"
	| "revoked"
	| "incomplete";

/**
 * A recurring purchase. It comes into existence when a checkout completes and
 * an app learns of it from an event, so nothing here creates one.
 */
export interface Subscription {
	id: string;
	/** Who holds it; `null` when the platform reports no payer on the record. */
	customerId: string | null;
	/** Our own name for what was bought; `null` when no configured slug maps to it. */
	productSlug: string | null;
	priceId: string | null;
	status: SubscriptionStatus;
	/**
	 * The platform's own status, kept beside ours so every platform state has
	 * somewhere to live and a support ticket can quote the one it saw.
	 */
	providerStatus: string;
	amount: Money | null;
	interval: BillingInterval | null;
	currentPeriodStart: Date | null;
	/** End of the paid period, and the date derived state is computed against. */
	currentPeriodEnd: Date | null;
	/** Whether the platform will stop renewing at the end of the current period. */
	cancelAtPeriodEnd: boolean;
	canceledAt: Date | null;
	/** When access actually stops; a canceled subscription keeps it until then. */
	endsAt: Date | null;
	metadata: Record<string, string>;
	createdAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}

/** A paid purchase, whether it came from a one-time sale or a subscription period. */
export interface Order {
	id: string;
	/** Who paid; `null` when the platform reports no payer on the record. */
	customerId: string | null;
	/**
	 * The buyer's address, as the paid record carries it, so fulfilling a sale
	 * needs no second read; `null` when the platform names none.
	 */
	customerEmail: string | null;
	/** Our own identifier for the buyer; `null` when the record carries none. */
	customerExternalId: string | null;
	/** Our own name for what was bought; `null` when the platform reports no product. */
	productSlug: string | null;
	subscriptionId: string | null;
	/** What the customer was charged, tax included. */
	total: Money;
	subtotal: Money;
	tax: Money | null;
	discountId: string | null;
	paid: boolean;
	/** How much of the total has been refunded so far; `null` when nothing was. */
	refunded: Money | null;
	createdAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}

/** Where a hosted checkout stands. */
export type CheckoutStatus = "open" | "completed" | "expired" | "failed";

/**
 * A hosted checkout session. `url` is the page a customer is redirected to and
 * the route owns that redirect, so a route reading a session back checks for a
 * page before it redirects.
 */
export interface Checkout {
	id: string;
	/** Page to send the customer to; `null` once the session is no longer payable. */
	url: string | null;
	status: CheckoutStatus;
	/** Our own name for what is being bought; `null` when no configured slug maps to it. */
	productSlug: string | null;
	customerId: string | null;
	/** Our own identifier for the buyer, when the checkout was opened with one. */
	customerExternalId: string | null;
	/** What the customer will pay, discount applied; `null` when the platform decides at pay time. */
	amount: Money | null;
	discountId: string | null;
	/** Subscription the completed checkout produced, once the platform reports one. */
	subscriptionId: string | null;
	/** Order the completed checkout produced, once the platform reports one. */
	orderId: string | null;
	expiresAt: Date | null;
	createdAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}

/** A hosted billing-management session, which is where plan changes happen. */
export interface PortalSession {
	url: string;
	expiresAt: Date | null;
	providerData: Readonly<Record<string, unknown>>;
}

/** Whether a discount takes a share of the price or a flat amount off it. */
export type DiscountKind = "percentage" | "fixed";

/** A price reduction a checkout can be opened with. */
export interface Discount {
	id: string;
	/** What a customer types at checkout; `null` for a discount applied by id only. */
	code: string | null;
	name: string;
	kind: DiscountKind;
	/** Whole percent taken off, 1 to 100; `null` for a fixed-amount discount. */
	percentage: number | null;
	/** Flat amount taken off; `null` for a percentage discount. */
	amount: Money | null;
	/** Products it applies to, by our own slugs; empty means every product. */
	productSlugs: string[];
	/** Redemptions allowed in total; `null` is unlimited. */
	maxRedemptions: number | null;
	redemptions: number;
	startsAt: Date | null;
	endsAt: Date | null;
	createdAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}

/** How much of a meter a customer has consumed and has left. */
export interface MeterBalance {
	/** Our own name for the meter. */
	meter: string;
	credited: number;
	consumed: number;
	/** Credited minus consumed, which is what a limit check compares against. */
	balance: number;
}

/** One active subscription as the entitlement snapshot reports it. */
export interface EntitlementSubscription {
	subscriptionId: string;
	/** Our own name for what was bought; `null` when no configured slug maps to it. */
	productSlug: string | null;
	status: SubscriptionStatus;
	/**
	 * Start of the paid period, which is what a projection dates a period's usage
	 * from. Every provider fills it; it stays optional so an app writing a
	 * snapshot of its own states only what it holds.
	 */
	currentPeriodStart?: Date | null;
	currentPeriodEnd: Date | null;
	cancelAtPeriodEnd: boolean;
}

/**
 * Everything a customer has right now, in one read. It is the sync primitive:
 * an app writes this into its own tables and requests read those, so the
 * platform stays off the request path.
 */
export interface EntitlementState {
	/** Who the snapshot is about; `null` when the platform names no payer record. */
	customerId: string | null;
	externalId: string | null;
	/** Products the customer currently holds, by our own slugs. */
	products: string[];
	/** Feature flags the held products grant, keyed by our own feature slugs. */
	features: Readonly<Record<string, boolean>>;
	meters: MeterBalance[];
	subscriptions: EntitlementSubscription[];
	/** When the platform answered, so a projection can record how fresh it is. */
	readAt: Date;
	providerData: Readonly<Record<string, unknown>>;
}

/** Metadata values a platform accepts on an ingested usage event. */
export type UsageMetadata = Record<string, string | number | boolean>;

/** One consumption event, as a caller reports it. */
export interface UsageEvent {
	/** Meter this counts against, by our own slug. */
	name: string;
	customer: CustomerRef;
	/** Idempotency key; a resent event with the same value is counted once. */
	externalId?: string;
	/** When it happened; omitted means the moment of ingestion. */
	timestamp?: Date;
	metadata?: UsageMetadata;
	cost?: Cost;
}

/** A usage event as the platform stored it, which is what a read-back returns. */
export interface UsageRecord {
	id: string;
	name: string;
	customerId: string | null;
	customerExternalId: string | null;
	/** The idempotency key the event was ingested with, when it carried one. */
	externalId: string | null;
	timestamp: Date;
	metadata: UsageMetadata;
	cost: Cost | null;
	providerData: Readonly<Record<string, unknown>>;
}

/** What a platform has counted on one meter, over the window it was asked about. */
export interface MeterQuantity {
	meter: string;
	customerId: string | null;
	quantity: number;
	cost: Cost | null;
	from: Date | null;
	to: Date | null;
	providerData: Readonly<Record<string, unknown>>;
}

/** What the accepted deliveries in one ingest call amount to. */
export interface UsageIngest {
	/** Events the platform took; a resend of an already-counted key is excluded. */
	accepted: number;
}

/**
 * What a delivery is about, in our vocabulary. An authentic delivery outside
 * this vocabulary arrives as `unrecognized` carrying its payload, so a handler
 * can still reach what it needs.
 */
export type BillingEventPayload =
	| { type: "customer.created" | "customer.updated"; customer: Customer }
	| { type: "checkout.completed"; checkout: Checkout }
	| {
			type:
				| "subscription.activated"
				| "subscription.updated"
				| "subscription.canceled"
				| "subscription.revoked";
			subscription: Subscription;
	  }
	| { type: "order.paid"; order: Order }
	| { type: "order.refunded"; order: Order }
	| { type: "unrecognized"; providerType: string };

/**
 * A normalized delivery. `raw` travels on every event, so a platform-specific
 * handler and a normalized one can coexist.
 */
export type BillingEvent = { id: string; raw: unknown } & BillingEventPayload;

/**
 * Items a list answers with when a caller names no limit. Shared by every
 * provider so the same call returns the same amount of work whichever platform
 * is configured, rather than inheriting each platform's own default.
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * One page of results, with the cursor that asks for the next one. Lists hand
 * back a page rather than a whole collection, so a caller wanting one page asks
 * for exactly that and a platform's own limits stay visible.
 */
export interface Page<T> {
	items: T[];
	/**
	 * Cursor for the following page; `null` on the last one. A page holding fewer
	 * than `limit` items is not necessarily the last, because a provider filtering
	 * a platform page client-side shortens it: keep following the cursor.
	 */
	cursor: string | null;
}
