/**
 * Unit tests for `data.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { data } from "./data";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("data", () => {
	test("with no value, targets the bare attribute selector", () => {
		expect(styles(data("disabled", p(4)))).toEqual({
			"&[data-disabled]": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("with a value, targets the attribute=value selector", () => {
		expect(styles(data("orientation", "vertical", p(4)))).toEqual({
			'&[data-orientation="vertical"]': { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("a numeric value is interpolated the same way", () => {
		expect(styles(data("count", 3, p(4)))).toEqual({
			'&[data-count="3"]': { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
