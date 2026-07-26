/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { outlineColor } from "./outline-color";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("outlineColor", () => {
	test("no-arg resolves the system default ring color", () => {
		expect(styles(outlineColor())).toEqual({
			outlineColor: "var(--ui-ring, Highlight)",
		});
	});

	test("a tone resolves to its ring variable", () => {
		expect(styles(outlineColor("danger"))).toEqual({
			outlineColor: "var(--ui-danger-ring)",
		});
	});

	test("sets only outlineColor, no width or style", () => {
		let result = styles(outlineColor("danger"));
		expect(result.outlineWidth).toBeUndefined();
		expect(result.outlineStyle).toBeUndefined();
	});
});
