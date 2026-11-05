/**
 * The escape hatch inherits the serializer's number handling: bare numbers on length
 * properties gain a `px` suffix (`width: 1` → `width: 1px`), while unitless properties
 * Remix knows about (`flex`, `line-height`, …) and zero stay bare. Pass other units as
 * strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { when } from "../state/when.js";

import { raw } from "./raw.js";

describe("raw", () => {
	test("passes a plain style object through unchanged", async () => {
		expect(await declarations(raw({ color: "var(--ui-chart-1)" }))).toEqual([
			"color: var(--ui-chart-1)",
		]);
	});

	test("composes inside when(), same as any other utility mixin", async () => {
		let css = await serialize(when('&[data-color="1"]', raw({ color: "var(--ui-chart-1)" })));

		expect(css.replace(/\s+/g, " ")).toContain('&[data-color="1"] { color: var(--ui-chart-1); }');
	});

	test("a bare number on a length property picks up a px suffix", async () => {
		expect(await declarations(raw({ width: 1 }))).toEqual(["width: 1px"]);
		expect(await declarations(raw({ width: "1rem" }))).toEqual(["width: 1rem"]);
	});

	test("zero and known-unitless properties are left alone", async () => {
		expect(await declarations(raw({ margin: 0 }))).toEqual(["margin: 0"]);
		expect(await declarations(raw({ lineHeight: 1.5 }))).toEqual(["line-height: 1.5"]);
		expect(await declarations(raw({ flex: 1 }))).toEqual(["flex: 1"]);
	});
});
