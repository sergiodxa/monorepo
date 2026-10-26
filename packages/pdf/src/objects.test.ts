/**
 * Tests for the object model and file writer: value syntax, escaping, number formatting and
 * a cross-reference table whose offsets point at their objects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { inspect } from "./inspect.js";
import { Hex, Name, ObjectTable, Raw, Text, name, num, serialize, writeFile } from "./objects.js";

describe("num", () => {
	test("writes at most four decimals with no exponent or negative zero", () => {
		expect(num(1 / 3)).toBe("0.3333");
		expect(num(12)).toBe("12");
		expect(num(-0)).toBe("0");
		expect(num(-0.00001)).toBe("0");
		expect(num(1e-7)).toBe("0");
		expect(num(2.5)).toBe("2.5");
		expect(num(Number.NaN)).toBe("0");
	});
});

describe("serialize", () => {
	test("writes every value type in PDF syntax", () => {
		expect(
			serialize({
				Type: new Name("Page"),
				Count: 2,
				Open: true,
				Nothing: null,
				Skipped: undefined,
				Kids: [new ObjectTable().allocate(), 1.5],
				Title: new Text("Hello (world)"),
				Bytes: new Hex(new Uint8Array([0, 255])),
				Raw: new Raw("[1 0 0 1 0 0]"),
			}),
		).toBe(
			"<< /Type /Page /Count 2 /Open true /Nothing null /Kids [1 0 R 1.5] /Title (Hello \\(world\\)) /Bytes <00FF> /Raw [1 0 0 1 0 0] >>",
		);
	});

	test("writes non-ASCII text as UTF-16BE with a byte-order mark", () => {
		expect(serialize(new Text("Résumé"))).toBe("<FEFF005200E900730075006D00E9>");
	});

	test("escapes delimiters and non-ASCII in names", () => {
		expect(name("A B")).toBe("/A#20B");
		expect(name("a/b")).toBe("/a#2Fb");
		expect(name("é")).toBe("/#C3#A9");
	});
});

describe("writeFile", () => {
	test("lays out objects with a cross-reference table that points at each one", () => {
		let table = new ObjectTable();
		let root = table.allocate();
		let stream = table.add({
			dict: { Filter: new Name("FlateDecode") },
			data: new Uint8Array([1, 2, 3]),
		});
		table.set(root, { Type: new Name("Catalog"), Data: stream });
		let file = inspect(writeFile(table, root, null));
		expect(file.text.startsWith("%PDF-1.7\n")).toBe(true);
		expect(file.xrefValid).toBe(true);
		expect(file.trailer).toBe("<< /Size 3 /Root 1 0 R >>");
		expect(file.objects.get(2)?.head).toBe("<< /Filter /FlateDecode /Length 3 >>");
		expect([...(file.objects.get(2)?.stream ?? [])]).toEqual([1, 2, 3]);
	});

	test("writes an object that was allocated and never set as null", () => {
		let table = new ObjectTable();
		let root = table.allocate();
		table.allocate();
		let file = inspect(writeFile(table, root, null));
		expect(file.objects.get(2)?.head).toBe("null");
	});
});
