/**
 * Everything that turns a validated Mercado Pago payload into one of our own
 * models, plus the normalization tables the platform's vocabularies are read
 * through. Mapping lives apart from the client so a payload shape can be
 * asserted without a request, and so every status is normalized in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import type { BillingErrorCode } from "../../core/errors";
import type {
	BillingInterval,
	Checkout,
	CheckoutStatus,
	Currency,
	Customer,
	Money,
	Order,
	Price,
	Product,
	Subscription,
	SubscriptionStatus,
} from "../../core/types";

import { BillingError } from "../../core/errors";

import type { MercadoPagoCatalog, MercadoPagoOneTimeProduct } from "./catalog";
import type {
	CustomerPayload,
	ErrorPayload,
	PaymentPayload,
	PreapprovalPayload,
	PreapprovalPlanPayload,
	PreferencePayload,
} from "./schemas";

import { toMajorUnits, toMinorUnits } from "./money";

/** Raw payload kept beside every model, which the package stores and never reads. */
export type ProviderData = Readonly<Record<string, unknown>>;

/** Where our own subject id is written on a stored payer, and read back from. */
export const EXTERNAL_REFERENCE_KEY = "external_reference";

/** Where a hosted checkout carries the slug that opened it, and reads it back. */
export const PRODUCT_SLUG_KEY = "product_slug";

/** Where a hosted checkout carries the buyer's platform id, for a completed sale. */
export const CUSTOMER_ID_KEY = "customer_id";

/** Where a charge names the subscription authorization that produced it. */
export const PREAPPROVAL_KEY = "preapproval_id";

/** Currency the platform reports on a resource that priced nothing. */
const UNPRICED = null;

/**
 * How an HTTP status becomes a normalized code. A `5xx` is absent on purpose:
 * it resolves to `unknown`, because the platform may have applied the write
 * before it stopped answering.
 */
/** Header a rate-limited answer states the wait in. */
const RETRY_AFTER_HEADER = "Retry-After";

const STATUS_CODES: Readonly<Record<number, BillingErrorCode>> = {
	400: "invalid_request",
	401: "unauthenticated",
	403: "forbidden",
	404: "not_found",
	405: "invalid_request",
	406: "invalid_request",
	409: "conflict",
	415: "invalid_request",
	422: "invalid_request",
	429: "rate_limited",
};

/**
 * Subscription statuses in the platform's own vocabulary, mapped to ours as
 * data so a status the platform adds shows up as a missing key rather than
 * falling through a branch.
 *
 * `paused` is the state a subscription enters once its retries are exhausted,
 * which is a payment that has not been made rather than a subscription that
 * has ended.
 */
const SUBSCRIPTION_STATUSES: Readonly<Record<string, SubscriptionStatus>> = {
	pending: "incomplete",
	authorized: "active",
	paused: "past_due",
	canceled: "canceled",
	cancelled: "canceled",
};

/** The platform's own words for a subscription that has ended, which it spells two ways. */
const CANCELED_SUBSCRIPTION: ReadonlySet<string> = new Set(["canceled", "cancelled"]);

/** The status a stored plan reports once it stops being sellable. */
const CANCELED_PLAN = "canceled";

/** The status a subscription reports once its payment method is valid. */
const AUTHORIZED_SUBSCRIPTION = "authorized";

/** Payment statuses where the outcome is still moving. */
const PROCESSING_PAYMENTS: ReadonlySet<string> = new Set([
	"pending",
	"authorized",
	"in_process",
	"in_mediation",
]);

/** Payment statuses where the money has been collected. */
const SUCCEEDED_PAYMENTS: ReadonlySet<string> = new Set(["approved"]);

/**
 * Payment statuses where the money will not be collected, or has gone back.
 * Both spellings of a cancelled charge are here because the payments resource
 * and the order resource spell it differently.
 */
const FAILED_PAYMENTS: ReadonlySet<string> = new Set([
	"rejected",
	"cancelled",
	"canceled",
	"refunded",
	"charged_back",
]);

