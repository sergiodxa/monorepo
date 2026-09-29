/**
 * Tests for report dialects: every supported locale gets the delimiter its spreadsheet
 * splits on, and numbers are written the way that spreadsheet reads them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { numberCell, reportDialect } from "~/app/lib/report-dialect";
import { supportedLanguages } from "~/database/schema";

describe("reportDialect", () => {
	test.each([
		["en", ","],
		["ja", ","],
		["es", ";"],
		["de", ";"],
		["fr", ";"],
		["it", ";"],
	] as const)("the spreadsheet dialect for %s splits on %j", (locale, delimiter) => {
		expect(reportDialect(locale, "spreadsheet")).toMatchObject({ delimiter, bom: true });
	});

	test("covers every supported language", () => {
		for (let language of supportedLanguages) {
			let dialect = reportDialect(language, "spreadsheet");
			expect(dialect.delimiter === ";").toBe(dialect.decimalMark === ",");
		}
	});

	test("the standard dialect ignores the locale", () => {
		expect(reportDialect("de", "standard")).toEqual({
			name: "standard",
			delimiter: ",",
			bom: false,
			decimalMark: ".",
			translateHeaders: false,
		});
	});
});

describe("numberCell", () => {
	test("keeps numbers as numbers for a dot locale", () => {
		expect(numberCell(99.953, reportDialect("en", "spreadsheet"))).toBe(99.953);
	});

	test("writes the decimal comma, with no grouping, for a comma locale", () => {
		expect(numberCell(99.953, reportDialect("de", "spreadsheet"))).toBe("99,953");
		expect(numberCell(1234567.5, reportDialect("es", "spreadsheet"))).toBe("1234567,5");
		expect(numberCell(100, reportDialect("fr", "spreadsheet"))).toBe("100");
	});

	test("writes an empty field for a missing figure", () => {
		expect(numberCell(null, reportDialect("de", "spreadsheet"))).toBeNull();
	});
});
