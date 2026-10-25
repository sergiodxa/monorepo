/**
 * The JSON text sequence readers (RFC 7464, `application/json-seq`): `records` splits bytes at
 * the RS that opens every record, `readSequence` parses and validates each one, and
 * `parseSequence` reads a whole string, all with the RFC's rules for empty and truncated records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";

import type { ByteSource } from "./lines.js";

import { JSONSeqError } from "./errors.js";
import { chunks, join } from "./lines.js";

/** One non-empty record of a JSON text sequence. */
export interface SequenceRecord {
	/** The JSON text, without its RS and with the whitespace around it trimmed. */
	text: string;
	/** 1-based position among the non-empty records. */
	number: number;
}

/** How much of the input `records` accepts and where it starts yielding. */
export interface RecordsOptions {
	/**
	 * The longest record accepted, in encoded UTF-8 bytes between two RS. A longer record yields
	 * one `record-too-long` failure and reading stops, so untrusted input never grows the buffer past it.
	 */
	maxRecordBytes?: number;
	/** How many non-empty records to drop before the first one yielded, so a run resumes where it stopped. */
	skip?: number;
}

/** One value read from a sequence, with the record it came from. */
export interface SequenceEntry<T> {
	value: T;
	/** 1-based position among the non-empty records. */
	number: number;
}

/** The record rules of {@link records}, plus the schema every value must satisfy. */
export interface SequenceReadOptions<
	Schema extends StandardSchemaV1 | undefined,
> extends RecordsOptions {
	/** Validates every parsed record; a rejected one yields an `invalid-value` failure with its issues. */
	schema?: Schema;
}

/** The value a schema produces, or `unknown` when there is none. */
type Output<Schema> = Schema extends StandardSchemaV1
	? StandardSchemaV1.InferOutput<Schema>
	: unknown;

/** RS, the byte that opens every record; it never occurs inside a multi-byte UTF-8 sequence. */
const RECORD_SEPARATOR = 0x1e;

/** The first characters of a top-level number, `true`, `false` or `null`, whose end JSON cannot mark. */
const SCALAR_STARTS = "-0123456789tfn";

/**
 * Every non-empty record of `source`, in order. Bytes are split at RS before decoding, empty and
 * whitespace-only records are skipped, and a record is complete when the next RS or the end of
 * the input arrives; a leading byte-order mark is ignored.
 *
 * @yields Each record or its `truncated` failure, or one `record-too-long` failure after which reading stops.
 * @example
 * for await (let record of records(body, { maxRecordBytes: 65_536 })) {
 *   if (isFailure(record)) continue;
 *   record.data.text;
 * }
 */
export async function* records(
	source: ByteSource,
	options: RecordsOptions = {},
): AsyncGenerator<Result<SequenceRecord, JSONSeqError>> {
	let maxRecordBytes = options.maxRecordBytes ?? Number.POSITIVE_INFINITY;
	let toSkip = options.skip ?? 0;
	let decoder = new TextDecoder("utf-8", { ignoreBOM: true });
	let pending: Uint8Array[] = [];
	let pendingBytes = 0;
	let number = 0;
	let first = true;

	/** The record `bytes` hold, or `undefined` for an empty or skipped one. */
	function element(bytes: Uint8Array): Result<SequenceRecord, JSONSeqError> | undefined {
		let text = decoder.decode(bytes);
		if (first) {
			first = false;
			if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
		}
		if (isEmpty(text)) return undefined;
		number += 1;
		if (toSkip > 0) {
			toSkip -= 1;
			return undefined;
		}
		return checkRecord(text, number);
	}

	for await (let chunk of chunks(source)) {
		let start = 0;
		let separator = chunk.indexOf(RECORD_SEPARATOR, start);
		while (separator !== -1) {
			let piece = chunk.subarray(start, separator);
			if (pendingBytes + piece.length > maxRecordBytes) {
				yield tooLong(number + 1, maxRecordBytes);
				return;
			}
			let record = element(join(pending, pendingBytes, piece));
			pending = [];
			pendingBytes = 0;
			start = separator + 1;
			separator = chunk.indexOf(RECORD_SEPARATOR, start);
			if (record !== undefined) yield record;
		}
		if (start < chunk.length) {
			let rest = chunk.slice(start);
			pendingBytes += rest.length;
			if (pendingBytes > maxRecordBytes) {
				yield tooLong(number + 1, maxRecordBytes);
				return;
			}
			pending.push(rest);
		}
	}
	if (pendingBytes === 0) return;
	let record = element(join(pending, pendingBytes, new Uint8Array(0)));
	if (record !== undefined) yield record;
}

