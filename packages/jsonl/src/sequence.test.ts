/**
 * The RFC 7464 reader rules: records split at RS, empty records skipped, a bad record reported
 * without ending the stream, top-level scalars with no trailing whitespace treated as truncated,
 * and RS, records and characters split across chunks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { JSONSeqError, RecordsOptions, SequenceReadOptions } from "./index.js";

import { parseSequence, readSequence, records } from "./index.js";

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

async function collectRecords(chunks: Uint8Array[], options?: RecordsOptions) {
	let results = [];
	for await (let record of records(streamOf(chunks), options)) results.push(record);
	return results;
}

async function collect<Schema extends StandardSchemaV1 | undefined = undefined>(
	text: string,
	options?: SequenceReadOptions<Schema>,
) {
	let results = [];
	for await (let entry of readSequence(streamOf(chunked(text)), options)) results.push(entry);
	return results;
}

/** The code and record of every failure among `results`, in order. */
function failures(results: Result<unknown, JSONSeqError>[]): [string, number][] {
	return results.flatMap((result) =>
		isFailure(result) ? [[result.error.code, result.error.record] as [string, number]] : [],
	);
}

/** A schema accepting objects with a numeric `id`. */
const ID_SCHEMA: StandardSchemaV1<unknown, { id: number }> = {
	"~standard": {
		version: 1,
		vendor: "test",
		validate(value) {
			return typeof value === "object" &&
				value !== null &&
				"id" in value &&
				typeof value.id === "number"
				? { value: { id: value.id } }
				: { issues: [{ message: "Expected an id", path: ["id"] }] };
		},
	},
};

describe("records", () => {
	test("splits on RS and trims the whitespace around each text", async () => {
		let results = await collectRecords(chunked('\x1e{"a":1}\n\x1e  [2]\r\n\x1e"three"'));

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: '{"a":1}', number: 1 },
			{ text: "[2]", number: 2 },
			{ text: '"three"', number: 3 },
		]);
	});

	test("skips empty records between consecutive RS, and whitespace-only ones", async () => {
		let results = await collectRecords(chunked("\x1e\x1e\x1e1\n\x1e \n\x1e\x1e2\n\x1e"));

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: "1", number: 1 },
			{ text: "2", number: 2 },
		]);
	});

	test("keeps a JSON text spread over several lines as one record", async () => {
		let results = await collectRecords(chunked('\x1e{\n  "a": 1\n}\n\x1e2\n'));

		expect(results.map((result) => unwrap(result).text)).toEqual(['{\n  "a": 1\n}', "2"]);
	});

	test("ignores a leading byte-order mark", async () => {
		let results = await collectRecords(chunked("﻿\x1e1\n"));

		expect(results.map((result) => unwrap(result).text)).toEqual(["1"]);
	});

	test("handles RS, records and characters split across chunks", async () => {
		let source = '\x1e"é漢😀"\n\x1e\x1e{"b":"\\u001e"}\n\x1e3\n';
		let expected = ['"é漢😀"', '{"b":"\\u001e"}', "3"];
		for (let size = 1; size < 8; size += 1) {
			let results = await collectRecords(chunked(source, [size, 1, 1, 1]));
			expect(results.map((result) => unwrap(result).text)).toEqual(expected);
		}
		let bytewise = new TextEncoder().encode(source).length;
		let results = await collectRecords(
			chunked(
				source,
				Array.from({ length: bytewise }, () => 1),
			),
		);
		expect(results.map((result) => unwrap(result).text)).toEqual(expected);
	});

	test.each(["1", "-2.5", "true", "false", "null"])(
		"reports a top-level %s with no whitespace after it as truncated and keeps reading",
		async (scalar) => {
			let results = await collectRecords(chunked(`\x1e${scalar}\x1e${scalar}\n\x1e${scalar}`));

			expect(results.map((result) => isSuccess(result))).toEqual([false, true, false]);
			expect(failures(results)).toEqual([
				["truncated", 1],
				["truncated", 3],
			]);
		},
	);

	test("accepts a string, object or array with no whitespace after it", async () => {
		let results = await collectRecords(chunked('\x1e"a"\x1e{}\x1e[]'));

		expect(results.map((result) => unwrap(result).text)).toEqual(['"a"', "{}", "[]"]);
	});

	test("stops with one failure at the first record longer than maxRecordBytes", async () => {
		let results = await collectRecords(chunked("\x1e12\n\x1e\x1e12345\n\x1e1\n", [4]), {
			maxRecordBytes: 4,
		});

		expect(results.map((result) => isFailure(result))).toEqual([false, true]);
		expect(failures(results)).toEqual([["record-too-long", 2]]);
	});

	test("counts a record's bytes across every chunk it spans, final record included", async () => {
		let results = await collectRecords(chunked(`\x1e${"x".repeat(10)}`, [3, 3, 3]), {
			maxRecordBytes: 8,
		});

		expect(failures(results)).toEqual([["record-too-long", 1]]);
	});

	test("accepts a record of exactly maxRecordBytes, measured in encoded bytes", async () => {
		expect(
			(await collectRecords(chunked("\x1e1234\n\x1e1234\n"), { maxRecordBytes: 5 })).map(
				(result) => unwrap(result).text,
			),
		).toEqual(["1234", "1234"]);
		expect(failures(await collectRecords(chunked('\x1e"éé"\n'), { maxRecordBytes: 6 }))).toEqual([
			["record-too-long", 1],
		]);
	});

	test("skips non-empty records only, numbering what follows by every record", async () => {
		let results = await collectRecords(chunked("\x1e1\n\x1e\x1e2\n\x1e3\n\x1e4\n"), { skip: 2 });

		expect(results.map((result) => unwrap(result))).toEqual([
			{ text: "3", number: 3 },
			{ text: "4", number: 4 },
		]);
	});

	test("releases a web stream's lock when the caller stops early", async () => {
		let stream = streamOf(chunked("\x1e1\n\x1e2\n\x1e3\n"));
		for await (let record of records(stream)) {
			unwrap(record);
			break;
		}

		expect(stream.locked).toBe(false);
	});
});

