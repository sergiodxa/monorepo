/**
 * Unit tests for `place()`'s partial-options behavior: only the given
 * option keys should produce a property, with no stray `undefined`
 * properties for the omitted one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { place } from "./place";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("place", () => {
	test("no options produces an empty style tree", () => {
		expect(styles(place())).toEqual({});
	});

	test("only items given sets align-items and justify-items, and nothing else", () => {
		expect(styles(place({ items: "center" }))).toEqual({
			alignItems: "center",
			justifyItems: "center",
		});
	});

	test("only content given sets align-content and justify-content, and nothing else", () => {
		expect(styles(place({ content: "between" }))).toEqual({
			alignContent: "space-between",
			justifyContent: "space-between",
		});
	});

	test("both given sets all four properties, aliasing content the same way u.justify() does", () => {
		expect(styles(place({ items: "center", content: "between" }))).toEqual({
			alignItems: "center",
			justifyItems: "center",
			alignContent: "space-between",
			justifyContent: "space-between",
		});
	});
});
