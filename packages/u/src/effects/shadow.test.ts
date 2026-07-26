/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { shadow } from "./shadow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("shadow", () => {
	test("no-arg defaults to the md shadow", () => {
		expect(styles(shadow())).toEqual({
			boxShadow:
				"var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
		});
	});

	test("an explicit named shadow", () => {
		expect(styles(shadow("lg"))).toEqual({
			boxShadow:
				"var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
		});
	});

	test("the base shadow", () => {
		expect(styles(shadow("base"))).toEqual({
			boxShadow:
				"var(--ui-shadow-base, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))",
		});
	});
});
