/**
 * The JSON text sequence writers (RFC 7464, `application/json-seq`): every record is RS, one
 * JSON text, then LF, so a reader can tell a whole record from one cut off mid-write, built in
 * memory by `stringifySequence` or lazily, one record per pull, by the `encode` streams.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { JSONSeqError } from "./errors.js";
import { stream } from "./write.js";

/**
 * Each value as one RS-prefixed, LF-terminated record; an empty input is an empty string. A
 * value `JSON.stringify` cannot write (a function, a bare `undefined`, a `BigInt`, a cycle)
 * fails with the record it would have taken.
 *
 * @example stringifySequence([{ a: 1 }, 2]) // success('\x1e{"a":1}\n\x1e2\n')
 */
export function stringifySequence(values: Iterable<unknown>): Result<string, JSONSeqError> {
	let output = "";
	let number = 0;
	for (let value of values) {
		number += 1;
		let record = serialize(value, number);
		if (isFailure(record)) return record;
		output += record.data;
	}
	return success(output);
}

/**
 * {@link stringifySequence} as a byte stream, pulling one value per record. An unserializable
 * value errors the stream with its `JSONSeqError`; cancelling the stream returns the iterator.
 *
 * @example new Response(encodeSequence(events), { headers: { "Content-Type": "application/json-seq" } })
 */
export function encodeSequence(
	values: Iterable<unknown> | AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
	let number = 0;
	return stream(values, (value) => {
		number += 1;
		return serialize(value, number);
	});
}

/**
 * JSON texts that are already serialized, written verbatim between an RS and an LF, for records
 * copied from another sequence. A text holding an RS would split into two records and errors the stream.
 *
 * @example await bucket.put(key, encodeSequenceTexts(existingTexts));
 */
export function encodeSequenceTexts(
	texts: Iterable<string> | AsyncIterable<string>,
): ReadableStream<Uint8Array> {
	let number = 0;
	return stream(texts, (text) => {
		number += 1;
		if (text.includes("\x1e")) {
			return failure(
				new JSONSeqError("unserializable", "Text contains a record separator", number),
			);
		}
		return success(`\x1e${text}\n`);
	});
}

/**
 * The value as a framed record. `JSON.stringify` escapes U+001E inside strings, so the text
 * never holds a raw RS.
 */
function serialize(value: unknown, number: number): Result<string, JSONSeqError> {
	let text: string | undefined;
	try {
		text = JSON.stringify(value);
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(
			new JSONSeqError("unserializable", `Value cannot be written as JSON (${reason})`, number, {
				cause: error,
			}),
		);
	}
	if (text === undefined) {
		return failure(new JSONSeqError("unserializable", "Value has no JSON representation", number));
	}
	return success(`\x1e${text}\n`);
}
