/**
 * Tests for the package's entry point, reached the way callers reach it: a namespace
 * import reads `CSV.parse` and `CSV.stringify`, and each reads back what the other wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import * as CSV from "./index.js";

describe("the package entry point", () => {
	test("writes and reads under a namespace import", () => {
		let rows = [
			{ monitor: "api", uptime: "99.95" },
			{ monitor: "web, eu", uptime: "100" },
		];

		let csvAsString = unwrap(CSV.stringify(rows));
		let listOfObjects = unwrap(CSV.parse(csvAsString)).rows;

		expect(listOfObjects).toEqual(rows);
	});

	test("exports both error classes", () => {
		expect(new CSV.CSVParseError("x", 1)).toBeInstanceOf(Error);
		expect(new CSV.CSVStringifyError("x")).toBeInstanceOf(Error);
	});
});
