/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { border } from "./border";

describe("border", () => {
	test("no-arg resolves the system default", async () => {
		expect(await declarations(border())).toEqual([
			"border-color: var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))",
		]);
	});

	test("'none' short-circuits to a bare border reset, not a color branch", async () => {
		expect(await declarations(border("none"))).toEqual(["border: none"]);
	});

	test("a bare tone defaults to that tone's plain border weight", async () => {
		expect(await declarations(border("brand"))).toEqual(["border-color: var(--ui-brand-border)"]);
	});

	test("an explicit strong suffix", async () => {
		expect(await declarations(border("brand.strong"))).toEqual([
			"border-color: var(--ui-brand-border-strong)",
		]);
	});

	test("an options object with a numeric width defaults style to solid", async () => {
		expect(await declarations(border({ color: "brand", width: 2 }))).toEqual([
			"border-color: var(--ui-brand-border)",
			"border-width: 2px",
			"border-style: solid",
		]);
	});

	test("an options object's explicit style overrides the solid default", async () => {
		expect(await declarations(border({ width: 1, style: "dashed" }))).toEqual([
			"border-width: 1px",
			"border-style: dashed",
		]);
	});

	test("an options object only sets the given keys", async () => {
		expect(await declarations(border({ color: "danger" }))).toEqual([
			"border-color: var(--ui-danger-border)",
		]);
	});

	test("an options object's width accepts a raw CSS length string", async () => {
		expect(await declarations(border({ width: "0.5rem" }))).toEqual([
			"border-width: 0.5rem",
			"border-style: solid",
		]);
	});

	test("width alone still defaults style to solid when noStyleDefault is absent", async () => {
		expect(await declarations(border({ width: 2 }))).toEqual([
			"border-width: 2px",
			"border-style: solid",
		]);
	});

	test("noStyleDefault suppresses the solid default, leaving width-only output", async () => {
		expect(await declarations(border({ width: 2, noStyleDefault: true }))).toEqual([
			"border-width: 2px",
		]);
	});

	test("noStyleDefault has no effect when style is also given explicitly", async () => {
		expect(await declarations(border({ width: 2, style: "dashed", noStyleDefault: true }))).toEqual(
			["border-width: 2px", "border-style: dashed"],
		);
	});
});