describe("readSequence", () => {
	test("parses each record with its record number", async () => {
		let results = await collect('\x1e{"a":1}\n\x1e\x1e[2]\n\x1e"three"\n');

		expect(results.map((result) => unwrap(result))).toEqual([
			{ value: { a: 1 }, number: 1 },
			{ value: [2], number: 2 },
			{ value: "three", number: 3 },
		]);
	});

	test("reports a record that is not JSON or is truncated, and keeps reading", async () => {
		let results = await collect("\x1e1\n\x1e{oops\n\x1e42\x1e3\n");

		expect(failures(results)).toEqual([
			["invalid-json", 2],
			["truncated", 3],
		]);
		expect(results.filter(isSuccess).map((entry) => entry.data.value)).toEqual([1, 3]);
		let bad = results[1];
		expect(bad !== undefined && isFailure(bad) && bad.error.message).toMatch(/at record 2$/);
	});

	test("validates every value through the schema", async () => {
		let results = await collect('\x1e{"id":1}\n\x1e{"id":"x"}\n\x1e{"id":3}\n', {
			schema: ID_SCHEMA,
		});

		expect(failures(results)).toEqual([["invalid-value", 2]]);
		expect(results.filter(isSuccess).map((entry) => entry.data.value)).toEqual([
			{ id: 1 },
			{ id: 3 },
		]);
	});

	test("stops after a record longer than maxRecordBytes", async () => {
		let results = await collect('\x1e1\n\x1e"long record"\n\x1e3\n', { maxRecordBytes: 4 });

		expect(results.filter(isSuccess).map((entry) => entry.data.value)).toEqual([1]);
		expect(failures(results)).toEqual([["record-too-long", 2]]);
	});
});

describe("parseSequence", () => {
	test("reads every value, skipping empty records", () => {
		expect(unwrap(parseSequence('\x1e{"a":1}\n\x1e\x1e[2]\n\x1e"x"'))).toEqual([
			{ a: 1 },
			[2],
			"x",
		]);
		expect(unwrap(parseSequence(""))).toEqual([]);
		expect(unwrap(parseSequence("﻿\x1etrue\n"))).toEqual([true]);
	});

	test("answers the first truncated or invalid record", () => {
		let truncated = parseSequence("\x1e1\n\x1e2");
		let invalid = parseSequence("\x1e1\n\x1e{nope\n\x1e3");

		expect(isFailure(truncated) && [truncated.error.code, truncated.error.record]).toEqual([
			"truncated",
			2,
		]);
		expect(isFailure(invalid) && [invalid.error.code, invalid.error.record]).toEqual([
			"invalid-json",
			2,
		]);
	});
});
