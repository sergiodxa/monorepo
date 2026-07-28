/**
 * Unit tests for `where.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { p } from "../size/p";

import { where } from "./where";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("where", () => {
	test("nests the input's styles under '& :where(selector)', space included", () => {
		expect(styles(where("pre", p(4)))).toEqual({
			"& :where(pre)": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("passes a comma-separated selector list through untouched", () => {
		expect(styles(where("th, td", p(4)))).toEqual({
			"& :where(th, td)": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("merges an array of utilities into one nested block", () => {
		expect(styles(where("a", [bg("brand.tint"), border("brand")]))).toEqual({
			"& :where(a)": {
				backgroundColor: "var(--ui-brand-bg-tint)",
				borderColor: "var(--ui-brand-border)",
			},
		});
	});

	test("drops a falsy input, leaving an empty nested block", () => {
		expect(styles(where("a", false))).toEqual({ "& :where(a)": {} });
	});
});
