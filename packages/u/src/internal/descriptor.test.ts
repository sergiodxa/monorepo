/**
 * Proves out the wrapper/composition model before the rest of the utility
 * surface builds on it: nested wrappers merge and re-emit
 * correctly, `merge()` deep-merges shared selector blocks instead of
 * replacing them, and structurally identical atomic calls stay structurally
 * equal so `css()`'s own hash-based cache dedupes them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { at } from "../responsive/at";
import { p } from "../size/p";
import { hover } from "../state/hover";

import { merge } from "./descriptor";
import { declarations, serialize } from "./serialize";

describe("merge", () => {
	test("a later tree's declaration overwrites an earlier tree's same key", () => {
		expect(merge({ padding: "1px" }, { padding: "2px" })).toEqual({ padding: "2px" });
	});

	test("a nested block shared by more than one tree is merged, not replaced", () => {
		let result = merge(
			{ "&:hover": { backgroundColor: "red" } },
			{ "&:hover": { borderColor: "blue" } },
		);

		expect(result).toEqual({ "&:hover": { backgroundColor: "red", borderColor: "blue" } });
	});
});

describe("nested wrappers", () => {
	test("u.at('md', [u.p(4), u.hover(u.p(6))]) nests a container query around a plain declaration and a merged &:hover block", async () => {
		let mixin = at("md", [p(4), hover(p(6))]);
		let css = await serialize(mixin);

		expect(css).toContain("@container (min-width: 36rem)");
		expect(css).toContain("&:hover");
		expect(await declarations(mixin)).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
			"padding: calc(var(--ui-spacing, 0.25rem) * 6)",
		]);
	});

	test("u.hover([u.bg(...), u.border(...)]) merges both utilities under one &:hover block", async () => {
		let mixin = hover([bg("brand.tint"), border("brand")]);
		let css = await serialize(mixin);

		expect(css.match(/&:hover/g)).toHaveLength(1);
		expect(await declarations(mixin)).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
			"border-color: var(--ui-brand-border)",
		]);
	});

	test("falsy entries in a wrapper's input array are dropped", async () => {
		let mixin = hover([p(4), false, null, undefined]);

		expect(await serialize(mixin)).toContain("&:hover");
		expect(await declarations(mixin)).toEqual(["padding: calc(var(--ui-spacing, 0.25rem) * 4)"]);
	});
});

describe("dedupe", () => {
	test("identical atomic utility calls produce the identical generated class", async () => {
		expect(await serialize(p(4))).toEqual(await serialize(p(4)));
	});
});
