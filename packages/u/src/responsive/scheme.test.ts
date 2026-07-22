/**
 * Unit tests for `scheme.ts`, the light/dark mode wrapper covering both the
 * forced-class contract and the system-preference contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { scheme } from "./scheme";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scheme", () => {
	test("'dark' produces both the forced-class key and the system-preference key with the same styles", () => {
		expect(styles(scheme("dark", bg("neutral.solid")))).toEqual({
			".dark &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			"@media (prefers-color-scheme: dark)": {
				".system &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			},
		});
	});

	test("'light' produces both the forced-class key and the system-preference key with the same styles", () => {
		expect(styles(scheme("light", bg("neutral.solid")))).toEqual({
			".light &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			"@media (prefers-color-scheme: light)": {
				".system &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			},
		});
	});
});
