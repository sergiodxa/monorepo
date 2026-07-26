/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { stroke } from "./stroke";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("stroke", () => {
	test("no-arg resolves the system default", () => {
		expect(styles(stroke())).toEqual({ stroke: "var(--ui-fg, CanvasText)" });
	});

	test("a bare tone defaults to that tone's plain fg weight", () => {
		expect(styles(stroke("brand"))).toEqual({ stroke: "var(--ui-brand-fg)" });
	});

	test("an explicit tint suffix aliases to the bg-tint property", () => {
		expect(styles(stroke("neutral.tint"))).toEqual({ stroke: "var(--ui-neutral-bg-tint)" });
	});
});
