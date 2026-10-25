/**
 * RFC 9535 JSONPath: parse a query once, select nodes from JSON values with their
 * normalized paths, and use every function extension the RFC defines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { JSONValue } from "./ast.js";
export type { JsonPathNode } from "./json-path.js";

export { JsonPathSyntaxError } from "./error.js";
export { JSONPath, query } from "./json-path.js";
export { normalizedPath } from "./normalized-path.js";
