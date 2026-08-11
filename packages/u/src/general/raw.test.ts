/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";
import { when } from "../state/when";

import { raw } from "./raw";

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
		// The trap this escape hatch cannot protect callers from: the serializer
		// appends `px` to any unitless number outside its small allow-list of
		// genuinely unitless properties. `flex: 1` becomes `flex: 1px`, which
		// does not get dropped — it parses as a `1px` flex-basis instead of the
		// `0%` the shorthand means — so the layout is quietly wrong rather than
		// visibly broken. Pass the value as a string when in doubt.
		expect(await declarations(raw({ flex: 1 }))).toEqual(["flex: 1px"]);
		expect(await declarations(raw({ flex: "1" }))).toEqual(["flex: 1"]);
	});

	test("zero and known-unitless properties are left alone", async () => {
		// The serializer skips zero, and skips properties it knows take a
		// unitless number — so the hazard above is narrower than "every number".
		expect(await declarations(raw({ margin: 0 }))).toEqual(["margin: 0"]);
		expect(await declarations(raw({ lineHeight: 1.5 }))).toEqual(["line-height: 1.5"]);
	});
});
