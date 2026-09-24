/**
 * Applies, generates, reads and validates RFC 7396 JSON merge patches on plain JSON values,
 * the partial-update format where a body lists only the members that change and `null`
 * removes one. Reading a patch off a `Request` lives in the `./request` entry point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { JSONObject, JSONValue } from "./json-value.js";
export type { MergePatchOf } from "./merge-patch-of.js";

export { apply } from "./apply.js";
export { applyValidated, MergePatchValidationError } from "./apply-validated.js";
export { diff, UnrepresentableChangeError } from "./diff.js";
export { MEDIA_TYPE } from "./media-type.js";
export { MergePatchParseError, parse, stringify } from "./parse.js";
