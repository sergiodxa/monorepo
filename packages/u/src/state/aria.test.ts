/**
 * Unit tests for `aria.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { aria } from "./aria";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("aria", () => {
	test("with no value, targets the bare attribute selector", () => {
		expect(styles(aria("busy", p(4)))).toEqual({
			"&[aria-busy]": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("with a value, targets the attribute=value selector", () => {
		expect(styles(aria("expanded", "true", p(4)))).toEqual({
			'&[aria-expanded="true"]': { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});

	test("a numeric value is interpolated the same way", () => {
		expect(styles(aria("level", 2, p(4)))).toEqual({
			'&[aria-level="2"]': { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