/**
 * Every value in `source`, one per non-empty record. A record that is truncated, is not JSON, or
 * that the schema rejects yields a failure with its record number and reading continues, as
 * RFC 7464 lets a parser skip it; only a record over `maxRecordBytes` stops it.
 *
 * @yields Each value, or the failure for the record that could not be read.
 * @example
 * for await (let entry of readSequence(body, { schema: Event })) {
 *   if (isFailure(entry)) continue;
 *   entry.data.value;
 * }
 */
export async function* readSequence<Schema extends StandardSchemaV1 | undefined = undefined>(
	source: ByteSource,
	options: SequenceReadOptions<Schema> = {},
): AsyncGenerator<Result<SequenceEntry<Output<Schema>>, JSONSeqError>> {
	for await (let record of records(source, options)) {
		if (isFailure(record)) {
			yield record;
			if (record.error.code === "record-too-long") return;
			continue;
		}
		let parsed = parseRecord(record.data.text, record.data.number);
		if (isFailure(parsed)) {
			yield parsed;
			continue;
		}
		let entry = await validate(options.schema, parsed.data, record.data.number);
		yield entry as Result<SequenceEntry<Output<Schema>>, JSONSeqError>;
	}
}

/**
 * Every value in JSON text sequence `text`, or the first record that is truncated or not JSON.
 * The same record rules as {@link readSequence} apply: empty records skipped, a leading
 * byte-order mark ignored.
 *
 * @example parseSequence('\x1e{"a":1}\n\x1e2\n') // success([{ a: 1 }, 2])
 */
export function parseSequence(text: string): Result<unknown[], JSONSeqError> {
	let values: unknown[] = [];
	let body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	let number = 0;
	for (let element of body.split("\x1e")) {
		if (isEmpty(element)) continue;
		number += 1;
		let record = checkRecord(element, number);
		if (isFailure(record)) return record;
		let parsed = parseRecord(record.data.text, number);
		if (isFailure(parsed)) return parsed;
		values.push(parsed.data);
	}
	return success(values);
}

/** Whether `char` is JSON whitespace: space, tab, line feed or carriage return. */
function isWhitespace(char: string | undefined): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r";
}

/** Whether a record holds nothing but JSON whitespace, which the sequence treats as no record. */
function isEmpty(text: string): boolean {
	for (let char of text) if (!isWhitespace(char)) return false;
	return true;
}

/**
 * The record trimmed, or a `truncated` failure when it is a top-level number, `true`, `false` or
 * `null` with no whitespace after it: its end cannot be told from a cut-off write.
 */
function checkRecord(text: string, number: number): Result<SequenceRecord, JSONSeqError> {
	let trimmed = text.replace(/^[ \t\n\r]+|[ \t\n\r]+$/g, "");
	if (SCALAR_STARTS.includes(trimmed.charAt(0)) && !isWhitespace(text.at(-1))) {
		return failure(
			new JSONSeqError("truncated", "Record may be truncated: no whitespace after it", number),
		);
	}
	return success({ text: trimmed, number });
}

/** `JSON.parse` as a result, its engine message kept in the reason and the native error as `cause`. */
function parseRecord(text: string, number: number): Result<unknown, JSONSeqError> {
	try {
		return success(JSON.parse(text));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(
			new JSONSeqError("invalid-json", `Record is not valid JSON (${reason})`, number, {
				cause: error,
			}),
		);
	}
}

/** The schema's verdict as an entry; a schema that validates asynchronously is awaited. */
async function validate(
	schema: StandardSchemaV1 | undefined,
	value: unknown,
	number: number,
): Promise<Result<SequenceEntry<unknown>, JSONSeqError>> {
	if (schema === undefined) return success({ value, number });
	let outcome = await schema["~standard"].validate(value);
	if (outcome.issues !== undefined) {
		let first = outcome.issues[0]?.message ?? "Value is invalid";
		return failure(
			new JSONSeqError("invalid-value", `Record does not match the schema: ${first}`, number, {
				issues: outcome.issues,
			}),
		);
	}
	return success({ value: outcome.value, number });
}

/** The failure for a record over the limit, numbered as the record being read when it was crossed. */
function tooLong(record: number, maxRecordBytes: number): Result<never, JSONSeqError> {
	return failure(
		new JSONSeqError("record-too-long", `Record is longer than ${maxRecordBytes} bytes`, record),
	);
}
