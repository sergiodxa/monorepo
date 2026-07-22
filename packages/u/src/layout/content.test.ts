/**
 * Unit tests for `content()`'s default value, plain keywords, and the
 * `between`/`around`/`evenly` aliasing to their `space-*` CSS keywords —
 * the same aliasing `u.justify()` applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { content } from "./content";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("content", () => {
	test("defaults to start", () => {
		expect(styles(content())).toEqual({ alignContent: "start" });
	});

	test("passes a plain keyword through unchanged", () => {
		expect(styles(content("center"))).toEqual({ alignContent: "center" });
	});

	test("aliases between to space-between", () => {
		expect(styles(content("between"))).toEqual({ alignContent: "space-between" });
	});

	test("aliases around to space-around", () => {
		expect(styles(content("around"))).toEqual({ alignContent: "space-around" });
	});

	test("aliases evenly to space-evenly", () => {
		expect(styles(content("evenly"))).toEqual({ alignContent: "space-evenly" });
	});
});
