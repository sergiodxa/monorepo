/**
 * The writers' output and failure contracts: `stringify` ends every value with a newline and
 * names the line an unserializable value would take, while `encode` and `encodeLines` stream the
 * same bytes and error the stream on a value they cannot write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { encode, encodeLines, JSONLError, parse, stringify } from "./index.js";

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

describe("stringify", () => {
	test("writes one newline-terminated line per value", () => {
		expect(unwrap(stringify([{ a: 1 }, [2], "three", null]))).toBe('{"a":1}\n[2]\n"three"\nnull\n');
		expect(unwrap(stringify([]))).toBe("");
	});

	test("escapes newlines inside strings, so each value stays on its line", () => {
		let output = unwrap(stringify([{ text: "a\nb\r\nc" }]));

		expect(output.split("\n")).toHaveLength(2);
		expect(unwrap(parse(output))).toEqual([{ text: "a\nb\r\nc" }]);
	});

	test.each([
		["a function", () => 1],
		["undefined", undefined],
		["a BigInt", 1n],
	])("fails on %s with the line it would take", (_, value) => {
		let result = stringify([1, value]);

		expect(isFailure(result) && [result.error.code, result.error.line]).toEqual([
			"unserializable",
			2,
		]);
	});

	test("fails on a cycle", () => {
		let cycle: Record<string, unknown> = {};
		cycle.self = cycle;

		let result = stringify([cycle]);
		expect(isFailure(result) && result.error.cause).toBeInstanceOf(TypeError);
	});
});

describe("encode", () => {
	test("streams the same bytes stringify returns", async () => {
		let values = [{ a: "é漢😀" }, [1, 2], true];

		expect(await drain(encode(values))).toEqual({ text: unwrap(stringify(values)) });
	});

	test("pulls from an async iterable", async () => {
		async function* values() {
			yield 1;
			yield { b: 2 };
		}

		expect(await drain(encode(values()))).toEqual({ text: '1\n{"b":2}\n' });
	});

	test("errors the stream on an unserializable value, after the lines before it", async () => {
		let { text, error } = await drain(encode([1, () => 2, 3]));

		expect(text).toBe("1\n");
		expect(error).toBeInstanceOf(JSONLError);
		expect(error instanceof JSONLError && [error.code, error.line]).toEqual(["unserializable", 2]);
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

		let reader = encode(values()).getReader();
		await reader.read();
		await reader.cancel();

		expect(finished).toBe(true);
	});
});

describe("encodeLines", () => {
	test("writes already-serialized lines verbatim", async () => {
		let lines = ['{"b":1, "a":2}', "[ 1 ]"];

		expect(await drain(encodeLines(lines))).toEqual({ text: '{"b":1, "a":2}\n[ 1 ]\n' });
	});

	test.each(["1\n2", "1\r"])("errors the stream on a line holding a line break", async (line) => {
		let { text, error } = await drain(encodeLines(["0", line]));

		expect(text).toBe("0\n");
		expect(error instanceof JSONLError && [error.code, error.line]).toEqual(["unserializable", 2]);
	});
});
