/**
 * The streaming line reader every JSON Lines reader in the package builds on. It splits bytes
 * at `\n` before decoding, so its memory bound is in the unit memory is spent in, and a
 * character split across chunks is decoded once, whole, with the line it belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { JSONLError } from "./errors.js";

/** Bytes a JSON Lines reader accepts: a web stream, or any async iterable of chunks. */
export type ByteSource = ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>;

/** One non-blank line of the input. */
export interface Line {
	/** The line without its `\n`, or the `\r` before it. */
	text: string;
	/** 1-based, counting blank lines too, so it matches the line an editor shows. */
	number: number;
}

/** How much of the input `lines` accepts and where it starts yielding. */
export interface LinesOptions {
	/**
	 * The longest line accepted, in encoded UTF-8 bytes. A longer line yields one
	 * `line-too-long` failure and reading stops, so untrusted input never grows the buffer past it.
	 */
	maxLineBytes?: number;
	/**
	 * How many non-blank lines to drop before the first one yielded: a count of values a previous
	 * run consumed, so it resumes at the same row whatever blank lines the input holds.
	 */
	skip?: number;
}

/** `\n`, the byte that ends a line; it never occurs inside a multi-byte UTF-8 sequence. */
const NEWLINE = 0x0a;

/** `\r`, dropped when it directly precedes the `\n`. */
const CARRIAGE_RETURN = 0x0d;

/**
 * Every non-blank line of `source`, in order. `\n` ends a line and a `\r` before it is removed;
 * a last line with no newline still counts; a leading byte-order mark is ignored. Blank lines
 * are skipped but counted, so `number` matches the editor's line numbers.
 *
 * @yields Each line, or one `line-too-long` failure after which reading stops.
 * @example
 * for await (let line of lines(request.body, { maxLineBytes: 1_048_576 })) {
 *   if (isFailure(line)) return line;
 *   line.data.text;
 * }
 */
export async function* lines(
	source: ByteSource,
	options: LinesOptions = {},
): AsyncGenerator<Result<Line, JSONLError>> {
	let maxLineBytes = options.maxLineBytes ?? Number.POSITIVE_INFINITY;
	let toSkip = options.skip ?? 0;
	let decoder = new TextDecoder("utf-8", { ignoreBOM: true });
	let pending: Uint8Array[] = [];
	let pendingBytes = 0;
	let number = 0;
	let first = true;

	/** The finished line as text, the byte-order mark dropped from the very first one. */
	function decode(bytes: Uint8Array): string {
		let text = decoder.decode(bytes);
		if (first) {
			first = false;
			if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
		}
		return text;
	}

	for await (let chunk of chunks(source)) {
		let start = 0;
		let newline = chunk.indexOf(NEWLINE, start);
		while (newline !== -1) {
			let piece = chunk.subarray(start, newline);
			if (pendingBytes + piece.length > maxLineBytes) {
				yield tooLong(number + 1, maxLineBytes);
				return;
			}
			let bytes = join(pending, pendingBytes, piece);
			pending = [];
			pendingBytes = 0;
			number += 1;
			if (bytes.at(-1) === CARRIAGE_RETURN) bytes = bytes.subarray(0, -1);
			let text = decode(bytes);
			start = newline + 1;
			newline = chunk.indexOf(NEWLINE, start);
			if (isBlank(text)) continue;
			if (toSkip > 0) {
				toSkip -= 1;
				continue;
			}
			yield success({ text, number });
		}
		if (start < chunk.length) {
			let rest = chunk.slice(start);
			pendingBytes += rest.length;
			if (pendingBytes > maxLineBytes) {
				yield tooLong(number + 1, maxLineBytes);
				return;
			}
			pending.push(rest);
		}
	}
	if (pendingBytes === 0) return;
	number += 1;
	let text = decode(join(pending, pendingBytes, new Uint8Array(0)));
	if (text.endsWith("\r")) text = text.slice(0, -1);
	if (isBlank(text) || toSkip > 0) return;
	yield success({ text, number });
}

/** Whether a line holds nothing but spaces and tabs, which JSON Lines treats as no line at all. */
export function isBlank(text: string): boolean {
	for (let index = 0; index < text.length; index += 1) {
		let char = text[index];
		if (char !== " " && char !== "\t") return false;
	}
	return true;
}

/**
 * Chunks from either source shape; a web stream's lock is released when reading ends early.
 *
 * @yields Each chunk, in order.
 */
async function* chunks(source: ByteSource): AsyncGenerator<Uint8Array> {
	if (!("getReader" in source)) {
		yield* source;
		return;
	}
	let reader = source.getReader();
	try {
		while (true) {
			let next = await reader.read();
			if (next.done) return;
			yield next.value;
		}
	} finally {
		reader.releaseLock();
	}
}

/** The pending pieces and `last` as one contiguous array, copying only when there is more than one. */
function join(pending: Uint8Array[], pendingBytes: number, last: Uint8Array): Uint8Array {
	if (pending.length === 0) return last;
	let bytes = new Uint8Array(pendingBytes + last.length);
	let offset = 0;
	for (let piece of pending) {
		bytes.set(piece, offset);
		offset += piece.length;
	}
	bytes.set(last, offset);
	return bytes;
}

/** The failure for a line over the limit, numbered as the line being read when it was crossed. */
function tooLong(line: number, maxLineBytes: number): Result<never, JSONLError> {
	return failure(
		new JSONLError("line-too-long", `Line is longer than ${maxLineBytes} bytes`, line),
	);
}
