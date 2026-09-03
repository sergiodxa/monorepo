/**
 * Parsers for Polar's wire shapes: the resources its REST API answers with, the
 * two envelopes it pages with, and the two bodies it reports a failure in. Every
 * response is read through one of these before anything here becomes our model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

/**
 * Reads a field Polar answers with as either absent or `null`, so a schema
 * states what a value means without also tracking which of the two arrives.
 */
function maybe<Output>(
	schema: Schema<unknown, Output>,
): Schema<unknown, Output | null | undefined> {
	return s.optional(s.nullable(schema));
}

/** Values Polar stores in a metadata bag, in either direction. */
const METADATA_VALUE_SCHEMA = s.union([s.string(), s.number(), s.boolean()]);

/** A metadata bag, whose values arrive typed rather than as text. */
const METADATA_SCHEMA = s.record(s.string(), METADATA_VALUE_SCHEMA);

/** How often Polar renews a product, and the vocabulary our own interval shares. */
const INTERVAL_SCHEMA = s.enum_(["day", "week", "month", "year"]);

/**
 * Polar's own subscription vocabulary, parsed exactly so a state it adds
 * surfaces where a mapping is written rather than reaching a call site.
 */
const SUBSCRIPTION_STATUS_SCHEMA = s.enum_([
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
]);

/** Polar's own checkout vocabulary, parsed exactly for the same reason. */
const CHECKOUT_STATUS_SCHEMA = s.enum_(["open", "expired", "confirmed", "succeeded", "failed"]);

/** A customer, whose email is absent on the team variant of the record. */
export const CUSTOMER_SCHEMA = s.object({
	id: s.string(),
	created_at: coerce.date(),
	email: maybe(s.string()),
	name: maybe(s.string()),
	external_id: maybe(s.string()),
	metadata: s.optional(METADATA_SCHEMA),
});

/** A meter balance as the customer-state read reports it. */
const CUSTOMER_STATE_METER_SCHEMA = s.object({
	meter_id: s.string(),
	consumed_units: s.number(),
	credited_units: s.number(),
	balance: s.number(),
});

/** An entitling subscription as the customer-state read reports it. */
const CUSTOMER_STATE_SUBSCRIPTION_SCHEMA = s.object({
	id: s.string(),
	product_id: s.string(),
	status: SUBSCRIPTION_STATUS_SCHEMA,
	current_period_start: maybe(coerce.date()),
	current_period_end: maybe(coerce.date()),
	cancel_at_period_end: s.optional(s.boolean()),
});

/**
 * A granted benefit, read for which benefit was granted. Its `properties` vary
 * by type without a discriminator, so what a grant unlocks comes from the
 * configured benefit ids instead.
 */
const CUSTOMER_STATE_BENEFIT_SCHEMA = s.object({ benefit_id: s.string() });

/** The one read that answers what a customer holds right now. */
export const CUSTOMER_STATE_SCHEMA = s.object({
	id: s.string(),
	created_at: coerce.date(),
	email: maybe(s.string()),
	name: maybe(s.string()),
	external_id: maybe(s.string()),
	metadata: s.optional(METADATA_SCHEMA),
	active_subscriptions: s.optional(s.array(CUSTOMER_STATE_SUBSCRIPTION_SCHEMA)),
	granted_benefits: s.optional(s.array(CUSTOMER_STATE_BENEFIT_SCHEMA)),
	active_meters: s.optional(s.array(CUSTOMER_STATE_METER_SCHEMA)),
});

/**
 * One way to buy a product. `unit_amount` is a decimal string because a metered
 * price can charge a fraction of a cent per unit.
 */
const PRICE_SCHEMA = s.object({
	id: s.string(),
	amount_type: s.enum_(["fixed", "custom", "free", "metered_unit", "seat_based"]),
	price_amount: maybe(s.number()),
	price_currency: maybe(s.string()),
	unit_amount: maybe(s.string()),
	meter_id: maybe(s.string()),
});

/** A catalog product, whose recurrence lives here rather than on its prices. */
export const PRODUCT_SCHEMA = s.object({
	id: s.string(),
	created_at: coerce.date(),
	name: s.string(),
	description: maybe(s.string()),
	is_archived: s.optional(s.boolean()),
	is_recurring: s.optional(s.boolean()),
	recurring_interval: maybe(INTERVAL_SCHEMA),
	prices: s.optional(s.array(PRICE_SCHEMA)),
	benefits: s.optional(s.array(s.object({ id: s.string() }))),
});

/** A hosted checkout session. */
export const CHECKOUT_SCHEMA = s.object({
	id: s.string(),
	url: s.string(),
	status: CHECKOUT_STATUS_SCHEMA,
	created_at: coerce.date(),
	expires_at: maybe(coerce.date()),
	product_id: maybe(s.string()),
	customer_id: maybe(s.string()),
	external_customer_id: maybe(s.string()),
	currency: maybe(s.string()),
	total_amount: maybe(s.number()),
	discount_id: maybe(s.string()),
	subscription_id: maybe(s.string()),
});

