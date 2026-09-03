/**
 * The escape hatch inherits the serializer's number handling: a bare number on
 * a property outside the unitless allow-list gains a `px` suffix, so `flex: 1`
 * serializes as `flex: 1px` and parses as a `1px` basis, leaving the layout
 * quietly wrong. Pass such values as strings; zero and known-unitless
 * properties keep their bare number.
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

	test("a bare number on a non-unitless property picks up a px suffix", async () => {
		expect(await declarations(raw({ flex: 1 }))).toEqual(["flex: 1px"]);
		expect(await declarations(raw({ flex: "1" }))).toEqual(["flex: 1"]);
	});

	test("zero and known-unitless properties are left alone", async () => {
		expect(await declarations(raw({ margin: 0 }))).toEqual(["margin: 0"]);
		expect(await declarations(raw({ lineHeight: 1.5 }))).toEqual(["line-height: 1.5"]);
	});
});
