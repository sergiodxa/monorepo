/**
 * Builds `Cache-Control` values from a description of intent: who may store the
 * response, and for how long, with every age written as a duration instead of a
 * bare number of seconds. Serialization is left to the framework header class.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";
import type { CacheControlInit } from "remix/headers";

import { toSeconds } from "@pkg/duration";
import { CacheControl } from "remix/headers";

/**
 * Who is allowed to store the response.
 *
 * There is deliberately no default: where an edge cache sits in front of the
 * origin, `public` is what lets one client's body be served to another, so the
 * word is spelled out at the call site instead of being inferred.
 */
export type CacheVisibility = "public" | "private";

/**
 * The policy description a response declares.
 *
 * Every age is a duration, so `"1 hour"` reads as an hour at the call site and
 * is converted to whole seconds once, here. An omitted option emits no
 * directive at all, which is different from emitting it with a zero value.
 */
export interface PolicyOptions {
	/** Who may store the response; omitted means neither directive is emitted. */
	visibility?: CacheVisibility;
	/** How long any cache may reuse the response without revalidating. */
	maxAge?: DurationInput;
	/** How long a shared cache may reuse it, overriding `maxAge` for that cache. */
	sMaxAge?: DurationInput;
	/** How long a stale response may be served while it is revalidated in the background. */
	staleWhileRevalidate?: DurationInput;
	/** How long a stale response may be served after the origin errors. */
	staleIfError?: DurationInput;
	/** Store the response, but revalidate it with the origin before every reuse. */
	noCache?: boolean;
	/** Do not store the response anywhere, in any cache. */
	noStore?: boolean;
	/** Forbid intermediaries from transforming the payload (recompressing images, for example). */
	noTransform?: boolean;
	/** Once stale, the response must be revalidated rather than served. */
	mustRevalidate?: boolean;
	/** Same as `mustRevalidate`, but binding on shared caches only. */
	proxyRevalidate?: boolean;
	/** The body will never change while fresh, so revalidation can be skipped entirely. */
	immutable?: boolean;
}

/**
 * Turns a policy description into a `Cache-Control` header value.
 *
 * The return value is the framework's own `CacheControl`, so it can be handed to
 * anything that already accepts that type, read back field by field, or set on
 * a `Headers` object directly through its `toString()`.
 *
 * @param options - Visibility, ages, and directives to emit; all optional.
 * @returns A `CacheControl` carrying only the directives that were asked for.
 *
 * @example
 * headers.set("Cache-Control", policy({ visibility: "public", maxAge: "1 hour" }));
 * @example
 * policy({ visibility: "public", maxAge: "1 hour", sMaxAge: "1 day" }).toString();
 * // "public, max-age=3600, s-maxage=86400"
 */
export function policy(options: PolicyOptions = {}): CacheControl {
	let init: CacheControlInit = {};

	if (options.visibility === "public") init.public = true;
	if (options.visibility === "private") init.private = true;

	if (options.maxAge !== undefined) init.maxAge = toSeconds(options.maxAge);
	if (options.sMaxAge !== undefined) init.sMaxage = toSeconds(options.sMaxAge);
	if (options.staleWhileRevalidate !== undefined) {
		init.staleWhileRevalidate = toSeconds(options.staleWhileRevalidate);
	}
	if (options.staleIfError !== undefined) init.staleIfError = toSeconds(options.staleIfError);

	if (options.noCache) init.noCache = true;
	if (options.noStore) init.noStore = true;
	if (options.noTransform) init.noTransform = true;
	if (options.mustRevalidate) init.mustRevalidate = true;
	if (options.proxyRevalidate) init.proxyRevalidate = true;
	if (options.immutable) init.immutable = true;

	return new CacheControl(init);
}
