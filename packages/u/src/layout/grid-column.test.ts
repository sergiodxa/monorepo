/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { gridColumn } from "./grid-column.js";

describe("gridColumn", () => {
	test("emits a bare number as a line number, unchanged", async () => {
		expect(await declarations(gridColumn(2))).toEqual(["grid-column: 2"]);
	});

	test("emits a negative line number unchanged", async () => {
		expect(await declarations(gridColumn(-1))).toEqual(["grid-column: -1"]);
	});

	test("emits an explicit span", async () => {
		expect(await declarations(gridColumn("span 2"))).toEqual(["grid-column: span 2"]);
	});

	test("emits a start/end pair", async () => {
		expect(await declarations(gridColumn("1 / 3"))).toEqual(["grid-column: 1 / 3"]);
	});

	test("emits a mixed span/line pair", async () => {
		expect(await declarations(gridColumn("span 2 / -1"))).toEqual(["grid-column: span 2 / -1"]);
	});

	test("emits named grid lines", async () => {
		expect(await declarations(gridColumn("main-start / main-end"))).toEqual([
			"grid-column: main-start / main-end",
		]);
	});
});
