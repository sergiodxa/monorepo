/**
 * The subject payload the machine-to-machine API publishes, and the schema that reads
 * one back out of the cache. Its field names and value formats are a frozen contract:
 * clients parse `camelCase` keys and ISO-8601 date strings, and the cache holding these
 * payloads is shared with another worker serving the same API, so both must read what
 * either one wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { SelectSubject } from "~/database/schema";

/**
 * A subject as the API returns it: camelCase fields and ISO-8601 timestamps, the shape
 * clients have always parsed.
 */
export interface ApiSubject {
	id: string;
	createdAt: string;
	updatedAt: string;
	emailVerifiedAt: string | null;
	displayName: string;
	avatar: string;
	role: "user" | "admin";
	username: string;
	emailAddress: string;
}

/**
 * Shape a cached payload must have to be served. The cache is shared with another
 * worker, so validating a stored entry against this schema decides whether to trust
 * it or fall back to the database.
 */
export const ApiSubjectSchema = s.object({
	id: s.string(),
	createdAt: s.string(),
	updatedAt: s.string(),
	emailVerifiedAt: s.nullable(s.string()),
	displayName: s.string(),
	avatar: s.string(),
	role: s.enum_(["user", "admin"]),
	username: s.string(),
	emailAddress: s.string(),
});

/**
 * Maps a subject row onto the published payload, serializing timestamps to ISO-8601 to
 * match what the shared cache's other writer produces, and narrowing an unrecognized
 * role to `user`.
 *
 * @param subject - A subject row, timestamps in epoch milliseconds.
 */
export function toApiSubject(subject: SelectSubject): ApiSubject {
	return {
		id: subject.id,
		createdAt: new Date(subject.created_at).toISOString(),
		updatedAt: new Date(subject.updated_at).toISOString(),
		emailVerifiedAt:
			subject.email_verified_at === null ? null : new Date(subject.email_verified_at).toISOString(),
		displayName: subject.display_name,
		avatar: subject.avatar,
		role: subject.role === "admin" ? "admin" : "user",
		username: subject.username,
		emailAddress: subject.email_address,
	};
}

/**
 * Reads a cached payload.
 *
 * @param value - Whatever the cache held, already JSON-parsed.
 * @returns The payload, or `null` when the entry cannot be trusted to be one.
 */
export function parseCachedSubject(value: unknown): ApiSubject | null {
	if (value === null || value === undefined) return null;
	let result = s.parseSafe(ApiSubjectSchema, value);
	return result.success ? result.value : null;
}
