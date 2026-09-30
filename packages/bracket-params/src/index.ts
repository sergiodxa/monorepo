/**
 * Reads and writes nested fields with bracket syntax: `parse` validates a query or form against
 * a Standard Schema, `stringify` and `toFormData` write a value back, and `fieldName` one key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { PathSegment } from "./lib/field-name.js";
export type { BracketParamsSource, ParseOptions } from "./lib/parse.js";
export type { BracketInput, FormValue, TextValue } from "./lib/stringify.js";

export { fieldName } from "./lib/field-name.js";
export { parse } from "./lib/parse.js";
export { stringify, toFormData } from "./lib/stringify.js";
