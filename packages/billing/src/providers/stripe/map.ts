/**
 * The translation layer between Stripe's wire shapes and this package's models:
 * form encoding for request bodies, one status vocabulary per direction, and a
 * mapper per object. Nothing here talks HTTP, so every rule is unit-testable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BillingErrorCode } from "../../core/errors.js";
import type {
	Checkout,
	CheckoutStatus,
	Currency,
	Customer,
	EntitlementSubscription,
	Money,
	PortalSession,
	Price,
	PriceKind,
	Product,
	Subscription,
	SubscriptionStatus,
} from "../../core/types.js";

import { BillingError } from "../../core/errors.js";

import type {
	ExpandableId,
	StripeCheckoutSession,
	StripeCustomer,
	StripeErrorPayload,
	StripePortalSession,
	StripePrice,
	StripeProduct,
	StripeProductFeature,
	StripeSubscription,
} from "./schemas.js";

/** Media type Stripe accepts request bodies in. */
export const FORM_MEDIA_TYPE = "application/x-www-form-urlencoded";

/** Status at and above which Stripe reports a failure on its own side. */
const SERVER_ERROR_FLOOR = 500;

/** Header a rate-limited answer states the wait in. */
const RETRY_AFTER_HEADER = "Retry-After";

/** Milliseconds in a second, for the epoch seconds Stripe reports times in. */
const MS_PER_SECOND = 1000;

/** Quantity a line with no stated quantity charges for. */
const DEFAULT_QUANTITY = 1;

/**
 * What each response status means for a caller. A status at or above
 * {@link SERVER_ERROR_FLOOR} is deliberately absent: it resolves to `unknown`,
 * because the request may still have taken effect.
 */
const STATUS_CODES: Readonly<Record<number, BillingErrorCode>> = {
	400: "invalid_request",
	401: "unauthenticated",
	402: "invalid_request",
	403: "forbidden",
	404: "not_found",
	409: "conflict",
	429: "rate_limited",
};

/**
 * Stripe's own error codes that mean something more precise than their status
 * does: a reference to an object that is not there arrives as a `400`, and a
 * repeated idempotency key arrives as a `400` too.
 */
const PROVIDER_CODES: Readonly<Record<string, BillingErrorCode>> = {
	resource_missing: "not_found",
	resource_already_exists: "conflict",
	idempotency_key_in_use: "conflict",
	api_key_expired: "unauthenticated",
	rate_limit: "rate_limited",
};

/** Stripe's error families, read when neither the status nor the code decides. */
const ERROR_TYPES: Readonly<Record<string, BillingErrorCode>> = {
	api_error: "unknown",
	authentication_error: "unauthenticated",
	card_error: "invalid_request",
	idempotency_error: "conflict",
	invalid_request_error: "invalid_request",
	rate_limit_error: "rate_limited",
};

/**
 * Every Stripe subscription status in this package's vocabulary. A subscription
 * whose first payment expired and one Stripe paused both lose access outright,
 * so they report as revoked rather than as a cancellation with a paid tail.
 */
const SUBSCRIPTION_STATUSES: Readonly<Record<StripeSubscription["status"], SubscriptionStatus>> = {
	trialing: "trialing",
	active: "active",
	past_due: "past_due",
	canceled: "canceled",
	unpaid: "revoked",
	paused: "revoked",
	incomplete: "incomplete",
	incomplete_expired: "revoked",
};

/**
 * Which Stripe statuses one of ours covers, so a list narrows on Stripe's side
 * when the mapping is one-to-one and locally when several statuses share ours.
 */
export const STRIPE_STATUSES_FOR: Readonly<Record<SubscriptionStatus, readonly string[]>> = {
	trialing: ["trialing"],
	active: ["active"],
	past_due: ["past_due"],
	canceled: ["canceled"],
	revoked: ["unpaid", "paused", "incomplete_expired"],
	incomplete: ["incomplete"],
};

/** Statuses under which a customer still holds what they subscribed to. */
export const ENTITLED_STATUSES: ReadonlySet<SubscriptionStatus> = new Set<SubscriptionStatus>([
	"trialing",
	"active",
	"past_due",
]);

/** How a checkout session's state reads in this package's vocabulary. */
const CHECKOUT_STATUSES: Readonly<Record<string, CheckoutStatus>> = {
	open: "open",
	complete: "completed",
	expired: "expired",
};

