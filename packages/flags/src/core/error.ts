/**
 * The closed set of codes an evaluation reports when it could not answer with a
 * resolved value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why an evaluation ended in the default value. The set is closed, so a
 * consumer can branch on it exhaustively and anything the specification does
 * not name arrives as `GENERAL`.
 */
export type ErrorCode =
	| "PROVIDER_NOT_READY"
	| "PROVIDER_FATAL"
	| "FLAG_NOT_FOUND"
	| "PARSE_ERROR"
	| "TYPE_MISMATCH"
	| "TARGETING_KEY_MISSING"
	| "INVALID_CONTEXT"
	| "GENERAL";
