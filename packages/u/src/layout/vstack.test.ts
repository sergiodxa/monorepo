/**
 * Unit tests for `vstack()`'s base flex-column declaration plus its
 * optional `gap`/`align`/`justify` composition, including the
 * `between`/`around`/`evenly` aliasing `u.justify()` applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { vstack } from "./vstack";

describe("vstack", () => {
	test("no options sets only display and flex-direction", async () => {
		expect(await declarations(vstack())).toEqual(["display: flex", "flex-direction: column"]);
	});

	test("gap only", async () => {
		expect(await declarations(vstack({ gap: 4 }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"gap: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("align only", async () => {
		expect(await declarations(vstack({ align: "stretch" }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"align-items: stretch",
		]);
	});

	test("justify only, plain keyword", async () => {
		expect(await declarations(vstack({ justify: "center" }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"justify-content: center",
		]);
	});

	test("justify only, aliasing between to space-between", async () => {
		expect(await declarations(vstack({ justify: "between" }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"justify-content: space-between",
		]);
	});

	test("justify only, aliasing around to space-around", async () => {
		expect(await declarations(vstack({ justify: "around" }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"justify-content: space-around",
		]);
	});

	test("justify only, aliasing evenly to space-evenly", async () => {
		expect(await declarations(vstack({ justify: "evenly" }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"justify-content: space-evenly",
		]);
	});

	test("gap, align, and justify all together", async () => {
		expect(await declarations(vstack({ gap: 2, align: "center", justify: "evenly" }))).toEqual([
			"display: flex",
			"flex-direction: column",
			"gap: calc(var(--ui-spacing, 0.25rem) * 2)",
			"align-items: center",
			"justify-content: space-evenly",
		]);
	});
});
