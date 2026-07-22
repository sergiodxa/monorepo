/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fg } from "./fg";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fg", () => {
	test("no-arg resolves the system default", () => {
		expect(styles(fg())).toEqual({ color: "var(--ui-fg, CanvasText)" });
	});

	test("a bare tone defaults to that tone's plain fg weight", () => {
		expect(styles(fg("brand"))).toEqual({ color: "var(--ui-brand-fg)" });
	});

	test("an explicit muted suffix", () => {
		expect(styles(fg("brand.muted"))).toEqual({ color: "var(--ui-brand-fg-muted)" });
	});

	test("an explicit emphasis suffix", () => {
		expect(styles(fg("brand.emphasis"))).toEqual({ color: "var(--ui-brand-fg-emphasis)" });
	});
});
