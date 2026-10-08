/**
 * The value model of the digest fields: which fields exist, which algorithms this package
 * computes, and what each field parses to, so `parse` and `stringify` agree on one shape
 * per field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The algorithms `digest` and `verify` compute, spelled as RFC 9530 registers them. */
export type DigestAlgorithm = "sha-256" | "sha-512";

/**
 * The fields this package reads and writes: the four of RFC 9530, and RFC 3230's legacy
 * `Digest`, which draft-cavage HTTP signatures cover.
 */
export type DigestField =
	| "content-digest"
	| "repr-digest"
	| "want-content-digest"
	| "want-repr-digest"
	| "digest";

/** The fields that carry digests of a body, as opposed to preferences for one. */
export type DigestValueField = "content-digest" | "repr-digest" | "digest";

/**
 * Digest bytes keyed by lowercase algorithm name. Algorithms this package does not compute
 * are kept, so a field round-trips; `verify` checks only `sha-256` and `sha-512`.
 */
export type Digests = Record<string, Uint8Array>;

/**
 * Preference weights keyed by lowercase algorithm name, from `0` (not acceptable) to `10`
 * (most preferred), as `Want-Content-Digest` and `Want-Repr-Digest` carry them.
 */
export type Preferences = Record<string, number>;

/** What each field parses to and what `stringify` accepts for it. */
export interface FieldValues {
	"content-digest": Digests;
	"repr-digest": Digests;
	digest: Digests;
	"want-content-digest": Preferences;
	"want-repr-digest": Preferences;
}
