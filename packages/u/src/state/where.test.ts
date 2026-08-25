/**
 * Unit tests for `where.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { where } from "./where";

describe("where", () => {
	test("emits '& :where(selector)', keeping the descendant space", async () => {
		/**
		 * The leading space applies CSS's descendant-combinator semantics,
		 * scoping `:where()` to elements nested inside the selector.
		 */
		expect(await serialize(where("pre", p(4)))).toContain("& :where(pre) {");
		expect(await declarations(where("pre", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});

	test("a comma-separated selector list stays inside the one :where()", async () => {
		expect(await serialize(where("th, td", p(4)))).toContain("& :where(th, td) {");
	});

	test("an array of utilities merges into one nested block", async () => {
		expect(await serialize(where("a", [bg("brand.tint"), border("brand")]))).toContain(
			"& :where(a) {",
		);
		expect(await declarations(where("a", [bg("brand.tint"), border("brand")]))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
			"border-color: var(--ui-brand-border)",
		]);
	});

	test("a falsy input emits no CSS at all, not an empty rule", async () => {
		expect(await serialize(where("a", false))).toBe("");
	});
});
