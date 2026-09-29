/**
 * Tests for the streaming writer: the bytes it sends match `stringify`'s text for the
 * same rows, it reads sync and async sources, and it stops the source when cancelled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Cell, Column } from "./lib/types.js";

import { CSVStringifyError } from "./lib/errors.js";
import { streamify } from "./lib/streamify.js";
import { stringify } from "./lib/stringify.js";

/**
 * A report-shaped row, typed by an interface the way callers type theirs.
 */
interface Row {
	date: string;
	monitor: string;
	uptime: number | null;
}

/** Columns every test writes. */
const COLUMNS: Column<Row>[] = [
	{ key: "date", header: "Date (UTC)" },
	{ key: "monitor" },
	{ key: "uptime", header: "Uptime %" },
];

/**
 * Reads a byte stream to the end as UTF-8 text, keeping a leading BOM.
 *
 * @param stream - The stream to drain
 * @returns The decoded text
 */
async function text(stream: ReadableStream<Uint8Array>): Promise<string> {
	return new TextDecoder("utf-8", { ignoreBOM: true }).decode(
		await new Response(stream).arrayBuffer(),
	);
}

/**
 * Yields rows asynchronously, one microtask apart, like a database cursor.
 *
 * @param rows - The rows to yield
 * @yields Each row in order
 */
async function* slowly(rows: Row[]): AsyncGenerator<Row> {
	for (let row of rows) {
		await Promise.resolve();
		yield row;
	}
}

/** Rows with every quoting case in them. */
const ROWS: Row[] = [
	{ date: "2026-08-01", monitor: "api, eu", uptime: 99.95 },
	{ date: "2026-08-02", monitor: '"web"', uptime: null },
	{ date: "2026-08-03", monitor: "=evil()", uptime: 100 },
];

describe("streamify", () => {
	test("sends the same text stringify writes", async () => {
		let expected = stringify(ROWS, { columns: COLUMNS, bom: true, delimiter: ";" });
		if (isFailure(expected)) throw expected.error;

		expect(await text(streamify(ROWS, { columns: COLUMNS, bom: true, delimiter: ";" }))).toBe(
			expected.data,
		);
	});

	test("reads an async iterable", async () => {
		let expected = stringify(ROWS, { columns: COLUMNS });
		if (isFailure(expected)) throw expected.error;

		expect(await text(streamify(slowly(ROWS), { columns: COLUMNS }))).toBe(expected.data);
	});

	test("sends the header for an empty source", async () => {
		expect(await text(streamify([], { columns: COLUMNS }))).toBe("Date (UTC),monitor,Uptime %\r\n");
	});

	test("sends many rows in fewer chunks than rows", async () => {
		let many = Array.from({ length: 5_000 }, (_, index) => ({
			date: "2026-08-01",
			monitor: `monitor-${index}`,
			uptime: index,
		}));
		let chunks = 0;
		let reader = streamify(many, { columns: COLUMNS }).getReader();
		while (!(await reader.read()).done) chunks += 1;
		expect(chunks).toBeGreaterThan(1);
		expect(chunks).toBeLessThan(many.length / 10);
	});

	test("errors the stream on a bad cell", async () => {
		let rows = [{ date: "x", monitor: "y", uptime: Number.NaN }];
		let error = await text(streamify(rows, { columns: COLUMNS })).catch((error: unknown) => error);
		expect(error).toBeInstanceOf(CSVStringifyError);
		expect((error as CSVStringifyError).row).toBe(0);
	});

	test("errors the stream on an unknown delimiter", async () => {
		let stream = streamify(ROWS, { columns: COLUMNS, delimiter: "|" as "," });
		await expect(text(stream)).rejects.toBeInstanceOf(CSVStringifyError);
	});

	test("stops the source when the reader cancels", async () => {
		let finished = false;
		async function* endless(): AsyncGenerator<Record<string, Cell>> {
			try {
				for (let index = 0; ; index += 1) yield { n: index };
			} finally {
				finished = true;
			}
		}

		let reader = streamify(endless(), { columns: [{ key: "n" }] }).getReader();
		await reader.read();
		await reader.cancel();
		expect(finished).toBe(true);
	});
});
