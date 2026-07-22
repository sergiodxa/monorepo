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
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { at } from "../responsive/at";
import { p } from "../size/p";
import { hover } from "../state/hover";

import { merge } from "./descriptor";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

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
	test("u.at('md', [u.p(4), u.hover(u.p(6))]) nests a container query around a plain declaration and a merged &:hover block", () => {
		let mixin = at("md", [p(4), hover(p(6))]);

		expect(styles(mixin)).toEqual({
			"@container (min-width: var(--ui-container-md, 36rem))": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
				"&:hover": { padding: "calc(var(--ui-spacing, 0.25rem) * 6)" },
			},
		});
	});

	test("u.hover([u.bg(...), u.border(...)]) merges both utilities under one &:hover block", () => {
		let mixin = hover([bg("brand.tint"), border("brand")]);

		expect(styles(mixin)).toEqual({
			"&:hover": {
				backgroundColor: "var(--ui-brand-bg-tint)",
				borderColor: "var(--ui-brand-border)",
			},
		});
	});

	test("falsy entries in a wrapper's input array are dropped", () => {
		let mixin = hover([p(4), false, null, undefined]);

		expect(styles(mixin)).toEqual({
			"&:hover": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});

describe("dedupe", () => {
	test("identical atomic utility calls produce structurally equal style trees for css() to dedupe", () => {
		expect(styles(p(4))).toEqual(styles(p(4)));
	});
});
