/**
 * Parsers for Buttondown's wire shapes at the pinned API version: the subscriber
 * record, the numbered list page, both failure bodies and the webhook delivery.
 * Every response is read through one of these before it becomes our model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

/**
 * A subscriber as Buttondown answers it. `type` is read as any string, so a
 * lifecycle state Buttondown adds reaches the status mapping, which reports it
 * as a gap, and metadata keeps its nested values for a read-merge-write.
 */
export const SUBSCRIBER_SCHEMA = s.object({
	id: s.string(),
	email_address: s.string(),
	type: s.string(),
	creation_date: coerce.date(),
	tags: s.array(s.string()),
	metadata: s.optional(s.nullable(s.record(s.string(), s.any()))),
});

/**
 * One numbered page. Rows stay unparsed here, so one unreadable row costs that
 * row rather than the page; `next` is `null` on the last page.
 */
export const SUBSCRIBER_PAGE_SCHEMA = s.object({
	results: s.array(s.any()),
	next: s.optional(s.nullable(s.string())),
});

/** The coded failure body, whose `code` says which refusal a visitor can act on. */
export const CODED_ERROR_SCHEMA = s.object({
	code: s.optional(s.nullable(s.string())),
	detail: s.string(),
});

/** The request-validation failure body, which locates each rejected field. */
export const VALIDATION_ERROR_SCHEMA = s.object({
	detail: s.array(
		s.object({
			loc: s.array(s.union([s.string(), s.number()])),
			msg: s.string(),
		}),
	),
});

/**
 * One webhook delivery. `data` names resources by id only, and `newsletter`
 * arrives on accounts holding more than one newsletter.
 */
export const WEBHOOK_EVENT_SCHEMA = s.object({
	id: s.string(),
	event_type: s.string(),
	data: s.object({
		subscriber: s.optional(s.nullable(s.string())),
		newsletter: s.optional(s.nullable(s.string())),
	}),
});
