/**
 * Provides RFC 4180 CSV reading and writing: `parse`, `stringify` and the streaming
 * `streamify`, exported one by one so a caller that only reads never carries the writers,
 * and read together as `CSV.parse` under a namespace import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type {
	Cell,
	CellRecord,
	Column,
	Delimiter,
	ParseOptions,
	Parsed,
	ParseWarning,
	StringifyOptions,
	WriteOptions,
} from "./lib/types.js";

export { CSVParseError, CSVStringifyError } from "./lib/errors.js";
export { parse } from "./lib/parse.js";
export { streamify } from "./lib/streamify.js";
export { stringify } from "./lib/stringify.js";
