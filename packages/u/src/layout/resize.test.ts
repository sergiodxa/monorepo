/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { resize } from "./resize";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("resize", () => {
	test("defaults to the logical block axis", () => {
		expect(styles(resize())).toEqual({ resize: "block" });
	});

	test("'none'", () => {
		expect(styles(resize("none"))).toEqual({ resize: "none" });
	});

	test("'both'", () => {
		expect(styles(resize("both"))).toEqual({ resize: "both" });
	});

	test("'horizontal'", () => {
		expect(styles(resize("horizontal"))).toEqual({ resize: "horizontal" });
	});

	test("'block'", () => {
		expect(styles(resize("block"))).toEqual({ resize: "block" });
	});

	test("'inline'", () => {
		expect(styles(resize("inline"))).toEqual({ resize: "inline" });
	});
});
