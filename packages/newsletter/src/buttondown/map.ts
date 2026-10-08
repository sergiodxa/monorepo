/**
 * Translation between Buttondown's subscriber vocabulary and ours: each of its
 * lifecycle types to one of the four normalized statuses and back, and its
 * record to a `Subscriber`, so no Buttondown term reaches a caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { InferOutput } from "remix/data-schema";

import { failure, success } from "@sdxc/result";

import type { NewsletterError } from "../errors.js";
import type { Subscriber, SubscriberStatus } from "../types.js";

import type { SUBSCRIBER_SCHEMA } from "./schemas.js";

import { toMappingError } from "./errors.js";

/** A subscriber record once its wire shape has been read. */
export type ButtondownSubscriber = InferOutput<typeof SUBSCRIBER_SCHEMA>;

/**
 * Our status for each Buttondown type. Every paid lifecycle state is a reader
 * still on the list, and `removed` is one the newsletter took off and stopped
 * mailing; a type absent here is a mapping gap, never a guess.
 */
const STATUS_BY_TYPE: Readonly<Record<string, SubscriberStatus>> = {
	unactivated: "pending",
	regular: "active",
	premium: "active",
	gifted: "active",
	trialed: "active",
	churning: "active",
	churned: "active",
	past_due: "active",
	paused: "active",
	unpaid: "active",
	upcoming: "active",
	unsubscribed: "unsubscribed",
	blocked: "suppressed",
	complained: "suppressed",
	undeliverable: "suppressed",
	removed: "suppressed",
};

/**
 * The Buttondown types each status covers, which is how a status filter is
 * expressed as the repeated `type` parameter its list reads.
 */
export const TYPES_BY_STATUS: Readonly<Record<SubscriberStatus, readonly string[]>> =
	Object.entries(STATUS_BY_TYPE).reduce<Record<SubscriberStatus, string[]>>(
		(grouped, [type, status]) => {
			grouped[status].push(type);
			return grouped;
		},
		{ pending: [], active: [], unsubscribed: [], suppressed: [] },
	);

/**
 * Our status for a Buttondown type.
 *
 * @param type - The subscriber's `type` as Buttondown answered it.
 * @returns The status, or `undefined` for a type the mapping lacks.
 */
export function statusOf(type: string): SubscriberStatus | undefined {
	return Object.hasOwn(STATUS_BY_TYPE, type) ? STATUS_BY_TYPE[type] : undefined;
}

/**
 * Flattens Buttondown's metadata to text. A string stays as stored and any
 * nested value is its JSON text, so a key written elsewhere is still visible.
 */
function metadataOf(
	metadata: Readonly<Record<string, unknown>> | null | undefined,
): Readonly<Record<string, string>> {
	let flat: Record<string, string> = {};

	for (let [key, value] of Object.entries(metadata ?? {})) {
		if (value === null || value === undefined) continue;
		flat[key] = typeof value === "string" ? value : JSON.stringify(value);
	}

	return Object.freeze(flat);
}

/**
 * Maps one Buttondown record into our model.
 *
 * @param connection - The credential set the read was made against.
 * @param record - The parsed record.
 * @returns The subscriber, or `invalid_response` when its type has no mapping.
 */
export function mapSubscriber(
	connection: string,
	record: ButtondownSubscriber,
): Result<Subscriber, NewsletterError> {
	let status = statusOf(record.type);

	if (status === undefined) {
		return failure(
			toMappingError(connection, `Buttondown subscriber type "${record.type}" has no mapping`),
		);
	}

	return success({
		id: record.id,
		email: record.email_address,
		status,
		providerStatus: record.type,
		metadata: metadataOf(record.metadata),
		createdAt: record.creation_date,
	});
}
