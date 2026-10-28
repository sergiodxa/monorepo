/**
 * Unit tests for newline-delimited JSON framing used on the agent-facing stdio transport.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Readable, Writable } from "node:stream";

import { describe, expect, test } from "vitest";

import { readJsonLines, writeJsonLine } from "./framing.js";

describe("readJsonLines", () => {
	test("yields one object per complete line", async () => {
		let input = Readable.from(['{"a":1}\n', '{"b":2}\n']);
		let values: unknown[] = [];
		for await (let value of readJsonLines(input)) values.push(value);
		expect(values).toEqual([{ a: 1 }, { b: 2 }]);
	});

	test("skips blank lines and ignores a trailing partial line", async () => {
		let input = Readable.from(['\n{"ok":true}\n partial']);
		let values: unknown[] = [];
		for await (let value of readJsonLines(input)) values.push(value);
		expect(values).toEqual([{ ok: true }]);
	});
});

describe("writeJsonLine", () => {
	test("writes a single newline-terminated JSON object", () => {
		let chunks: Buffer[] = [];
		let output = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(Buffer.from(chunk as Buffer));
				callback();
			},
		});
		writeJsonLine(output, { jsonrpc: "2.0", id: 1, result: {} });
		expect(Buffer.concat(chunks).toString("utf8")).toBe('{"jsonrpc":"2.0","id":1,"result":{}}\n');
	});
});