/** A field of a Stripe request body, nested as deeply as the endpoint allows. */
export type FormValue =
	| string
	| number
	| boolean
	| readonly FormValue[]
	| FormFields
	| null
	| undefined;

/** A whole Stripe request body or query string, before it is encoded. */
export interface FormFields {
	readonly [key: string]: FormValue | undefined;
}

/** Reports whether a field holds a list, keeping its members typed as fields. */
function isFormList(value: FormValue): value is readonly FormValue[] {
	return Array.isArray(value);
}

/**
 * Writes one field, and everything nested under it, into the parameters. Nested
 * objects and arrays become bracketed paths, which is how Stripe reads
 * structure out of a flat form body.
 *
 * @param params - Parameters being built.
 * @param path - Bracketed path this value is written at.
 * @param value - The value to write; absent values are left out entirely.
 */
function appendField(params: URLSearchParams, path: string, value: FormValue): void {
	if (value === undefined || value === null) return;

	if (isFormList(value)) {
		value.forEach((entry, index) => appendField(params, `${path}[${index}]`, entry));
		return;
	}

	if (typeof value === "object") {
		for (let [key, entry] of Object.entries<FormValue | undefined>(value)) {
			appendField(params, path === "" ? key : `${path}[${key}]`, entry);
		}
		return;
	}

	params.append(path, String(value));
}

/**
 * Encodes a request body or query string the way Stripe reads them: flat
 * parameters whose names carry the nesting in brackets.
 *
 * @param fields - The body to encode; absent values are left out entirely.
 * @returns Parameters ready to send as the body or appended to the path.
 *
 * @example
 * formEncode({ line_items: [{ price: "price_1", quantity: 2 }] }).toString();
 */
export function formEncode(fields: FormFields): URLSearchParams {
	let params = new URLSearchParams();
	appendField(params, "", fields);
	return params;
}

/** Reads the id out of a reference, whether the request expanded it or not. */
export function idOf(reference: ExpandableId): string {
	return typeof reference === "string" ? reference : reference.id;
}

/** Reads the id out of a reference that may be absent. */
export function optionalIdOf(reference: ExpandableId | null | undefined): string | null {
	return reference === null || reference === undefined ? null : idOf(reference);
}

/** Turns the epoch seconds Stripe reports times in into a date. */
export function dateOf(seconds: number | null | undefined): Date | null {
	return seconds === null || seconds === undefined ? null : new Date(seconds * MS_PER_SECOND);
}

/**
 * Builds an amount from the integer minor units Stripe already reports, so a
 * zero-decimal currency stays a whole integer with no scaling applied.
 *
 * @param amount - Minor units as Stripe reported them.
 * @param currency - The amount's currency.
 */
export function moneyOf(
	amount: number | null | undefined,
	currency: Currency | null | undefined,
): Money | null {
	if (amount === null || amount === undefined) return null;
	if (currency === null || currency === undefined) return null;
	return { amount, currency };
}

/** Reads metadata as a map, since Stripe omits it on some payload shapes. */
function metadataOf(
	metadata: Readonly<Record<string, string>> | null | undefined,
): Record<string, string> {
	return { ...metadata };
}

/**
 * Names which failure a response describes, preferring Stripe's own code over
 * the status, since the API reports a missing reference and a reused
 * idempotency key with the same `400`.
 *
 * @param status - Status the response carried.
 * @param payload - Stripe's error envelope, when the body held one.
 */
export function codeFor(status: number, payload: StripeErrorPayload | null): BillingErrorCode {
	if (status >= SERVER_ERROR_FLOOR) return "unknown";

	let code = payload?.error.code;
	let byCode = code === undefined ? undefined : PROVIDER_CODES[code];
	if (byCode !== undefined) return byCode;

	let byStatus = STATUS_CODES[status];
	if (byStatus !== undefined) return byStatus;

	let type = payload?.error.type;
	let byType = type === undefined ? undefined : ERROR_TYPES[type];
	if (byType !== undefined) return byType;

	return "unknown";
}