/**
 * How a recurrence cadence is spelled, mapped to ours. The platform pluralizes
 * its own names and accepts only these two cadences.
 */
const INTERVALS: Readonly<Record<string, BillingInterval>> = {
	days: "day",
	months: "month",
};

/** Cadence multiplier that keeps a plan's interval expressible as one of ours. */
const SINGLE_PERIOD = 1;

/** Days one month of a monthly plan is charged over, for the twelve-month cadence. */
const MONTHS_PER_YEAR = 12;

/**
 * Whether a payment has settled, so a caller reads one boolean instead of the
 * platform's nine statuses.
 *
 * @param status - The platform's own payment status.
 * @returns Whether the money has been collected.
 */
export function isPaid(status: string): boolean {
	return SUCCEEDED_PAYMENTS.has(status);
}

/**
 * Whether a payment's outcome is still moving, which is what separates a sale
 * still in flight from one that will not happen.
 *
 * @param status - The platform's own payment status.
 * @returns Whether the platform has yet to decide.
 */
export function isProcessing(status: string): boolean {
	return PROCESSING_PAYMENTS.has(status);
}

/**
 * Whether a payment will not be collected, or has been given back.
 *
 * @param status - The platform's own payment status.
 * @returns Whether the sale is over without money staying collected.
 */
export function isFailed(status: string): boolean {
	return FAILED_PAYMENTS.has(status);
}

/**
 * Reads the platform's own code out of a failure body, preferring the numeric
 * cause a support ticket is opened against over the coarse family name.
 */
function providerCodeOf(body: ErrorPayload | null): string | null {
	let cause = body?.cause;

	let first = Array.isArray(cause) ? cause.at(0) : cause;
	if (first?.code !== null && first?.code !== undefined) return first.code;

	return body?.code ?? body?.error ?? null;
}

/**
 * Turns a failed response into the one failure type every method reports. A
 * status the table does not name resolves to `unknown`, so an outcome nobody
 * can determine is never presented as a refusal.
 *
 * @param response - The answer, for its status and the wait a rate limit states.
 * @param body - The parsed failure body, or `null` when it was unreadable.
 * @param connection - The credential set the call was made against.
 * @returns The normalized failure.
 */
export function errorFrom(
	response: Response,
	body: ErrorPayload | null,
	connection: string,
): BillingError {
	let stated = response.headers.get(RETRY_AFTER_HEADER);
	let seconds = stated === null ? Number.NaN : Number(stated);
	let code = STATUS_CODES[response.status] ?? "unknown";
	let message = body?.message ?? body?.error ?? `Mercado Pago answered ${response.status}`;

	return new BillingError(message, {
		code,
		connection,
		providerCode: providerCodeOf(body),
		retryAfter: Number.isFinite(seconds) ? seconds : null,
	});
}

/**
 * Reads a value out of a platform metadata bag, which round-trips arbitrary
 * JSON and so may hold anything under a key we wrote a string to.
 */
