/**
 * Every response shape this provider reads, declared as `remix/data-schema`
 * schemas so a payload is validated before any of it reaches our own models.
 * The API leaves most fields optional and sends `null` freely, so the schemas
 * are permissive about absence and strict about the types they do accept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

/**
 * Accepts a field the API may omit or send as `null`, which is how most of its
 * optional fields behave, so one wrapper covers both.
 *
 * @param schema - Schema the present value must satisfy.
 * @returns A schema whose output adds `null` and `undefined`.
 */
function maybe<Output>(
	schema: Schema<unknown, Output>,
): Schema<unknown, Output | null | undefined> {
	return s.optional(s.nullable(schema));
}

/**
 * A timestamp as the API writes it: ISO 8601 carrying a site's own UTC offset,
 * parsed here so no mapper handles a string date.
 */
const Timestamp = s
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO 8601 timestamp")
	.transform((value) => new Date(value));

/** Identifiers arrive as strings on some resources and as numbers on others. */
const Identifier = coerce.string();

/** Free-form maps the API round-trips, kept as-is rather than typed per resource. */
const Metadata = s.record(s.string(), s.any());

/**
 * The offset envelope every search endpoint wraps its results in, which is
 * what an opaque cursor is derived from.
 */
export const Paging = s.object({
	total: s.number(),
	limit: s.number(),
	offset: s.number(),
});

/**
 * The envelope every search endpoint answers with, whose results stay
 * unvalidated here so each one can be parsed on its own and keep the exact
 * payload our models carry as `providerData`. An absent envelope means the
 * results are the whole set.
 */
export const SearchBody = s.object({
	paging: maybe(Paging),
	results: s.array(s.record(s.string(), s.any())),
});

/**
 * A failure body. Four shapes are in use across the API and they agree only on
 * keying their prose on `message`: `status` arrives as a string on some
 * endpoints and a number on others, a `cause` entry names its prose `message`
 * on one family and `description` on another, and the gateway's own refusals
 * carry a top-level `code` instead of a `cause` at all.
 */
export const ErrorBody = s.object({
	message: maybe(s.string()),
	error: maybe(s.string()),
	code: maybe(Identifier),
	status: maybe(coerce.number()),
	cause: maybe(
		s.union([
			s.array(
				s.object({
					code: maybe(Identifier),
					message: maybe(s.string()),
					description: maybe(s.string()),
				}),
			),
			s.object({
				code: maybe(Identifier),
				message: maybe(s.string()),
				description: maybe(s.string()),
			}),
		]),
	),
});

/** A stored payer, which is the closest record the platform keeps to a customer. */
export const CustomerBody = s.object({
	id: Identifier,
	email: s.string(),
	first_name: maybe(s.string()),
	last_name: maybe(s.string()),
	description: maybe(s.string()),
	metadata: maybe(Metadata),
	date_created: maybe(Timestamp),
	date_registered: maybe(Timestamp),
	live_mode: maybe(s.boolean()),
});

/** One line of a hosted checkout, priced inline because the platform stores no product. */
export const PreferenceItem = s.object({
	id: maybe(Identifier),
	title: maybe(s.string()),
	description: maybe(s.string()),
	quantity: maybe(s.number()),
	unit_price: maybe(s.number()),
	currency_id: maybe(s.string()),
});

/** A hosted one-time checkout, whose `init_point` is the page a buyer is sent to. */
export const PreferenceBody = s.object({
	id: Identifier,
	init_point: maybe(s.string()),
	sandbox_init_point: maybe(s.string()),
	items: s.optional(s.array(PreferenceItem)),
	external_reference: maybe(s.string()),
	notification_url: maybe(s.string()),
	metadata: maybe(Metadata),
	expires: maybe(s.boolean()),
	preference_expired: maybe(s.boolean()),
	expiration_date_to: maybe(Timestamp),
	date_created: maybe(Timestamp),
	collector_id: maybe(Identifier),
	client_id: maybe(Identifier),
	live_mode: maybe(s.boolean()),
});

/**
 * How often a recurring charge repeats, and for how much. A stored plan carries
 * the billing-day fields and a subscription does not, so both are optional and
 * one schema reads either resource.
 */
export const AutoRecurring = s.object({
	frequency: maybe(s.number()),
	frequency_type: maybe(s.string()),
	transaction_amount: maybe(s.number()),
	currency_id: maybe(s.string()),
	start_date: maybe(Timestamp),
	end_date: maybe(Timestamp),
	billing_day: maybe(s.number()),
	billing_day_proportional: maybe(s.boolean()),
	repetitions: maybe(s.number()),
	free_trial: maybe(
		s.object({
			frequency: maybe(s.number()),
			frequency_type: maybe(s.string()),
		}),
	),
});

/**
 * A recurring price the platform stores, which is the one catalog object it
 * has and the reason recurring products can be read back rather than declared.
 */
export const PreapprovalPlanBody = s.object({
	id: Identifier,
	reason: maybe(s.string()),
	status: maybe(s.string()),
	auto_recurring: maybe(AutoRecurring),
	payment_methods_allowed: maybe(Metadata),
	back_url: maybe(s.string()),
	init_point: maybe(s.string()),
	external_reference: maybe(s.string()),
	date_created: maybe(Timestamp),
	last_modified: maybe(Timestamp),
	collector_id: maybe(Identifier),
	application_id: maybe(Identifier),
});

