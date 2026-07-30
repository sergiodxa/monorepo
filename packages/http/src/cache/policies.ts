/**
 * The named policies that cover the recurring cases, so the safe answer is also
 * the short one to write. Each one is a reviewable decision with a name rather
 * than a set of directives assembled again in every route that serves content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";
import type { CacheControl } from "remix/headers";

import { policy } from "./policy";

/**
 * Freshness lifetime for fingerprinted assets: one year, the longest value the
 * caching specification asks caches to honor. Expressed in days because a year
 * has no fixed length and durations only count fixed spans.
 */
const IMMUTABLE_MAX_AGE = "365 days";

/**
 * Ages the `private` policy needs, kept as an object so the age is named at the
 * call site instead of appearing as a bare positional argument.
 */
export interface PrivatePolicyOptions {
	/** How long the client's own cache may reuse the response. */
	maxAge: DurationInput;
}

/**
 * The recurring cache policies, each named after the outcome it produces.
 *
 * Only the exceptional case, a response a shared cache may store, is written out
 * with `policy({ visibility: "public", … })`; everything routine has a name here.
 *
 * @example
 * headers.set("Cache-Control", Policies.immutable());
 */
export class Policies {
	/**
	 * Nothing stores the response, anywhere.
	 *
	 * The right answer for one-time payloads and anything a cache holding a copy
	 * would turn into a security problem, such as a token exchange response.
	 *
	 * @returns `no-store`.
	 * @example
	 * Policies.noStore().toString(); // "no-store"
	 */
	static noStore(): CacheControl {
		return policy({ noStore: true });
	}

	/**
	 * Only the client that made the request may store the response.
	 *
	 * The age is required rather than optional: without one, a browser is free to
	 * apply its own heuristic freshness, so how long user-specific content stays
	 * reusable is a decision the call site has to make.
	 *
	 * @param options - The client-side freshness lifetime.
	 * @returns `private, max-age=N`.
	 * @example
	 * Policies.private({ maxAge: "5 minutes" }).toString(); // "private, max-age=300"
	 */
	static private(options: PrivatePolicyOptions): CacheControl {
		return policy({ visibility: "private", maxAge: options.maxAge });
	}

	/**
	 * Any cache may keep the response for a year without ever revalidating it.
	 *
	 * Correct only for URLs whose content cannot change, meaning assets whose file
	 * name carries a fingerprint of their bytes; on any other URL a stale copy has
	 * no way back.
	 *
	 * @returns `public, max-age=31536000, immutable`.
	 * @example
	 * Policies.immutable().toString(); // "public, max-age=31536000, immutable"
	 */
	static immutable(): CacheControl {
		return policy({ visibility: "public", maxAge: IMMUTABLE_MAX_AGE, immutable: true });
	}

	/**
	 * The response may be stored by its own client, but is checked with the origin
	 * before every reuse, which is what makes validators worth generating.
	 *
	 * `private` is part of the policy, not an extra: this is the policy for
	 * authenticated HTML, and a shared cache is bypassed neither by a session
	 * cookie nor by `no-cache` alone, which permits storing the variant it saw.
	 *
	 * @returns `private, no-cache`.
	 * @example
	 * Policies.revalidate().toString(); // "private, no-cache"
	 */
	static revalidate(): CacheControl {
		return policy({ visibility: "private", noCache: true });
	}
}
