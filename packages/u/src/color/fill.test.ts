/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fill } from "./fill";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fill", () => {
	test("no-arg resolves the system default", () => {
		expect(styles(fill())).toEqual({ fill: "var(--ui-fg, CanvasText)" });
	});

	test("a bare tone defaults to that tone's plain fg weight", () => {
		expect(styles(fill("brand"))).toEqual({ fill: "var(--ui-brand-fg)" });
	});

	test("an explicit tint suffix aliases to the bg-tint property", () => {
		expect(styles(fill("neutral.tint"))).toEqual({ fill: "var(--ui-neutral-bg-tint)" });
	});
});