function metadataString(
	metadata: Record<string, unknown> | null | undefined,
	key: string,
): string | null {
	let value = metadata?.[key];

	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Narrows a metadata bag to the string entries our models carry, dropping
 * anything the platform stored under a non-string value.
 */
function metadataOf(metadata: Record<string, unknown> | null | undefined): Record<string, string> {
	let entries: Record<string, string> = {};

	for (let [key, value] of Object.entries(metadata ?? {})) {
		if (typeof value === "string") entries[key] = value;
	}

	return entries;
}

/** Joins the two name fields the platform keeps into the one our models carry. */
function nameOf(payload: CustomerPayload): string | null {
	let name = [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim();

	return name.length > 0 ? name : null;
}

/**
 * Maps a stored payer into our customer model. Our own subject id travels in
 * the payer's metadata, with the description as the fallback the platform's own
 * dashboard shows.
 *
 * @param payload - The validated payer.
 * @param raw - The payload as received, kept for `providerData`.
 * @returns The customer.
 */
export function customerFrom(payload: CustomerPayload, raw: ProviderData): Customer {
	return {
		id: payload.id,
		externalId:
			metadataString(payload.metadata, EXTERNAL_REFERENCE_KEY) ?? payload.description ?? null,
		email: payload.email,
		name: nameOf(payload),
		metadata: metadataOf(payload.metadata),
		createdAt: payload.date_created ?? payload.date_registered ?? new Date(),
		providerData: raw,
	};
}

/**
 * Maps a plan's cadence onto ours. A cadence the platform expresses as a
 * multiple of months resolves to the equivalent single period where one
 * exists, so a twelve-month plan reads as yearly.
 */
function intervalFrom(
	frequency: number | null | undefined,
	frequencyType: string | null | undefined,
): BillingInterval | null {
	let interval = INTERVALS[frequencyType ?? ""];
	if (interval === undefined) return null;

	if (interval === "month" && frequency === MONTHS_PER_YEAR) return "year";
	if (frequency !== null && frequency !== undefined && frequency !== SINGLE_PERIOD) return null;

	return interval;
}

/**
 * Prices a configured one-time product. The amount is configuration because a
 * hosted checkout carries its line items inline and the platform keeps no
 * object to read a price back from.
 *
 * @param slug - Our own name for the product.
 * @param product - What the slug was configured to sell.
 * @returns The product, whose single price is the configured amount.
 */
export function productFromConfig(slug: string, product: MercadoPagoOneTimeProduct): Product {
	let price: Price = {
		id: slug,
		kind: "one_time",
		interval: null,
		amount: product.price,
		meter: null,
		providerData: {},
	};

	return {
		id: slug,
		slug,
		name: product.name,
		description: product.description ?? null,
		prices: [price],
		features: product.features ?? {},
		archived: false,
		createdAt: new Date(0),
		providerData: {},
	};
}

/**
 * Maps a stored plan into our product model, which is the one catalog read
 * whose price comes from the platform rather than from configuration.
 *
 * @param slug - Our own name for the plan.
 * @param payload - The validated plan.
 * @param raw - The payload as received, kept for `providerData`.
 * @param fallback - Name, description, and features from the configuration.
 * @returns The product, priced by the plan's recurring amount.
 */
export function productFromPlan(
	slug: string,
	payload: PreapprovalPlanPayload,
	raw: ProviderData,
	fallback: { name?: string; description?: string; features?: Record<string, boolean> },
): Product {
	let recurring = payload.auto_recurring;
	let amount =
		recurring?.transaction_amount !== null && recurring?.transaction_amount !== undefined
			? toMinorUnits(recurring.transaction_amount, recurring.currency_id ?? "")
			: UNPRICED;

	let price: Price = {
		id: payload.id,
		kind: "recurring",
		interval: intervalFrom(recurring?.frequency, recurring?.frequency_type),
		amount,
		meter: null,
		providerData: raw,
	};

	return {
		id: payload.id,
		slug,
		name: payload.reason ?? fallback.name ?? slug,
		description: fallback.description ?? null,
		prices: [price],
		features: fallback.features ?? {},
		archived: payload.status === CANCELED_PLAN,
		createdAt: payload.date_created ?? new Date(0),
		providerData: raw,
	};
}

/** Adds up what a hosted page will charge, across every line it carries. */
function preferenceTotal(payload: PreferencePayload): Money | null {
	let items = payload.items ?? [];
	let currency = items.at(0)?.currency_id;
	if (currency === null || currency === undefined) return UNPRICED;

	let major = 0;
	for (let item of items) major += (item.unit_price ?? 0) * (item.quantity ?? 1);

	return toMinorUnits(major, currency);
}

/**
 * Maps a hosted one-time checkout into our model. Whether it has been paid is
 * not on the object, so a freshly read session reads as open until its
 * expiration passes or a payment lookup says otherwise.
 *
 * @param id - Our own identifier for the session, which names which flow it is.
 * @param payload - The validated preference.
 * @param raw - The payload as received, kept for `providerData`.
 * @param url - The hosted page to send the buyer to.
 * @param settled - The order a payment lookup found, when one has been made.
 * @returns The checkout.
 */
export function checkoutFromPreference(
	id: string,
	payload: PreferencePayload,
	raw: ProviderData,
	url: string,
	settled?: { status: CheckoutStatus; orderId: string | null },
): Checkout {
	let expiresAt = payload.expiration_date_to ?? null;
	let expired =
		payload.preference_expired === true ||
		(expiresAt !== null && expiresAt.getTime() <= Date.now());

	return {
		id,
		url,
		status: settled?.status ?? (expired ? "expired" : "open"),
		productSlug: metadataString(payload.metadata, PRODUCT_SLUG_KEY),
		customerId: metadataString(payload.metadata, CUSTOMER_ID_KEY),
		customerExternalId: payload.external_reference ?? null,
		amount: preferenceTotal(payload),
		discountId: null,
		subscriptionId: null,
		orderId: settled?.orderId ?? null,
		expiresAt,
		createdAt: payload.date_created ?? new Date(),
		providerData: raw,
	};
}

/**
 * Where a subscription authorization stands, in the vocabulary a checkout uses.
 * A cancelled authorization is a session the payer will never complete, which
 * is what `failed` names, while any other state is a window that has closed.
 */
function preapprovalCheckoutStatus(status: string): CheckoutStatus {
	if (status === "pending") return "open";
	if (status === "authorized") return "completed";
	if (status === "cancelled") return "failed";

	return "expired";
}

/**
 * Maps a subscription authorization into our checkout model, which is the
 * recurring half of a hosted purchase: the payer authorizes on the platform's
 * page and the subscription exists from that moment.
 *
 * @param id - Our own identifier for the session, which names which flow it is.
 * @param slug - Our own name for the plan being subscribed to.
 * @param payload - The validated authorization.
 * @param raw - The payload as received, kept for `providerData`.
 * @param url - The hosted page to send the payer to.
 * @returns The checkout.
 */
export function checkoutFromPreapproval(
	id: string,
	slug: string,
	payload: PreapprovalPayload,
	raw: ProviderData,
	url: string,
): Checkout {
	let recurring = payload.auto_recurring;
	let amount =
		recurring?.transaction_amount !== null && recurring?.transaction_amount !== undefined
			? toMinorUnits(recurring.transaction_amount, recurring.currency_id ?? "")
			: UNPRICED;

	return {
		id,
		url,
		status: preapprovalCheckoutStatus(payload.status),
		productSlug: slug,
		customerId: payload.payer_id ?? null,
		customerExternalId: payload.external_reference ?? null,
		amount,
		discountId: null,
		subscriptionId: payload.status === AUTHORIZED_SUBSCRIPTION ? payload.id : null,
		orderId: null,
		expiresAt: recurring?.end_date ?? null,
		createdAt: payload.date_created ?? new Date(),
		providerData: raw,
	};
}

/**
 * Maps a subscription authorization into our subscription model.
 *
 * @param payload - The validated authorization.
 * @param raw - The payload as received, kept for `providerData`.
 * @param catalog - The configured catalog, which names the plan behind it.
 * @param connection - The credential set the read was made against.
 * @returns The subscription, or a failure when the platform reported a status
 * or a plan this provider has no mapping for.
 */
export function subscriptionFrom(
	payload: PreapprovalPayload,
	raw: ProviderData,
	catalog: MercadoPagoCatalog,
	connection: string,
): Result<Subscription, BillingError> {
	let status = SUBSCRIPTION_STATUSES[payload.status];
	if (status === undefined) {
		return failure(
			new BillingError(`unmapped subscription status: ${payload.status}`, {
				code: "invalid_response",
				connection,
				providerCode: payload.status,
			}),
		);
	}

	let slug = catalog.slugForPlan(payload.preapproval_plan_id);
	if (slug === null) {
		return failure(
			new BillingError(`no configured slug for plan ${payload.preapproval_plan_id ?? "none"}`, {
				code: "invalid_response",
				connection,
			}),
		);
	}

	let recurring = payload.auto_recurring;
	let amount =
		recurring?.transaction_amount !== null && recurring?.transaction_amount !== undefined
			? toMinorUnits(recurring.transaction_amount, recurring.currency_id ?? "")
			: UNPRICED;

	let canceled = CANCELED_SUBSCRIPTION.has(payload.status);
	let trialing =
		(recurring?.free_trial ?? null) !== null && (payload.summarized?.charged_quantity ?? 0) === 0;

	return success({
		id: payload.id,
		customerId: payload.payer_id ?? null,
		productSlug: slug,
		priceId: payload.preapproval_plan_id ?? null,
		status: trialing && status === "active" ? "trialing" : status,
		providerStatus: payload.status,
		amount,
		interval: intervalFrom(recurring?.frequency, recurring?.frequency_type),
		currentPeriodStart: payload.summarized?.last_charged_date ?? recurring?.start_date ?? null,
		currentPeriodEnd: payload.next_payment_date ?? null,
		cancelAtPeriodEnd: false,
		canceledAt: canceled ? (payload.last_modified ?? null) : null,
		endsAt: canceled ? (payload.last_modified ?? null) : (recurring?.end_date ?? null),
		metadata: {},
		createdAt: payload.date_created ?? new Date(),
		providerData: raw,
	});
}

/** The currency a payment is denominated in, lowercased as our models spell it. */
function paymentCurrency(payload: PaymentPayload): Currency {
	return (payload.currency_id ?? "").toLowerCase();
}

/**
 * Maps a charge into our order model. A charge is the only paid object the
 * platform reports, so a one-time sale and a subscription's period both arrive
 * here and are told apart by whether a subscription authorized the charge.
 *
 * @param payload - The validated charge.
 * @param raw - The payload as received, kept for `providerData`.
 * @param catalog - The configured catalog, which names the plan behind a recurring charge.
 * @returns The order.
 */
export function orderFrom(
	payload: PaymentPayload,
	raw: ProviderData,
	catalog: MercadoPagoCatalog,
): Order {
	let currency = paymentCurrency(payload);
	let total = toMinorUnits(payload.transaction_amount ?? 0, currency);
	let taxes = payload.taxes_amount ?? 0;
	let refunded = payload.transaction_amount_refunded ?? 0;

	return {
		id: payload.id,
		customerId: payload.payer?.id ?? null,
		productSlug:
			metadataString(payload.metadata, PRODUCT_SLUG_KEY) ??
			catalog.slugForPlan(metadataString(payload.metadata, PREAPPROVAL_KEY)),
		subscriptionId: metadataString(payload.metadata, PREAPPROVAL_KEY),
		total,
		subtotal: toMinorUnits((payload.transaction_amount ?? 0) - taxes, currency),
		tax: taxes > 0 ? toMinorUnits(taxes, currency) : null,
		discountId: null,
		paid: isPaid(payload.status),
		refunded: refunded > 0 ? toMinorUnits(refunded, currency) : null,
		createdAt: payload.date_approved ?? payload.date_created ?? new Date(),
		providerData: raw,
	};
}

/**
 * Renders the line items a hosted one-time checkout is opened with, which is
 * where a minor-unit amount becomes the decimal the API prices in.
 *
 * @param slug - Our own name for what is being sold, carried as the line's id.
 * @param product - What the slug was configured to sell.
 * @param quantity - Units to charge for.
 * @returns The `items` array of a preference body.
 */
export function itemsFor(
	slug: string,
	product: MercadoPagoOneTimeProduct,
	quantity: number,
): Array<Record<string, unknown>> {
	return [
		{
			id: slug,
			title: product.name,
			description: product.description,
			quantity,
			unit_price: toMajorUnits(product.price),
			currency_id: product.price.currency.toUpperCase(),
		},
	];
}
