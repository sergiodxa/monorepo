/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { backdropBlur } from "./backdrop-blur";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("backdropBlur", () => {
	test("no-arg defaults to the md blur, wrapped in backdropFilter: blur(...)", () => {
		expect(styles(backdropBlur())).toEqual({ backdropFilter: "blur(var(--ui-blur-md, 12px))" });
	});

	test("an explicit named blur", () => {
		expect(styles(backdropBlur("lg"))).toEqual({
			backdropFilter: "blur(var(--ui-blur-lg, 24px))",
		});
	});

	test("applies unconditionally, with no prefers-reduced-transparency gating", () => {
		let result = styles(backdropBlur("sm"));
		expect(Object.keys(result)).toEqual(["backdropFilter"]);
		expect(result).toEqual({ backdropFilter: "blur(var(--ui-blur-sm, 4px))" });
	});
});
