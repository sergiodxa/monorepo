/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { gridRow } from "./grid-row";

describe("gridRow", () => {
	test("emits a bare number as a line number, unchanged", async () => {
		expect(await declarations(gridRow(2))).toEqual(["grid-row: 2"]);
	});

	test("emits a negative line number unchanged", async () => {
		expect(await declarations(gridRow(-1))).toEqual(["grid-row: -1"]);
	});

	test("emits an explicit span", async () => {
		expect(await declarations(gridRow("span 3"))).toEqual(["grid-row: span 3"]);
	});

	test("emits a start/end pair", async () => {
		expect(await declarations(gridRow("1 / -1"))).toEqual(["grid-row: 1 / -1"]);
	});

	test("emits named grid lines", async () => {
		expect(await declarations(gridRow("header-start / header-end"))).toEqual([
			"grid-row: header-start / header-end",
		]);
	});
});