/** Reads the seconds a rate-limited answer asks the caller to wait for. */
function retryAfterOf(headers: Headers): number | null {
	let stated = headers.get(RETRY_AFTER_HEADER);
	if (stated === null) return null;

	let seconds = Number(stated);

	return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Builds the failure a non-2xx response reports, keeping Stripe's own code for
 * the log line a support ticket quotes.
 *
 * @param response - The answer, for its status and the wait a rate limit states.
 * @param payload - Stripe's error envelope, when the body held one.
 * @param connection - The credential set the call was made against.
 */
export function errorFrom(
	response: Response,
	payload: StripeErrorPayload | null,
	connection: string,
): BillingError {
	let message = payload?.error.message ?? `Stripe answered ${response.status}`;

	return new BillingError(message, {
		code: codeFor(response.status, payload),
		connection,
		providerCode: payload?.error.code ?? payload?.error.type ?? null,
		retryAfter: retryAfterOf(response.headers),
	});
}

/** How a price charges: a fixed sale, a renewal, or metered consumption. */
export function priceKind(price: StripePrice): PriceKind {
	if (price.type === "one_time") return "one_time";

	let recurring = price.recurring;
	if (recurring?.meter !== null && recurring?.meter !== undefined) return "metered";
	if (recurring?.usage_type === "metered") return "metered";

	return "recurring";
}

/** What a caller needs to translate Stripe ids back into its own slugs. */
export interface SlugResolver {
	/** Our own name for what a price sells, or `null` when it is unconfigured. */
	slugForPrice(priceId: string): string | null;
	/** Our own name for a product, or `null` when it is unconfigured. */
	slugForProduct(productId: string): string | null;
	/** Our own name for a meter, or `null` when it is unconfigured. */
	slugForMeter(meterId: string): string | null;
}

/**
 * Maps a customer, reading our own identifier out of the metadata key it is
 * stored under, since Stripe holds no field of its own for it.
 *
 * @param payload - The customer as Stripe reported it.
 * @param externalIdKey - Metadata key our own identifier is stored under.
 */
export function toCustomer(payload: StripeCustomer, externalIdKey: string): Customer {
	let metadata = metadataOf(payload.metadata);
	let externalId = metadata[externalIdKey];

	return {
		id: payload.id,
		externalId: externalId ?? null,
		email: payload.email ?? null,
		name: payload.name ?? null,
		metadata,
		createdAt: new Date(payload.created * MS_PER_SECOND),
		providerData: {
			id: payload.id,
			currency: payload.currency ?? null,
			delinquent: payload.delinquent ?? null,
			livemode: payload.livemode ?? null,
		},
	};
}

/**
 * Maps one way to buy a product. A metered price reports no interval, since
 * what it charges follows consumption rather than the renewal clock.
 *
 * @param payload - The price as Stripe reported it.
 * @param resolver - Translates the price's meter back into our own slug.
 */
export function toPrice(payload: StripePrice, resolver: SlugResolver): Price {
	let kind = priceKind(payload);
	let meter = payload.recurring?.meter;

	return {
		id: payload.id,
		kind,
		interval: kind === "recurring" ? (payload.recurring?.interval ?? null) : null,
		amount: moneyOf(payload.unit_amount, payload.currency),
		meter: meter === null || meter === undefined ? null : resolver.slugForMeter(meter),
		providerData: {
			id: payload.id,
			active: payload.active ?? null,
			billingScheme: payload.billing_scheme ?? null,
			lookupKey: payload.lookup_key ?? null,
			livemode: payload.livemode ?? null,
		},
	};
}

/**
 * Assembles a product out of the three objects Stripe splits it across: the
 * product itself, the prices that reference it, and the features attached to
 * it, whose lookup keys are already the slugs an app asks about.
 *
 * @param payload - The product as Stripe reported it.
 * @param prices - Prices that reference the product.
 * @param features - Feature attachments the product carries.
 * @param slug - Our own name for it.
 * @param resolver - Translates a price's meter back into our own slug.
 */
export function toProduct(
	payload: StripeProduct,
	prices: readonly StripePrice[],
	features: readonly StripeProductFeature[],
	slug: string,
	resolver: SlugResolver,
): Product {
	let granted: Record<string, boolean> = {};
	for (let feature of features) granted[feature.entitlement_feature.lookup_key] = true;

	return {
		id: payload.id,
		slug,
		name: payload.name,
		description: payload.description ?? null,
		prices: prices.map((price) => toPrice(price, resolver)),
		features: granted,
		archived: !payload.active,
		createdAt: new Date(payload.created * MS_PER_SECOND),
		providerData: {
			id: payload.id,
			active: payload.active,
			livemode: payload.livemode ?? null,
		},
	};
}

/** Reads the discount a session applies, whichever of the two forms it took. */
function discountIdOf(payload: StripeCheckoutSession): string | null {
	let applied = payload.discounts?.at(0);
	if (applied === undefined) return null;

	return optionalIdOf(applied.promotion_code) ?? optionalIdOf(applied.coupon);
}

/**
 * Maps a checkout session. A session that is no longer open carries no hosted
 * URL, so `url` reads `null` once the customer has left the page.
 *
 * @param payload - The session as Stripe reported it.
 * @param slug - Our own name for what it sells.
 */
export function toCheckout(payload: StripeCheckoutSession, slug: string): Checkout {
	return {
		id: payload.id,
		url: payload.url ?? null,
		status: CHECKOUT_STATUSES[payload.status ?? "open"] ?? "open",
		productSlug: slug,
		customerId: optionalIdOf(payload.customer),
		customerExternalId: payload.client_reference_id ?? null,
		amount: moneyOf(payload.amount_total, payload.currency),
		discountId: discountIdOf(payload),
		subscriptionId: optionalIdOf(payload.subscription),
		orderId: optionalIdOf(payload.invoice),
		expiresAt: dateOf(payload.expires_at),
		createdAt: new Date(payload.created * MS_PER_SECOND),
		providerData: {
			id: payload.id,
			mode: payload.mode ?? null,
			paymentStatus: payload.payment_status ?? null,
			livemode: payload.livemode ?? null,
		},
	};
}

/** Maps a portal session, whose URL is single-use and states no expiry of its own. */
export function toPortalSession(payload: StripePortalSession): PortalSession {
	return {
		url: payload.url,
		expiresAt: null,
		providerData: {
			id: payload.id,
			configuration: optionalIdOf(payload.configuration),
			livemode: payload.livemode ?? null,
		},
	};
}

/**
 * Maps a subscription, reporting `null` when it bills a price outside the
 * configured catalog, which is the one case our own slug cannot be named.
 *
 * @param payload - The subscription as Stripe reported it.
 * @param resolver - Translates the subscribed price back into our own slug.
 */
export function toSubscription(
	payload: StripeSubscription,
	resolver: SlugResolver,
): Subscription | null {
	let item = payload.items.data.at(0);
	if (item === undefined) return null;

	let productId = item.price.product;

	let slug =
		resolver.slugForPrice(item.price.id) ??
		(productId === undefined ? null : resolver.slugForProduct(idOf(productId)));

	if (slug === null) return null;

	let kind = priceKind(item.price);
	let quantity = item.quantity ?? DEFAULT_QUANTITY;
	let unit = item.price.unit_amount;

	let periodStart = dateOf(item.current_period_start ?? payload.current_period_start);
	let periodEnd = dateOf(item.current_period_end ?? payload.current_period_end);

	let endsAt =
		dateOf(payload.ended_at) ??
		dateOf(payload.cancel_at) ??
		(payload.cancel_at_period_end ? periodEnd : null);

	return {
		id: payload.id,
		customerId: idOf(payload.customer),
		productSlug: slug,
		priceId: item.price.id,
		status: SUBSCRIPTION_STATUSES[payload.status],
		providerStatus: payload.status,
		amount:
			unit === null || unit === undefined ? null : moneyOf(unit * quantity, item.price.currency),
		interval: kind === "recurring" ? (item.price.recurring?.interval ?? null) : null,
		currentPeriodStart: periodStart,
		currentPeriodEnd: periodEnd,
		cancelAtPeriodEnd: payload.cancel_at_period_end,
		canceledAt: dateOf(payload.canceled_at),
		endsAt,
		metadata: metadataOf(payload.metadata),
		createdAt: new Date(payload.created * MS_PER_SECOND),
		providerData: {
			id: payload.id,
			collectionMethod: payload.collection_method ?? null,
			latestInvoice: optionalIdOf(payload.latest_invoice),
			livemode: payload.livemode ?? null,
			items: payload.items.data.map((entry) => ({
				id: entry.id,
				price: entry.price.id,
				quantity: entry.quantity ?? DEFAULT_QUANTITY,
			})),
		},
	};
}

/** Reduces a subscription to what an entitlement snapshot reports about it. */
export function toEntitlementSubscription(subscription: Subscription): EntitlementSubscription {
	return {
		subscriptionId: subscription.id,
		productSlug: subscription.productSlug,
		status: subscription.status,
		currentPeriodStart: subscription.currentPeriodStart,
		currentPeriodEnd: subscription.currentPeriodEnd,
		cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
	};
}
