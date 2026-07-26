/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fontSize } from "./font-size";
import { text } from "./text";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fontSize", () => {
	test("a named size resolves only fontSize, with no lineHeight", () => {
		expect(styles(fontSize("lg"))).toEqual({ fontSize: "var(--ui-text-lg, 1.125rem)" });
	});

	test("'sm' matches text('sm')'s own fontSize half exactly", () => {
		expect(styles(fontSize("sm"))).toEqual({ fontSize: "var(--ui-text-sm, 0.875rem)" });
		expect(styles(fontSize("sm")).fontSize).toEqual(styles(text("sm")).fontSize);
	});

	test("'xs' matches text('xs')'s own fontSize half exactly", () => {
		expect(styles(fontSize("xs"))).toEqual({ fontSize: "var(--ui-text-xs, 0.75rem)" });
		expect(styles(fontSize("xs")).fontSize).toEqual(styles(text("xs")).fontSize);
	});
});
