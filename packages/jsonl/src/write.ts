/**
 * The JSON Lines writers: `stringify` for a string in memory, and `encode`/`encodeLines` for a
 * byte stream built lazily, one line per pull, so a response body or an object upload never
 * holds the whole file at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { JSONLError } from "./errors.js";

/**
 * Each value as one `\n`-terminated line, so the output ends with a newline; an empty input is
 * an empty string. A value `JSON.stringify` turns into `undefined` (a function, a bare
 * `undefined`) fails with the line it would have taken.
 *
 * @example stringify([{ a: 1 }, [2]]) // success('{"a":1}\n[2]\n')
 */
export function stringify(values: Iterable<unknown>): Result<string, JSONLError> {
	let output = "";
	let number = 0;
	for (let value of values) {
		number += 1;
		let line = serialize(value, number);
		if (isFailure(line)) return line;
		output += `${line.data}\n`;
	}
	return success(output);
}

/**
 * {@link stringify} as a byte stream, pulling one value at a time. An unserializable value
 * errors the stream with its `JSONLError`; cancelling the stream returns the iterator.
 *
 * @example await bucket.put(key, encode(rows));
 */
export function encode(
	values: Iterable<unknown> | AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
	let number = 0;
	return stream(values, (value) => {
		number += 1;
		return serialize(value, number);
	});
}

/**
 * Lines that are already JSON, written verbatim with a `\n` after each, for input read from
 * another JSON Lines file. A line holding a `\n` or `\r` would split into two and errors the stream.
 *
 * @example await bucket.put(key, encodeLines(existingLines));
 */
export function encodeLines(
	lines: Iterable<string> | AsyncIterable<string>,
): ReadableStream<Uint8Array> {
	let number = 0;
	return stream(lines, (line) => {
		number += 1;
		if (line.includes("\n") || line.includes("\r")) {
			return failure(new JSONLError("unserializable", "Line contains a line break", number));
		}
		return success(line);
	});
}

/** `JSON.stringify` as a result; a cycle or a `BigInt` fails just as a function or `undefined` does. */
function serialize(value: unknown, number: number): Result<string, JSONLError> {
	let line: string | undefined;
	try {
		line = JSON.stringify(value);
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(
			new JSONLError("unserializable", `Value cannot be written as JSON (${reason})`, number, {
				cause: error,
			}),
		);
	}
	if (line === undefined) {
		return failure(new JSONLError("unserializable", "Value has no JSON representation", number));
	}
	return success(line);
}

/** A pull stream writing one line per item of `items`, each turned into text by `toLine`. */
function stream<T>(
	items: Iterable<T> | AsyncIterable<T>,
	toLine: (item: T) => Result<string, JSONLError>,
): ReadableStream<Uint8Array> {
	let encoder = new TextEncoder();
	let iterator: Iterator<T> | AsyncIterator<T> =
		Symbol.asyncIterator in items ? items[Symbol.asyncIterator]() : items[Symbol.iterator]();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			let next = await iterator.next();
			if (next.done === true) {
				controller.close();
				return;
			}
			let line = toLine(next.value);
			if (isFailure(line)) {
				controller.error(line.error);
				await iterator.return?.();
				return;
			}
			controller.enqueue(encoder.encode(`${line.data}\n`));
		},
		async cancel(reason) {
			await iterator.return?.(reason);
		},
	});
}
