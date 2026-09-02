/**
 * Response schemas for the Stripe REST API, one per object the provider reads.
 * Every payload is parsed through these before any mapping runs, so a field
 * Stripe renamed or dropped surfaces as a parse failure rather than `undefined`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/**
 * A reference Stripe serializes as a bare id, or as the whole object when the
 * request expanded it, so both shapes reach the mappers through one schema.
 */
const EXPANDABLE_ID = s.union([s.string(), s.object({ id: s.string() })]);

/** A reference as the wire carries it, before it is narrowed to an id. */
export type ExpandableId = s.InferOutput<typeof EXPANDABLE_ID>;

/** The envelope Stripe reports every request failure in. */
export const STRIPE_ERROR_SCHEMA = s.object({
	error: s.object({
		type: s.optional(s.string()),
		code: s.optional(s.string()),
		message: s.optional(s.string()),
		param: s.optional(s.string()),
	}),
});

/** A request failure as Stripe reported it. */
export type StripeErrorPayload = s.InferOutput<typeof STRIPE_ERROR_SCHEMA>;

/**
 * A collection page. `next_page` covers the search endpoints, which paginate by
 * an opaque token instead of the `starting_after` id the list endpoints take.
 *
 * @param item - Schema for one member of the collection.
 * @returns A schema for the page wrapping that member.
 *
 * @example
 * s.parseSafe(listOf(CUSTOMER_SCHEMA), payload);
 */
export function listOf<Item>(item: s.Schema<unknown, Item>) {
	return s.object({
		data: s.array(item),
		has_more: s.defaulted(s.boolean(), false),
		next_page: s.optional(s.nullable(s.string())),
	});
}

/** A customer record. */
export const CUSTOMER_SCHEMA = s.object({
	id: s.string(),
	email: s.optional(s.nullable(s.string())),
	name: s.optional(s.nullable(s.string())),
	metadata: s.optional(s.nullable(s.record(s.string(), s.string()))),
	created: s.number(),
	deleted: s.optional(s.boolean()),
	currency: s.optional(s.nullable(s.string())),
	delinquent: s.optional(s.nullable(s.boolean())),
	livemode: s.optional(s.boolean()),
});

/** A customer as the wire carries it. */
export type StripeCustomer = s.InferOutput<typeof CUSTOMER_SCHEMA>;

/**
 * A price. `type` says whether it recurs, and a recurring price is metered when
 * it names a meter or reports metered usage, which is how Stripe spells the
 * three ways a product can be charged for.
 */
export const PRICE_SCHEMA = s.object({
	id: s.string(),
	active: s.optional(s.boolean()),
	currency: s.string(),
	unit_amount: s.optional(s.nullable(s.number())),
	type: s.enum_(["one_time", "recurring"]),
	recurring: s.optional(
		s.nullable(
			s.object({
				interval: s.enum_(["day", "week", "month", "year"]),
				usage_type: s.optional(s.nullable(s.string())),
				meter: s.optional(s.nullable(s.string())),
			}),
		),
	),
	product: s.optional(EXPANDABLE_ID),
	metadata: s.optional(s.nullable(s.record(s.string(), s.string()))),
	billing_scheme: s.optional(s.string()),
	lookup_key: s.optional(s.nullable(s.string())),
	livemode: s.optional(s.boolean()),
});

/** A price as the wire carries it. */
export type StripePrice = s.InferOutput<typeof PRICE_SCHEMA>;

/** A product record, which carries no price of its own. */
export const PRODUCT_SCHEMA = s.object({
	id: s.string(),
	name: s.string(),
	description: s.optional(s.nullable(s.string())),
	active: s.defaulted(s.boolean(), true),
	created: s.number(),
	metadata: s.optional(s.nullable(s.record(s.string(), s.string()))),
	livemode: s.optional(s.boolean()),
});

/** A product as the wire carries it. */
export type StripeProduct = s.InferOutput<typeof PRODUCT_SCHEMA>;

/**
 * A feature attached to a product. `lookup_key` is chosen when the feature is
 * created, so it is already the slug an app asks its entitlements about.
 */
export const PRODUCT_FEATURE_SCHEMA = s.object({
	id: s.string(),
	entitlement_feature: s.object({
		id: s.string(),
		lookup_key: s.string(),
		name: s.optional(s.nullable(s.string())),
	}),
});

/** A product-feature attachment as the wire carries it. */
export type StripeProductFeature = s.InferOutput<typeof PRODUCT_FEATURE_SCHEMA>;

/** One line of a checkout session, read when the session expanded its items. */
const CHECKOUT_LINE_ITEM_SCHEMA = s.object({
	price: s.optional(s.nullable(s.object({ id: s.string(), product: s.optional(EXPANDABLE_ID) }))),
});

/**
 * A checkout session. `url` is present only while the session is open, and
 * `status` is absent on a session Stripe has not started tracking yet.
 */