/** A subscription, carrying the prices actually in force. */
export const SUBSCRIPTION_SCHEMA = s.object({
	id: s.string(),
	created_at: coerce.date(),
	customer_id: s.string(),
	product_id: s.string(),
	status: SUBSCRIPTION_STATUS_SCHEMA,
	amount: maybe(s.number()),
	currency: maybe(s.string()),
	recurring_interval: maybe(INTERVAL_SCHEMA),
	current_period_start: maybe(coerce.date()),
	current_period_end: maybe(coerce.date()),
	cancel_at_period_end: s.optional(s.boolean()),
	canceled_at: maybe(coerce.date()),
	ends_at: maybe(coerce.date()),
	metadata: s.optional(METADATA_SCHEMA),
	prices: s.optional(s.array(s.object({ id: s.string() }))),
});

/** A paid purchase, with every amount in minor units of its currency. */
export const ORDER_SCHEMA = s.object({
	id: s.string(),
	created_at: coerce.date(),
	customer_id: s.string(),
	/** The buyer as the paid record carries them, which is who a delivery is about. */
	customer: s.optional(
		s.object({
			id: s.optional(s.string()),
			email: maybe(s.string()),
			external_id: maybe(s.string()),
		}),
	),
	product_id: maybe(s.string()),
	subscription_id: maybe(s.string()),
	discount_id: maybe(s.string()),
	paid: s.optional(s.boolean()),
	currency: s.string(),
	subtotal_amount: s.number(),
	tax_amount: s.optional(s.number()),
	total_amount: s.number(),
	refunded_amount: s.optional(s.number()),
});

/**
 * A discount. A percentage one is expressed in basis points, and the products
 * it is scoped to arrive as ids.
 */
export const DISCOUNT_SCHEMA = s.object({
	id: s.string(),
	created_at: coerce.date(),
	name: s.string(),
	code: maybe(s.string()),
	type: s.enum_(["fixed", "percentage"]),
	amount: maybe(s.number()),
	currency: maybe(s.string()),
	basis_points: maybe(s.number()),
	max_redemptions: maybe(s.number()),
	redemptions_count: s.optional(s.number()),
	starts_at: maybe(coerce.date()),
	ends_at: maybe(coerce.date()),
	products: s.optional(s.array(s.object({ id: s.string() }))),
});

/**
 * An ingested usage event. Its metadata holds opaque values because the
 * reserved cost and LLM keys nest an object where every other key is a scalar.
 */
export const EVENT_SCHEMA = s.object({
	id: s.string(),
	name: s.string(),
	timestamp: coerce.date(),
	customer_id: maybe(s.string()),
	external_customer_id: maybe(s.string()),
	external_id: maybe(s.string()),
	metadata: s.optional(s.record(s.string(), s.any())),
});

/** The cost a usage event carries, whose amount reads back as a decimal string. */
export const COST_METADATA_SCHEMA = s.object({
	amount: s.union([s.string(), s.number()]),
	currency: s.string(),
});

/** What an ingest call reports, with duplicates counted separately from inserts. */
export const EVENTS_INGEST_SCHEMA = s.object({
	inserted: s.number(),
	duplicates: s.optional(s.number()),
});

/** A customer session, whose portal URL is the page a customer is sent to. */
export const CUSTOMER_SESSION_SCHEMA = s.object({
	customer_portal_url: s.string(),
	expires_at: maybe(coerce.date()),
});

/** A meter read, bucketed by the interval asked for and totalled over the window. */
export const METER_QUANTITIES_SCHEMA = s.object({
	total: s.number(),
	quantities: s.optional(s.array(s.object({ timestamp: coerce.date(), quantity: s.number() }))),
});

/**
 * Both list envelopes at once: the offset one counts pages, the cursor one only
 * says whether another exists, and each list endpoint answers with one of them.
 */
export const PAGE_ENVELOPE_SCHEMA = s.object({
	items: s.array(s.any()),
	pagination: s.optional(
		s.object({
			total_count: s.optional(s.number()),
			max_page: s.optional(s.number()),
			has_next_page: s.optional(s.boolean()),
		}),
	),
});

/** A webhook delivery, whose resource travels under `data`. */
export const WEBHOOK_ENVELOPE_SCHEMA = s.object({
	type: s.string(),
	timestamp: s.optional(s.string()),
	data: s.any(),
});

/**
 * A domain failure, named by a code. It is told apart from a validation
 * failure by `error`, since both spell their message `detail` with
 * incompatible types.
 */
export const DOMAIN_ERROR_SCHEMA = s.object({
	error: s.string(),
	detail: s.optional(s.string()),
});

/** A validation failure, whose issues locate the field each rejects. */
export const VALIDATION_ERROR_SCHEMA = s.object({
	detail: s.array(
		s.object({
			msg: s.string(),
			loc: s.optional(s.array(s.union([s.string(), s.number()]))),
		}),
	),
});

/** A failure from a URL matching no route, which carries a message and nothing else. */
export const MESSAGE_ERROR_SCHEMA = s.object({ detail: s.string() });
