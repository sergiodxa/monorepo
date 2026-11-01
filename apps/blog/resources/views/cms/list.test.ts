/**
 * Covers how CMS lists order and search rows read from storage, where older rows keep their
 * timestamps as epoch numbers or digit strings: sorting and searching them must read every
 * stored form instead of failing the whole page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { matchesSearch, sortRows } from "./list";

/** A row as a list sorts it, its date in whichever form the database returned. */
interface Row {
	title: string;
	date: string | number | null;
}

/** Rows whose dates mix every stored form: seconds, milliseconds, digits, SQL and ISO text. */
const ROWS: Row[] = [
	{ title: "seconds", date: 1_600_000_000 },
	{ title: "iso", date: "2024-01-01T00:00:00.000Z" },
	{ title: "digits", date: "1500000000000" },
	{ title: "none", date: null },
	{ title: "sql", date: "2022-06-01 12:00:00" },
];

/** How the lists read a row's title and date. */
const KEYS = { title: (row: Row) => row.title, date: (row: Row) => row.date };

describe("sortRows", () => {
	test("orders mixed stored timestamps newest first, an empty date last", () => {
		let sorted = sortRows(ROWS, "", KEYS).map((row) => row.title);

		expect(sorted).toEqual(["iso", "sql", "seconds", "digits", "none"]);
	});

	test("orders them oldest first", () => {
		let sorted = sortRows(ROWS, "date", KEYS).map((row) => row.title);

		expect(sorted).toEqual(["none", "digits", "seconds", "sql", "iso"]);
	});
});

describe("matchesSearch", () => {
	test("searches a field stored as a number", () => {
		expect(matchesSearch("1600", 1_600_000_000)).toBe(true);
	});
});
