/**
 * The RFC 7464 writers: every record is RS, the JSON text and LF, an RS inside a string is
 * escaped, and `encodeSequence` and `encodeSequenceTexts` stream the same framing and error the
 * stream on a value they cannot write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	encodeSequence,
	encodeSequenceTexts,
	JSONSeqError,
	parseSequence,
	stringifySequence,
} from "./index.js";

/** Everything `stream` produces as text, or the reason it errored. */
async function drain(
	stream: ReadableStream<Uint8Array>,
): Promise<{ text: string; error?: unknown }> {
	let text = "";
	let decoder = new TextDecoder();
	try {
		for await (let chunk of stream) text += decoder.decode(chunk, { stream: true });
	} catch (error) {
		return { text, error };
	}
	return { text: text + decoder.decode() };
}

describe("stringifySequence", () => {
	test("frames every value with RS before and LF after", () => {
		expect(unwrap(stringifySequence([{ a: 1 }, 2, true, null]))).toBe(
			'\x1e{"a":1}\n\x1e2\n\x1etrue\n\x1enull\n',
		);
		expect(unwrap(stringifySequence([]))).toBe("");
	});

	test("escapes an RS inside a string, so a value stays one record", () => {
		let output = unwrap(stringifySequence([{ text: "a\x1eb" }]));

		expect(output.split("\x1e")).toHaveLength(2);
		expect(unwrap(parseSequence(output))).toEqual([{ text: "a\x1eb" }]);
	});

	test.each([
		["a function", () => 1],
		["undefined", undefined],
		["a BigInt", 1n],
	])("fails on %s with the record it would take", (_, value) => {
		let result = stringifySequence([1, value]);

		expect(isFailure(result) && [result.error.code, result.error.record]).toEqual([
			"unserializable",
			2,
		]);
	});
});

describe("encodeSequence", () => {
	test("streams the same bytes stringifySequence returns", async () => {
		let values = [{ a: "é漢😀" }, [1, 2], 3];

		expect(await drain(encodeSequence(values))).toEqual({
			text: unwrap(stringifySequence(values)),
		});
	});

	test("errors the stream on an unserializable value, after the records before it", async () => {
		let { text, error } = await drain(encodeSequence([1, () => 2, 3]));

		expect(text).toBe("\x1e1\n");
		expect(error instanceof JSONSeqError && [error.code, error.record]).toEqual([
			"unserializable",
			2,
		]);
	});

	test("returns the iterator when the stream is cancelled", async () => {
		let finished = false;
		function* values() {
			try {
				yield 1;
				yield 2;
			} finally {
				finished = true;
			}
		}

		let reader = encodeSequence(values()).getReader();
		await reader.read();
		await reader.cancel();

		expect(finished).toBe(true);
	});
});

describe("encodeSequenceTexts", () => {
	test("writes already-serialized texts verbatim, multi-line ones included", async () => {
		expect(await drain(encodeSequenceTexts(['{"b":1, "a":2}', "[\n  1\n]"]))).toEqual({
			text: '\x1e{"b":1, "a":2}\n\x1e[\n  1\n]\n',
		});
	});

	test("errors the stream on a text holding an RS", async () => {
		let { text, error } = await drain(encodeSequenceTexts(["0", "1\x1e2"]));

		expect(text).toBe("\x1e0\n");
		expect(error instanceof JSONSeqError && [error.code, error.record]).toEqual([
			"unserializable",
			2,
		]);
	});
});
