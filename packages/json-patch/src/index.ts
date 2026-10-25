/**
 * Applies, validates and generates RFC 6902 JSON Patch documents: ordered operations that
 * add, remove, replace, move, copy and test values at JSON Pointers, applied all or nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { JsonPatchErrorReason } from "./error.js";
export type { JSONObject, JSONValue } from "./json-value.js";
export type {
	AddOperation,
	CopyOperation,
	JSONPatch,
	MoveOperation,
	Operation,
	RemoveOperation,
	ReplaceOperation,
	TestOperation,
} from "./operation.js";

export { apply } from "./apply.js";
export { diff } from "./diff.js";
export { JsonPatchError } from "./error.js";
export { MEDIA_TYPE } from "./media-type.js";
export { parse, stringify } from "./parse.js";
export { validate } from "./validate.js";
