/**
 * Unit tests for `light.ts`, sugar over `scheme("light", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { light } from "./light";
import { scheme } from "./scheme";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("light", () => {
	test("produces the identical shape scheme('light', input) would", () => {
		expect(styles(light(bg("neutral.solid")))).toEqual(
			styles(scheme("light", bg("neutral.solid"))),
		);
	});

	test("nests the forced-class key and the system-preference key with the same styles", () => {
		expect(styles(light(bg("neutral.solid")))).toEqual({
			".light &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			"@media (prefers-color-scheme: light)": {
				".system &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			},
		});
	});
});
