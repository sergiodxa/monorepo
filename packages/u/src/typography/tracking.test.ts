/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { tracking } from "./tracking";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("tracking", () => {
	test("every named scale value resolves through the tracking variable with its fallback", () => {
		expect(styles(tracking("tighter"))).toEqual({
			letterSpacing: "var(--ui-tracking-tighter, -0.05em)",
		});
		expect(styles(tracking("tight"))).toEqual({
			letterSpacing: "var(--ui-tracking-tight, -0.025em)",
		});
		expect(styles(tracking("normal"))).toEqual({
			letterSpacing: "var(--ui-tracking-normal, 0em)",
		});
		expect(styles(tracking("wide"))).toEqual({
			letterSpacing: "var(--ui-tracking-wide, 0.025em)",
		});
		expect(styles(tracking("wider"))).toEqual({
			letterSpacing: "var(--ui-tracking-wider, 0.05em)",
		});
		expect(styles(tracking("widest"))).toEqual({
			letterSpacing: "var(--ui-tracking-widest, 0.1em)",
		});
	});

	test("no-arg defaults to normal", () => {
		expect(styles(tracking())).toEqual({ letterSpacing: "var(--ui-tracking-normal, 0em)" });
	});
});
