/**
 * Unit tests for `dark.ts`, sugar over `scheme("dark", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";

import { dark } from "./dark";
import { scheme } from "./scheme";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("dark", () => {
	test("produces the identical shape scheme('dark', input) would", () => {
		expect(styles(dark(bg("neutral.solid")))).toEqual(styles(scheme("dark", bg("neutral.solid"))));
	});

	test("nests the forced-class key and the system-preference key with the same styles", () => {
		expect(styles(dark(bg("neutral.solid")))).toEqual({
			".dark &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			"@media (prefers-color-scheme: dark)": {
				".system &": { backgroundColor: "var(--ui-neutral-bg-solid)" },
			},
		});
	});
});