/** What the platform has charged a subscription so far, and what it owes next. */
export const PreapprovalSummarized = s.object({
	quotas: maybe(s.number()),
	charged_quantity: maybe(s.number()),
	charged_amount: maybe(s.number()),
	pending_charge_quantity: maybe(s.number()),
	pending_charge_amount: maybe(s.number()),
	semaphore: maybe(s.string()),
	last_charged_date: maybe(Timestamp),
	last_charged_amount: maybe(s.number()),
});

/** A subscription: the authorization a payer gives for a repeating charge. */
export const PreapprovalBody = s.object({
	id: Identifier,
	status: s.string(),
	reason: maybe(s.string()),
	payer_id: maybe(Identifier),
	payer_email: maybe(s.string()),
	preapproval_plan_id: maybe(Identifier),
	external_reference: maybe(s.string()),
	back_url: maybe(s.string()),
	init_point: maybe(s.string()),
	auto_recurring: maybe(AutoRecurring),
	summarized: maybe(PreapprovalSummarized),
	next_payment_date: maybe(Timestamp),
	payment_method_id: maybe(Identifier),
	date_created: maybe(Timestamp),
	last_modified: maybe(Timestamp),
	live_mode: maybe(s.boolean()),
});

/** What a payment settled to, net of the platform's own fees. */
export const TransactionDetails = s.object({
	total_paid_amount: maybe(s.number()),
	net_received_amount: maybe(s.number()),
	overpaid_amount: maybe(s.number()),
	installment_amount: maybe(s.number()),
});

/** A completed charge, which is what a purchase history and an upgrade gate read. */
export const PaymentBody = s.object({
	id: Identifier,
	status: s.string(),
	status_detail: maybe(s.string()),
	currency_id: maybe(s.string()),
	description: maybe(s.string()),
	transaction_amount: maybe(s.number()),
	transaction_amount_refunded: maybe(s.number()),
	taxes_amount: maybe(s.number()),
	coupon_amount: maybe(s.number()),
	transaction_details: maybe(TransactionDetails),
	external_reference: maybe(s.string()),
	metadata: maybe(Metadata),
	payer: maybe(
		s.object({
			id: maybe(Identifier),
			email: maybe(s.string()),
			type: maybe(s.string()),
		}),
	),
	/** UNVERIFIED: the live API returns `order`, which the reference does not declare. */
	order: maybe(s.object({ id: maybe(Identifier), type: maybe(s.string()) })),
	date_created: maybe(Timestamp),
	date_approved: maybe(Timestamp),
	date_last_updated: maybe(Timestamp),
	live_mode: maybe(s.boolean()),
});

/** The payments one hosted checkout produced, which is how a return route resolves it. */
export const MerchantOrderBody = s.object({
	id: Identifier,
	status: maybe(s.string()),
	order_status: maybe(s.string()),
	preference_id: maybe(Identifier),
	external_reference: maybe(s.string()),
	total_amount: maybe(s.number()),
	paid_amount: maybe(s.number()),
	refunded_amount: maybe(s.number()),
	payments: s.optional(
		s.array(
			s.object({
				id: maybe(Identifier),
				status: maybe(s.string()),
				transaction_amount: maybe(s.number()),
				currency_id: maybe(s.string()),
			}),
		),
	),
	date_created: maybe(Timestamp),
});

/**
 * A delivery as it arrives: a pointer, carrying which resource moved and its
 * id, and none of that resource's state.
 */
export const NotificationBody = s.object({
	id: maybe(Identifier),
	type: maybe(s.string()),
	topic: maybe(s.string()),
	action: maybe(s.string()),
	api_version: maybe(s.string()),
	live_mode: maybe(s.boolean()),
	user_id: maybe(Identifier),
	date_created: maybe(s.string()),
	data: maybe(s.object({ id: maybe(Identifier) })),
	resource: maybe(s.string()),
});

/** A validated payer record. */
export type CustomerPayload = s.InferOutput<typeof CustomerBody>;

/** A validated hosted one-time checkout. */
export type PreferencePayload = s.InferOutput<typeof PreferenceBody>;

/** A validated recurring price. */
export type PreapprovalPlanPayload = s.InferOutput<typeof PreapprovalPlanBody>;

/** A validated subscription. */
export type PreapprovalPayload = s.InferOutput<typeof PreapprovalBody>;

/** A validated charge. */
export type PaymentPayload = s.InferOutput<typeof PaymentBody>;

/** A validated hosted-checkout order. */
export type MerchantOrderPayload = s.InferOutput<typeof MerchantOrderBody>;

/** A validated delivery pointer. */
export type NotificationPayload = s.InferOutput<typeof NotificationBody>;

/** A validated failure body. */
export type ErrorPayload = s.InferOutput<typeof ErrorBody>;

/** A validated search envelope, whose results are still unmapped payloads. */
export type SearchPayload = s.InferOutput<typeof SearchBody>;
