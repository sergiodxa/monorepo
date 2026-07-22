/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { blur } from "./blur";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("blur", () => {
	test("no-arg defaults to the md blur, wrapped in filter: blur(...)", () => {
		expect(styles(blur())).toEqual({ filter: "blur(var(--ui-blur-md, 12px))" });
	});

	test("an explicit named blur", () => {
		expect(styles(blur("lg"))).toEqual({ filter: "blur(var(--ui-blur-lg, 24px))" });
	});
});
