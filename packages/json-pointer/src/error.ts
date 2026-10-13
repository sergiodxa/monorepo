/**
 * Failures a JSON Pointer operation reports: a string that is not a pointer, or
 * a pointer that does not resolve in the document it was applied to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A JSON Pointer that cannot be applied: the string is not RFC 6901, or a token
 * has no member, index, or container to land on.
 */
export class JsonPointerError extends Error {
	override name = "JsonPointerError";
}

/**
 * A string that is not an RFC 6901 JSON Pointer: it is neither empty nor `/`-prefixed,
 * or it contains a `~` that is not the start of `~0` or `~1`.
 */
export class JsonPointerParseError extends JsonPointerError {
	override name = "JsonPointerParseError";
}
