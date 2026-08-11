/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { gridAutoFlow } from "./grid-auto-flow";

describe("gridAutoFlow", () => {
	test("defaults to row", async () => {
		expect(await declarations(gridAutoFlow())).toEqual(["grid-auto-flow: row"]);
	});

	test("'column'", async () => {
		expect(await declarations(gridAutoFlow("column"))).toEqual(["grid-auto-flow: column"]);
	});

	test("'dense'", async () => {
		expect(await declarations(gridAutoFlow("dense"))).toEqual(["grid-auto-flow: dense"]);
	});

	test("'row dense'", async () => {
		expect(await declarations(gridAutoFlow("row dense"))).toEqual(["grid-auto-flow: row dense"]);
	});

	test("'column dense'", async () => {
		expect(await declarations(gridAutoFlow("column dense"))).toEqual([
			"grid-auto-flow: column dense",
		]);
	});
});
