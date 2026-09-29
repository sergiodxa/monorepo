/**
 * Tests for the writer: RFC 4180 quoting, the cell types it formats, formula
 * neutralization, column order and labels, and the failures untyped input can cause.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Cell } from "./lib/types.js";

import { CSVStringifyError } from "./lib/errors.js";
import { parse } from "./lib/parse.js";
import { stringify } from "./lib/stringify.js";

/**
 * Unwraps written text and fails the test on a stringify failure.
 *
 * @param result - What `stringify` returned
 * @returns The CSV text
 */
function written(result: Result<string, CSVStringifyError>): string {
	if (isFailure(result)) throw result.error;
	return result.data;
}

/**
 * Writes input expected to fail and returns the error.
 *
 * @param rows - Rows holding a value the writer rejects
 * @returns The stringify error
 */
function failureOf(rows: Record<string, unknown>[]): CSVStringifyError {
	let result = stringify(rows as Record<string, Cell>[]);
	if (!isFailure(result)) throw new Error("expected a stringify failure");
	return result.error;
}

describe("records", () => {
	test("writes a header and one CRLF-terminated record per row", () => {
		expect(
			written(
				stringify([
					{ name: "Ana", city: "Lima" },
					{ name: "Bo", city: "Oslo" },
				]),
			),
		).toBe("name,city\r\nAna,Lima\r\nBo,Oslo\r\n");
	});

	test("takes column order and header text from columns", () => {
		let rows = [{ id: 1, name: "Ana" }];
		expect(
			written(
				stringify(rows, {
					columns: [{ key: "name", header: "Nombre" }, { key: "id" }],
				}),
			),
		).toBe("Nombre,id\r\nAna,1\r\n");
	});

	test("writes an empty field for a key a later row lacks", () => {
		let rows: Record<string, Cell>[] = [{ a: 1, b: 2 }, { a: 3 }];
		expect(written(stringify(rows))).toBe("a,b\r\n1,2\r\n3,\r\n");
	});

	test("omits the header record on request", () => {
		expect(written(stringify([{ a: 1 }], { header: false }))).toBe("1\r\n");
	});

	test("writes nothing for no rows and no columns", () => {
		expect(written(stringify([]))).toBe("");
	});

	test("writes the header alone for no rows with columns", () => {
		expect(written(stringify([], { columns: [{ key: "a" }] }))).toBe("a\r\n");
	});

	test("accepts rows typed by an interface", () => {
		interface Row {
			monitor: string;
			uptime: number | null;
		}
		let rows: Row[] = [{ monitor: "api", uptime: 99.5 }];
		expect(written(stringify(rows))).toBe("monitor,uptime\r\napi,99.5\r\n");
	});
});

describe("rows of cells", () => {
	test("writes arrays as records with no header", () => {
		expect(
			written(
				stringify([
					["a", 1],
					["b", null],
				]),
			),
		).toBe("a,1\r\nb,\r\n");
	});
});

describe("quoting", () => {
	test("quotes fields holding the delimiter, a quote or a line break", () => {
		expect(written(stringify([["a,b", 'say "hi"', "one\ntwo", "x\ry"]]))).toBe(
			'"a,b","say ""hi""","one\ntwo","x\ry"\r\n',
		);
	});

	test("quotes fields with leading or trailing spaces", () => {
		expect(written(stringify([[" a", "b ", "c"]]))).toBe('" a","b ",c\r\n');
	});

	test("quotes for the delimiter in use only", () => {
		expect(written(stringify([["1,5", "a;b"]], { delimiter: ";" }))).toBe('1,5;"a;b"\r\n');
	});

	test("writes a record of one empty field as a quoted empty string, so it reads back", () => {
		let text = written(stringify([{ a: "" }]));
		expect(text).toBe('a\r\n""\r\n');
		let parsed = parse(text);
		expect(!isFailure(parsed) && parsed.data.rows).toEqual([{ a: "" }]);
	});
});

describe("cells", () => {
	test("formats each cell type", () => {
		expect(
			written(
				stringify([
					[
						"text",
						42,
						-0.5,
						12345678901234567890n,
						true,
						false,
						new Date(Date.UTC(2026, 7, 1, 9, 30)),
						null,
						undefined,
					],
				]),
			),
		).toBe("text,42,-0.5,12345678901234567890,true,false,2026-08-01T09:30:00.000Z,,\r\n");
	});

	test("fails on an invalid date, naming the row and column", () => {
		let error = failureOf([{ ok: new Date(0) }, { ok: new Date(Number.NaN) }]);
		expect(error).toBeInstanceOf(CSVStringifyError);
		expect(error.row).toBe(1);
		expect(error.column).toBe("ok");
	});

	test("fails on a number with no finite value", () => {
		expect(failureOf([{ n: Number.POSITIVE_INFINITY }]).column).toBe("n");
		expect(failureOf([{ n: Number.NaN }]).column).toBe("n");
	});

	test("fails on a value outside the cell types", () => {
		expect(failureOf([{ nested: { a: 1 } }]).column).toBe("nested");
	});

	test("fails on an unknown delimiter", () => {
		let result = stringify([{ a: 1 }], { delimiter: "|" as ";" });
		expect(isFailure(result) && result.error.row).toBeUndefined();
	});
});

describe("formula neutralization", () => {
	test("prefixes string cells a spreadsheet would run as a formula", () => {
		expect(written(stringify([["=1+1", "+1", "-1", "@SUM(A1)", "\tx", "\rx", "safe"]]))).toBe(
			`'=1+1,'+1,'-1,'@SUM(A1),'\tx,"'\rx",safe\r\n`,
		);
	});

	test("leaves numbers alone, since their type is known", () => {
		expect(written(stringify([[-5]]))).toBe("-5\r\n");
	});

	test("neutralizes header labels too", () => {
		expect(written(stringify([{ a: 1 }], { columns: [{ key: "a", header: "=cmd" }] }))).toBe(
			"'=cmd\r\n1\r\n",
		);
	});

	test("writes strings verbatim when turned off", () => {
		expect(written(stringify([["=1+1"]], { escapeFormulas: false }))).toBe("=1+1\r\n");
	});
});

describe("BOM", () => {
	test("prefixes a UTF-8 BOM on request, which the reader strips", () => {
		let text = written(stringify([{ city: "Málaga" }], { bom: true }));
		expect(text.startsWith("﻿city")).toBe(true);
		let parsed = parse(text);
		expect(!isFailure(parsed) && parsed.data.rows).toEqual([{ city: "Málaga" }]);
	});
});

describe("round trips", () => {
	test.each([",", ";", "\t"] as const)("reads back what it wrote with %j", (delimiter) => {
		let rows = [
			{ name: 'Ana "A"', note: "line\r\nbreak", sep: "a,b;c\td", blank: "" },
			{ name: " padded ", note: "", sep: "", blank: "x" },
		];
		let text = written(stringify(rows, { delimiter, escapeFormulas: false }));
		let parsed = parse(text, { delimiter });
		expect(!isFailure(parsed) && parsed.data.rows).toEqual(rows);
	});
});
