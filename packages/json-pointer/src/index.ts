/**
 * Parse, stringify, get and set RFC 6901 JSON Pointers, so callers share one
 * encoding of path segments instead of each escaping `~` and `/` on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { JsonPointerError, JsonPointerParseError } from "./error.js";
export { get } from "./get.js";
export { parse } from "./parse.js";
export { set } from "./set.js";
export { stringify } from "./stringify.js";
