/**
 * `read` and `parse` against the line rules and their failure contracts: `read` reports each bad
 * line and keeps going, validating through sync and async Standard Schemas alike, while `parse`
 * answers the first bad line with the number an editor shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import type { Entry, JSONLError, ReadOptions } from "./index.js";

import { parse, read } from "./index.js";

/** A schema accepting objects with a numeric `id`, answering in a promise when `async` is set. */
function idSchema(async: boolean): StandardSchemaV1<unknown, { id: number }> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			validate(value) {
				let outcome: StandardSchemaV1.Result<{ id: number }> =
					typeof value === "object" &&
					value !== null &&
					"id" in value &&
					typeof value.id === "number"
						? { value: { id: value.id } }
						: { issues: [{ message: "Expected an id", path: ["id"] }] };
				return async ? Promise.resolve(outcome) : outcome;
			},
		},
	};
}

function streamOf(text: string): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode(text));
			controller.close();
		},
	});
}

async function collect<Schema extends StandardSchemaV1 | undefined = undefined>(
	text: string,
	options?: ReadOptions<Schema>,
) {
	let results = [];
	for await (let entry of read(streamOf(text), options)) results.push(entry);
	return results;
}

/** The code and line of every failure among `results`, in order. */
function failures(results: Result<unknown, JSONLError>[]): [string, number][] {
	return results.flatMap((result) =>
		isFailure(result) ? [[result.error.code, result.error.line] as [string, number]] : [],
	);
}

describe("read", () => {
	test("parses each non-blank line with its line number", async () => {
		let results = await collect('{"a":1}\r\n\n[2]\n"three"');

		expect(results.map((result) => unwrap(result))).toEqual([
			{ value: { a: 1 }, number: 1 },
			{ value: [2], number: 3 },
			{ value: "three", number: 4 },
		]);
	});

	test("reports a line that is not JSON and keeps reading", async () => {
		let results = await collect("1\n{oops\n3\n");

		expect(failures(results)).toEqual([["invalid-json", 2]]);
		expect(results.filter(isSuccess).map((entry) => entry.data.value)).toEqual([1, 3]);
		let bad = results[1];
		expect(bad !== undefined && isFailure(bad) && bad.error.message).toMatch(/at line 2$/);
	});

	test.each([false, true])(
		"validates every value through the schema (async: %s)",
		async (async) => {
			let results = await collect('{"id":1}\n{"id":"x"}\n\n{"id":3,"extra":true}\n', {
				schema: idSchema(async),
			});

			expect(failures(results)).toEqual([["invalid-value", 2]]);
			let values: Entry<{ id: number }>[] = results.filter(isSuccess).map((entry) => entry.data);
			expect(values).toEqual([
				{ value: { id: 1 }, number: 1 },
				{ value: { id: 3 }, number: 4 },
			]);
			let bad = results[1];
			expect(bad !== undefined && isFailure(bad) && bad.error.issues).toEqual([
				{ message: "Expected an id", path: ["id"] },
			]);
		},
	);

	test("stops after a line longer than maxLineBytes", async () => {
		let results = await collect('1\n"long line"\n3\n', { maxLineBytes: 4 });

		expect(results.filter(isSuccess).map((entry) => entry.data.value)).toEqual([1]);
		expect(failures(results)).toEqual([["line-too-long", 2]]);
	});

	test("resumes after skip values", async () => {
		let results = await collect("1\n\n2\n3\n", { skip: 1 });

		expect(results.map((result) => unwrap(result))).toEqual([
			{ value: 2, number: 3 },
			{ value: 3, number: 4 },
		]);
	});
});

describe("parse", () => {
	test("reads every value, with or without a final newline", () => {
		expect(unwrap(parse('{"a":1}\n[2]\n'))).toEqual([{ a: 1 }, [2]]);
		expect(unwrap(parse('{"a":1}\n[2]'))).toEqual([{ a: 1 }, [2]]);
		expect(unwrap(parse(""))).toEqual([]);
	});

	test("applies the line rules: \\r\\n, blank lines and a byte-order mark", () => {
		expect(unwrap(parse('\uFEFF{"a":1}\r\n\r\n \t\n2\r\n'))).toEqual([{ a: 1 }, 2]);
	});

	test("answers the first invalid line, counting blank lines", () => {
		let parsed = parse("1\n\n\nnope\n{also bad\n");

		expect(isFailure(parsed) && [parsed.error.code, parsed.error.line]).toEqual([
			"invalid-json",
			4,
		]);
		expect(isFailure(parsed) && parsed.error.message).toMatch(
			/^Line is not valid JSON .* at line 4$/,
		);
	});
});
