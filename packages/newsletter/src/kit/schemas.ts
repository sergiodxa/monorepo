/**
 * Parsers for Kit's API v4 wire shapes: the subscriber, tag and custom-field
 * records, the cursor envelope every list carries, the failure body, and the
 * webhook delivery. Every response is read through one of these before it
 * becomes our model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/**
 * A custom field value. Kit answers `null` for a field the subscriber has no
 * value in, and every field on the account appears on every record.
 */
const FIELD_VALUE_SCHEMA = s.nullable(s.union([s.string(), s.number(), s.boolean()]));

/** A subscriber as every v4 endpoint and webhook payload describes one. */
export const SUBSCRIBER_SCHEMA = s.object({
	id: s.number(),
	email_address: s.string(),
	state: s.string(),
	created_at: s.string(),
	fields: s.optional(s.nullable(s.record(s.string(), FIELD_VALUE_SCHEMA))),
});

/** A Kit subscriber record, after parsing. */
export type KitSubscriber = s.InferOutput<typeof SUBSCRIBER_SCHEMA>;

/**
 * The cursor block of a list. A cursor is read as optional because an empty
 * page has nothing to point at, and only `has_next_page` decides a walk.
 */
const PAGINATION_SCHEMA = s.object({
	has_next_page: s.boolean(),
	end_cursor: s.optional(s.nullable(s.string())),
});

/** One subscriber answered by a create, an update, a read or a form add. */
export const SUBSCRIBER_ENVELOPE_SCHEMA = s.object({
	subscriber: SUBSCRIBER_SCHEMA,
	/** Custom-field keys Kit ignored because the account has no such field. */
	warnings: s.optional(s.nullable(s.array(s.string()))),
});

/** A page of subscribers, from the account list or from a tag's list. */
export const SUBSCRIBER_PAGE_SCHEMA = s.object({
	subscribers: s.array(SUBSCRIBER_SCHEMA),
	pagination: PAGINATION_SCHEMA,
});

/** A tag as the tag endpoints describe one. */
const TAG_SCHEMA = s.object({ id: s.number(), name: s.string() });

/** The tag a create answers, which is the existing one when the name is taken. */
export const TAG_ENVELOPE_SCHEMA = s.object({ tag: TAG_SCHEMA });

/** A page of tags, from the account list or from one subscriber's list. */
export const TAG_PAGE_SCHEMA = s.object({
	tags: s.array(TAG_SCHEMA),
	pagination: PAGINATION_SCHEMA,
});

/** A page of the account's custom fields; `key` is what a subscriber's `fields` is keyed by. */
export const CUSTOM_FIELD_PAGE_SCHEMA = s.object({
	custom_fields: s.array(s.object({ key: s.string() })),
	pagination: PAGINATION_SCHEMA,
});

/** The body Kit reports every failure in. */
export const ERROR_SCHEMA = s.object({ errors: s.array(s.string()) });

/**
 * One event of a delivery. `data` varies by type, so only the subscriber it
 * may carry is read; resource events such as `tag.created` carry none.
 */
const DELIVERY_EVENT_SCHEMA = s.object({
	id: s.string(),
	type: s.string(),
	created: s.optional(s.nullable(s.string())),
	data: s.optional(s.nullable(s.object({ subscriber: s.optional(s.nullable(SUBSCRIBER_SCHEMA)) }))),
});

/** A webhook delivery: one to a hundred events of a single type. */
export const DELIVERY_SCHEMA = s.object({ events: s.array(DELIVERY_EVENT_SCHEMA) });
