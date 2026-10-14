/**
 * Reads and writes JSON Lines (also published as NDJSON), one JSON value per line, with one set
 * of line rules for every reader, a bounded buffer for untrusted input and line numbers in every
 * failure. Import it as a namespace, `import * as JSONL from "@sdxc/jsonl"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { JSONLErrorCode } from "./errors.js";
export type { ByteSource, Line, LinesOptions } from "./lines.js";
export type { Entry, ReadOptions } from "./read.js";

export { JSONLError } from "./errors.js";
export { lines } from "./lines.js";
export { parse, read } from "./read.js";
export { encode, encodeLines, stringify } from "./write.js";
