/**
 * The type surface shared by every module here: the branded tag value, the
 * opaque policy string, the cache-status vocabulary, and the small cache
 * interface this package calls. Declaring the interface locally is what keeps
 * the package free of a runtime-specific import and testable with a double.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Type-only brand that makes a validated tag unassignable from a bare string. */
declare const CACHE_TAG_BRAND: unique symbol;

/**
 * A tag that has been validated against the platform's rules. Only a vocabulary
 * built by `createTags()` can produce one, so the header and the later purge
 * call are always built from the same declaration.
 */
export type CacheTag = string & { readonly [CACHE_TAG_BRAND]: true };

/**
 * A `Cache-Control` header value, opaque to this package. It comes from a policy
 * builder in the caller's own HTTP layer and is written through unchanged, which
 * is why nothing here parses it beyond looking for the `public` directive.
 */
export type CachePolicy = string;

/**
 * The platform's cache decision for a response, normalized to a closed set so
 * tests and logs stop string-matching a vendor header value.
 */
export type CacheStatus = "hit" | "miss" | "expired" | "bypass" | "unknown";

/**
 * The selector handed to the platform, with exactly one of its fields set. It is
 * the normalized form of {@link PurgeOptions}: tags are deduplicated and
 * validated before they reach here. Field names mirror the platform's own purge
 * options so a binding can be passed straight in as a {@link CacheInterface}.
 */
export interface PurgeSelector {
	/** Tags whose entries should be invalidated. */
	tags?: string[];
	/** URL prefixes whose entries should be invalidated, e.g. `example.com/blog/`. */
	pathPrefixes?: string[];
	/** Invalidate every entry; reserved for incident recovery. */
	purgeEverything?: boolean;
}

/** One problem the platform reported about a purge it declined to apply. */
export interface PurgeIssue {
	/** The platform's numeric code for the problem. */
	code: number;
	/** The platform's description of the problem. */
	message: string;
}

/**
 * What the platform reports back from a purge. A declined purge resolves with
 * `success: false` instead of rejecting, so this has to be read to know whether
 * the entries were invalidated at all.
 */
export interface PurgeOutcome {
	/** Whether the platform applied the purge. */
	success: boolean;
	/** What went wrong when it did not; empty once it succeeded. */
	errors: readonly PurgeIssue[];
}

/**
 * The subset of the platform cache object this package calls. Callers pass their
 * own binding, or a recording double in tests, so nothing here has to import a
 * runtime module or reach for a global.
 */
export interface CacheInterface {
	/**
	 * Invalidates the entries the selector matches.
	 *
	 * @param selector - Exactly one of tags, path prefixes, or everything.
	 * @returns The platform's outcome, which reports a refusal without rejecting.
	 */
	purge(selector: PurgeSelector): Promise<PurgeOutcome>;
}

/** Invalidate every entry tagged with any of these tags. */
export interface PurgeByTags {
	/** Tags to invalidate; an empty list is a failure rather than a no-op. */
	tags: readonly CacheTag[];
}

/** Invalidate every entry whose URL starts with one of these prefixes. */
export interface PurgeByPrefixes {
	/** Prefixes to invalidate, each including the host; an empty list is a failure rather than a no-op. */
	prefixes: readonly string[];
}

/** Invalidate every entry; reserved for incident recovery. */
export interface PurgeEverything {
	/** Always `true`; the field exists to make the intent explicit at the call site. */
	everything: true;
}

/** The three forms a purge can take, one per call. */
export type PurgeOptions = PurgeByTags | PurgeByPrefixes | PurgeEverything;
