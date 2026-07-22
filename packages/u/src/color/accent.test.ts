/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { accent } from "./accent";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("accent", () => {
	test("defaults to the brand solid color", () => {
		expect(styles(accent())).toEqual({ accentColor: "var(--ui-brand-bg-solid)" });
	});

	test("an explicit tone resolves that tone's solid color", () => {
		expect(styles(accent("danger"))).toEqual({ accentColor: "var(--ui-danger-bg-solid)" });
	});
});