export const CHECKOUT_SESSION_SCHEMA = s.object({
	id: s.string(),
	url: s.optional(s.nullable(s.string())),
	status: s.optional(s.nullable(s.enum_(["open", "complete", "expired"]))),
	mode: s.optional(s.nullable(s.string())),
	payment_status: s.optional(s.nullable(s.string())),
	livemode: s.optional(s.boolean()),
	amount_total: s.optional(s.nullable(s.number())),
	currency: s.optional(s.nullable(s.string())),
	customer: s.optional(s.nullable(EXPANDABLE_ID)),
	client_reference_id: s.optional(s.nullable(s.string())),
	subscription: s.optional(s.nullable(EXPANDABLE_ID)),
	invoice: s.optional(s.nullable(EXPANDABLE_ID)),
	expires_at: s.optional(s.nullable(s.number())),
	created: s.number(),
	metadata: s.optional(s.nullable(s.record(s.string(), s.string()))),
	line_items: s.optional(s.nullable(s.object({ data: s.array(CHECKOUT_LINE_ITEM_SCHEMA) }))),
	discounts: s.optional(
		s.nullable(
			s.array(
				s.object({
					coupon: s.optional(s.nullable(EXPANDABLE_ID)),
					promotion_code: s.optional(s.nullable(EXPANDABLE_ID)),
				}),
			),
		),
	),
});

/** A checkout session as the wire carries it. */
export type StripeCheckoutSession = s.InferOutput<typeof CHECKOUT_SESSION_SCHEMA>;

/** A billing portal session, whose single-use URL is the whole payload. */
export const PORTAL_SESSION_SCHEMA = s.object({
	id: s.string(),
	url: s.string(),
	created: s.number(),
	customer: s.optional(s.nullable(EXPANDABLE_ID)),
	return_url: s.optional(s.nullable(s.string())),
	configuration: s.optional(s.nullable(EXPANDABLE_ID)),
	livemode: s.optional(s.boolean()),
});

/** A portal session as the wire carries it. */
export type StripePortalSession = s.InferOutput<typeof PORTAL_SESSION_SCHEMA>;

/**
 * One subscribed item. The billing period lives here rather than on the
 * subscription, so an item's dates are the authoritative ones.
 */
const SUBSCRIPTION_ITEM_SCHEMA = s.object({
	id: s.string(),
	quantity: s.optional(s.nullable(s.number())),
	current_period_start: s.optional(s.nullable(s.number())),
	current_period_end: s.optional(s.nullable(s.number())),
	price: PRICE_SCHEMA,
});

/** A subscription record, whose items carry what was subscribed to. */
export const SUBSCRIPTION_SCHEMA = s.object({
	id: s.string(),
	customer: EXPANDABLE_ID,
	status: s.enum_([
		"incomplete",
		"incomplete_expired",
		"trialing",
		"active",
		"past_due",
		"canceled",
		"unpaid",
		"paused",
	]),
	currency: s.optional(s.nullable(s.string())),
	cancel_at_period_end: s.defaulted(s.boolean(), false),
	canceled_at: s.optional(s.nullable(s.number())),
	ended_at: s.optional(s.nullable(s.number())),
	cancel_at: s.optional(s.nullable(s.number())),
	current_period_start: s.optional(s.nullable(s.number())),
	current_period_end: s.optional(s.nullable(s.number())),
	created: s.number(),
	metadata: s.optional(s.nullable(s.record(s.string(), s.string()))),
	collection_method: s.optional(s.nullable(s.string())),
	latest_invoice: s.optional(s.nullable(EXPANDABLE_ID)),
	livemode: s.optional(s.boolean()),
	items: s.object({ data: s.array(SUBSCRIPTION_ITEM_SCHEMA) }),
});

/** A subscription as the wire carries it. */
export type StripeSubscription = s.InferOutput<typeof SUBSCRIPTION_SCHEMA>;

/** One feature a customer currently holds, named by the feature's lookup key. */
export const ACTIVE_ENTITLEMENT_SCHEMA = s.object({
	id: s.string(),
	lookup_key: s.string(),
	feature: s.optional(s.nullable(EXPANDABLE_ID)),
});

/** An active entitlement as the wire carries it. */
export type StripeActiveEntitlement = s.InferOutput<typeof ACTIVE_ENTITLEMENT_SCHEMA>;

/**
 * What a delivery is deduplicated and routed by, parsed on its own so an event
 * whose payload this provider does not model still reports which delivery it
 * was and which object it named.
 */
export const EVENT_REFERENCE_SCHEMA = s.object({
	id: s.string(),
	type: s.string(),
	data: s.optional(s.object({ object: s.optional(s.object({ id: s.optional(s.string()) })) })),
});

/** A webhook delivery, whose payload stays opaque until its type is recognized. */
export const EVENT_SCHEMA = s.object({
	id: s.string(),
	type: s.string(),
	created: s.optional(s.number()),
	api_version: s.optional(s.nullable(s.string())),
	data: s.object({ object: s.any() }),
});
