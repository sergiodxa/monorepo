/**
 * Unit tests for `hstack()`'s base flex-row declaration plus its optional
 * `gap`/`align`/`justify` composition, including the `between`/`around`/
 * `evenly` aliasing `u.justify()` applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { hstack } from "./hstack.js";

describe("hstack", () => {
	test("no options sets only display and flex-direction", async () => {
		expect(await declarations(hstack())).toEqual(["display: flex", "flex-direction: row"]);
	});

	test("gap only", async () => {
		expect(await declarations(hstack({ gap: 4 }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"gap: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("align only", async () => {
		expect(await declarations(hstack({ align: "center" }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"align-items: center",
		]);
	});

	test("justify only, plain keyword", async () => {
		expect(await declarations(hstack({ justify: "center" }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"justify-content: center",
		]);
	});

	test("justify only, aliasing between to space-between", async () => {
		expect(await declarations(hstack({ justify: "between" }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"justify-content: space-between",
		]);
	});

	test("justify only, aliasing around to space-around", async () => {
		expect(await declarations(hstack({ justify: "around" }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"justify-content: space-around",
		]);
	});

	test("justify only, aliasing evenly to space-evenly", async () => {
		expect(await declarations(hstack({ justify: "evenly" }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"justify-content: space-evenly",
		]);
	});

	test("gap, align, and justify all together", async () => {
		expect(await declarations(hstack({ gap: 4, align: "center", justify: "between" }))).toEqual([
			"display: flex",
			"flex-direction: row",
			"gap: calc(var(--ui-spacing, 0.25rem) * 4)",
			"align-items: center",
			"justify-content: space-between",
		]);
	});
});
