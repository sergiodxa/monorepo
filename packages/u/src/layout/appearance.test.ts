/**
 * Unit tests for `appearance()`'s default and explicit `appearance` value,
 * mirrored onto both vendor-prefixed properties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { appearance } from "./appearance";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("appearance", () => {
	test("defaults to none across the standard property and both vendor prefixes", () => {
		expect(styles(appearance())).toEqual({
			WebkitAppearance: "none",
			MozAppearance: "none",
			appearance: "none",
		});
	});

	test("accepts an explicit value, mirrored the same way", () => {
		expect(styles(appearance("auto"))).toEqual({
			WebkitAppearance: "auto",
			MozAppearance: "auto",
			appearance: "auto",
		});
	});

	test("omits MozAppearance when moz is disabled", () => {
		let result = styles(appearance("none", { moz: false }));
		expect(result).toEqual({
			WebkitAppearance: "none",
			appearance: "none",
		});
		expect(result).not.toHaveProperty("MozAppearance");
	});

	test("omits WebkitAppearance when webkit is disabled", () => {
		let result = styles(appearance("none", { webkit: false }));
		expect(result).toEqual({
			MozAppearance: "none",
			appearance: "none",
		});
		expect(result).not.toHaveProperty("WebkitAppearance");
	});
});
