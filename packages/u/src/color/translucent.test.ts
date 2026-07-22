/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { translucent } from "./translucent";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("translucent", () => {
	test("defaults to the md blur", () => {
		expect(styles(translucent())).toEqual({
			backgroundColor: "var(--ui-bg, Canvas)",
			"@media (prefers-reduced-transparency: no-preference)": {
				backdropFilter: "blur(var(--ui-blur-md, 12px))",
			},
		});
	});

	test("an explicit sm blur", () => {
		expect(styles(translucent("sm"))).toEqual({
			backgroundColor: "var(--ui-bg, Canvas)",
			"@media (prefers-reduced-transparency: no-preference)": {
				backdropFilter: "blur(var(--ui-blur-sm, 4px))",
			},
		});
	});
});
