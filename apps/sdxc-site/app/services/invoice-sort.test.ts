/**
 * Covers reading a table's sort out of its query and ordering rows by it, which is how
 * the table sorts without any script of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { readSort, sortHref, sortInvoices } from "./invoice-sort.js";

const ROWS = [
	{ id: "INV-2041", customer: "Northwind Traders", issued: "2026-09-12", total: 1280 },
	{ id: "INV-2039", customer: "Globex", issued: "2026-09-09", total: 3900 },
	{ id: "INV-2038", customer: "Initech", issued: "2026-09-04", total: 96 },
];

describe("readSort", () => {
	test("reads the column and direction a header asked for", () => {
		expect(readSort("?sort=customer&dir=desc")).toEqual({
			key: "customer",
			direction: "descending",
		});
	});

	test("orders by the newest issue date when the query names no column", () => {
		expect(readSort("")).toEqual({ key: "issued", direction: "descending" });
	});

	test("ignores a column it cannot sort by, which is user-supplied text", () => {
		expect(readSort("?sort=../../etc").key).toBe("issued");
	});
});

describe("sortHref", () => {
	test("flips the direction of the column already being sorted", () => {
		expect(sortHref("customer", { key: "customer", direction: "ascending" })).toBe(
			"?sort=customer&dir=desc",
		);
	});

	test("asks for a fresh ascending sort on any other column", () => {
		expect(sortHref("total", { key: "customer", direction: "ascending" })).toBe("?sort=total");
	});
});

describe("sortInvoices", () => {
	test("orders text by name", () => {
		let ordered = sortInvoices(ROWS, { key: "customer", direction: "ascending" });

		expect(ordered.map((row) => row.customer)).toEqual(["Globex", "Initech", "Northwind Traders"]);
	});

	test("orders money by amount rather than by its digits", () => {
		let ordered = sortInvoices(ROWS, { key: "total", direction: "ascending" });

		expect(ordered.map((row) => row.total)).toEqual([96, 1280, 3900]);
	});

	test("leaves the rows it was given alone", () => {
		let before = ROWS.map((row) => row.id);
		sortInvoices(ROWS, { key: "total", direction: "descending" });

		expect(ROWS.map((row) => row.id)).toEqual(before);
	});
});
