/**
 * Why a flag resolved to the value it did, as the specification enumerates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every reason the specification names, without closing the set: a provider may
 * answer with a reason of its own, so the enumerated members complete in an
 * editor while a provider-specific string still type-checks.
 */
export type Reason =
	| "STATIC"
	| "DEFAULT"
	| "TARGETING_MATCH"
	| "SPLIT"
	| "CACHED"
	| "DISABLED"
	| "UNKNOWN"
	| "STALE"
	| "ERROR"
	| (string & {});
