/**
 * Reads and writes JSON Lines (also published as NDJSON) and RFC 7464 JSON text sequences, with
 * one set of record rules per format, a bounded buffer for untrusted input and a line or record
 * number in every failure. Import it as a namespace, `import * as JSONL from "@sdxc/jsonl"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { JSONLErrorCode, JSONSeqErrorCode } from "./errors.js";
export type { ByteSource, Line, LinesOptions } from "./lines.js";
export type { Entry, ReadOptions } from "./read.js";
export type {
	RecordsOptions,
	SequenceEntry,
	SequenceReadOptions,
	SequenceRecord,
} from "./sequence.js";

export { JSONLError, JSONSeqError } from "./errors.js";
export { lines } from "./lines.js";
export { parse, read } from "./read.js";
export { encodeSequence, encodeSequenceTexts, stringifySequence } from "./sequence-write.js";
export { parseSequence, readSequence, records } from "./sequence.js";
export { encode, encodeLines, stringify } from "./write.js";
