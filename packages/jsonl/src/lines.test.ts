/**
 * The line rules `lines` defines for every reader: `\r\n`, blank lines counted but skipped, a
 * final line without a newline, a byte-order mark, characters split across chunks, the byte
 * limit and `skip` counting rows rather than lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import type { JSONLError, Line, LinesOptions } from "./index.js";

import { lines } from "./index.js";

/** The bytes of `text` cut into the given chunk sizes, the last chunk taking what is left. */
function chunked(text: string, sizes: number[] = []): Uint8Array[] {
	let bytes = new TextEncoder().encode(text);
	let chunks: Uint8Array[] = [];
	let offset = 0;
	for (let size of sizes) {
		chunks.push(bytes.slice(offset, offset + size));
		offset += size;
	}
	chunks.push(bytes.slice(offset));
	return chunks;
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			for (let chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
}

async function collect(
	chunks: Uint8Array[],
	options?: LinesOptions,
): Promise<Result<Line, JSONLError>[]> {
	let results: Result<Line, JSONLError>[] = [];
	for await (let line of lines(streamOf(chunks), options)) results.push(line);
	return results;
}

describe("lines", () => {
	test("splits on \\n, drops a \\r before it and keeps a last line without a newline", async () => {
		let results = await collect(chunked('{"a":1}\r\n{"a":2}\n{"a":3}'));

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: '{"a":1}', number: 1 },
			{ text: '{"a":2}', number: 2 },
			{ text: '{"a":3}', number: 3 },
		]);
	});

	test("skips blank lines and still counts them", async () => {
		let results = await collect(chunked("1\n\n  \n\t\r\n2\n\n"));

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: "1", number: 1 },
			{ text: "2", number: 5 },
		]);
	});

	test("ignores a leading byte-order mark only", async () => {
		let results = await collect(chunked("\uFEFF1\n\uFEFF2\n"));

		expect(results.map((line) => unwrap(line).text)).toEqual(["1", "\uFEFF2"]);
	});

	test("decodes a character split across chunks once", async () => {
		let text = '"é漢😀"\n"x"\n';
		for (let size = 1; size < 8; size += 1) {
			let results = await collect(chunked(text, [size, 1, 1]));
			expect(results.map((line) => unwrap(line).text)).toEqual(['"é漢😀"', '"x"']);
		}
	});

	test("handles a \\r\\n and a byte-order mark split across chunks", async () => {
		let results = await collect(chunked("\uFEFF1\r\n2\r\n", [1, 1, 1, 1, 1]));

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: "1", number: 1 },
			{ text: "2", number: 2 },
		]);
	});

	test("releases a web stream's lock when the caller stops early", async () => {
		let stream = streamOf(chunked("1\n2\n3\n"));
		for await (let line of lines(stream)) {
			unwrap(line);
			break;
		}

		expect(stream.locked).toBe(false);
	});

	test("accepts any async iterable of bytes", async () => {
		async function* source() {
			yield* chunked("1\n2", [1]);
		}
		let texts: string[] = [];
		for await (let line of lines(source())) texts.push(unwrap(line).text);

		expect(texts).toEqual(["1", "2"]);
	});

	test("stops with one failure at the first line longer than maxLineBytes, in bytes", async () => {
		let results = await collect(chunked("12\n\n12345\n1\n", [4]), { maxLineBytes: 4 });

		expect(results).toHaveLength(2);
		expect(unwrap(results[0] as Result<Line, JSONLError>)).toEqual({ text: "12", number: 1 });
		let last = results[1];
		expect(last !== undefined && isFailure(last) && [last.error.code, last.error.line]).toEqual([
			"line-too-long",
			3,
		]);
	});

	test("measures the limit in encoded bytes, before decoding", async () => {
		let results = await collect(chunked('"éé"\n'), { maxLineBytes: 5 });

		expect(results.length === 1 && isFailure(results[0] as Result<Line, JSONLError>)).toBe(true);
	});

	test("counts a line's bytes across every chunk it spans", async () => {
		let results = await collect(chunked("1234\n123456\n", [2, 3, 2, 2]), { maxLineBytes: 5 });

		expect(results.map((line) => isFailure(line))).toEqual([false, true]);
	});

	test("accepts a line of exactly maxLineBytes", async () => {
		let results = await collect(chunked("12345\n12345"), { maxLineBytes: 5 });

		expect(results.map((line) => unwrap(line).text)).toEqual(["12345", "12345"]);
	});

	test("bounds a final line with no newline too", async () => {
		let results = await collect(chunked("x".repeat(10), [3, 3, 3]), { maxLineBytes: 8 });

		expect(results.map((line) => isFailure(line))).toEqual([true]);
	});

	test("skips non-blank lines only, numbering what follows by every line", async () => {
		let results = await collect(chunked("1\n\n2\n\n3\n4"), { skip: 2 });

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: "3", number: 5 },
			{ text: "4", number: 6 },
		]);
	});
});
