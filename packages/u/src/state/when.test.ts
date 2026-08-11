/**
 * Unit tests for `when.ts`, the primitive selector wrapper every other state
 * utility is sugar over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { when } from "./when";

describe("when", () => {
	test("emits the literal selector as a nested block", async () => {
		expect(await serialize(when("&:hover", p(4)))).toContain("&:hover {");
		expect(await declarations(when("&:hover", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("an array of two utilities merges under the same selector", async () => {
		let css = await serialize(when("&:hover", [bg("brand.tint"), border("brand")]));

		// One block, not two: a second `&:hover {` would mean the merge happened
		// after serialization rather than before it.
		expect(css.split("&:hover {")).toHaveLength(2);
		expect(await declarations(when("&:hover", [bg("brand.tint"), border("brand")]))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
			"border-color: var(--ui-brand-border)",
		]);
	});

	test("a selector the serializer cannot recognize as nested is rejected outright", () => {
		// The serializer only treats a key as a selector when it starts with
		// `&`, `@`, `:`, `[` or `.`. Anything else — a leading element or class
		// name, as in `"input:checked ~ &"` — used to be emitted as a declaration
		// whose value stringifies to `[object Object]`, which browsers discard, so
		// the rule vanished with no error anywhere. Now it throws instead.
		expect(() => when("input:checked ~ &", p(4))).toThrow(/would be emitted as a declaration/);
		expect(() => when("> *", p(4))).toThrow();
	});

	test("the `:is(...)` form of the same selector is accepted and emitted verbatim", async () => {
		let css = await serialize(when(":is(input:checked) ~ &", p(4)));

		expect(css).toContain(":is(input:checked) ~ & {");
		// `[object Object]` is the fingerprint of a selector that fell through to
		// the declaration path; asserting its absence is what proves the rule
		// actually reached the stylesheet.
		expect(css).not.toContain("[object Object]");
	});

	test("every prefix the serializer recognizes is accepted", () => {
		for (let selector of ["&:hover", "@media (min-width: 0)", ":is(a) ~ &", "[data-x] &", ".x &"]) {
			expect(() => when(selector, p(4))).not.toThrow();
		}
	});
});
