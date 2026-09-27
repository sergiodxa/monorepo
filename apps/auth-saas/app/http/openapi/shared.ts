/**
 * What every management API operation declares alike: the OAuth security a scope maps
 * to, the problems authentication, rate limiting and versioning can answer with, and the
 * responses a merge patch or an idempotent route adds, so each operation states only its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as coerce from "@sdxc/json-schema/coerce";

import type { ManagementScope } from "~/app/services/management-scopes";

/** The security scheme every tenant-scoped operation names: a client-credentials token. */
export const SECURITY_SCHEME = "oauth2";

/**
 * The security requirement for a route checking one scope. A dashboard session reaches
 * the same routes; the document describes the token an API client holds.
 *
 * @param scope - The scope the route requires.
 * @returns The requirement for an operation's `security`.
 */
export function requires(scope: ManagementScope) {
	return [{ [SECURITY_SCHEME]: [scope] }] as const;
}

/** The refusals every authenticated, rate-limited route can answer with. */
export const AUTH_PROBLEMS = ["unauthorized", "forbidden", "rateLimited"] as const;

/** The refusals a route taking an `Idempotency-Key` adds. */
export const IDEMPOTENCY_PROBLEMS = [
	"idempotencyKeyInvalid",
	"idempotencyKeyInUse",
	"idempotencyKeyReused",
] as const;

/** An RFC 9457 document outside the catalog, such as the `415` a merge patch route answers. */
export const PLAIN_PROBLEM = s.object({
	type: s.optional(s.string()),
	title: s.optional(s.string()),
	status: s.optional(s.integer()),
	detail: s.optional(s.string()),
});

/** The `415` a `PATCH` answers for a body in a media type other than a merge patch. */
export const UNSUPPORTED_MEDIA_TYPE = {
	description: "The body is not application/merge-patch+json or application/json",
	body: { "application/problem+json": PLAIN_PROBLEM },
	headers: {
		"Accept-Patch": {
			schema: s.string(),
			description: "application/merge-patch+json",
			required: true,
		},
	},
} as const;

/**
 * A `PATCH` body: the same schema under the merge patch media type and, for callers
 * written before that type was advertised, `application/json`.
 *
 * @param schema - The patch document's shape, every member optional.
 * @returns The body record for an operation spec.
 */
export function mergePatchBody<Schema extends s.Schema<any, any>>(schema: Schema) {
	return { "application/merge-patch+json": schema, "application/json": schema };
}

/** The `Idempotency-Key` header a non-idempotent `POST` accepts, for its description. */
export const IDEMPOTENCY_DESCRIPTION =
	"Send an Idempotency-Key header (a quoted string) to have a retry answered with the first attempt's response for 24 hours.";

/** The keyset paging parameters every list route reads beside its own filters. */
export const PAGING_QUERY = {
	cursor: s.optional(s.string()),
	per_page: s.optional(coerce.number()),
};

/** The `Link` header a list response carries, naming its `next` and `prev` pages. */
export const LINK_HEADER = {
	Link: {
		schema: s.string(),
		description: "RFC 8288 links to the next and previous pages, when they exist",
	},
} as const;

/** The refusals a keyset list route adds: an unreadable paging parameter, or a stale cursor. */
export const PAGING_PROBLEMS = ["invalidRequest", "badCursor"] as const;
