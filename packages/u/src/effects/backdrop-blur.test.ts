/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropBlur } from "./backdrop-blur";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("backdropBlur", () => {
	test("no-arg defaults to the md blur, set on the --ui-backdrop-blur variable behind the composite backdropFilter", () => {
		expect(styles(backdropBlur())).toEqual({
			"--ui-backdrop-blur": "var(--ui-blur-md, 12px)",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit named blur", () => {
		expect(styles(backdropBlur("lg"))).toEqual({
			"--ui-backdrop-blur": "var(--ui-blur-lg, 24px)",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("applies unconditionally, with no prefers-reduced-transparency gating", () => {
		let result = styles(backdropBlur("sm"));
		expect(Object.keys(result).sort()).toEqual(
			["--ui-backdrop-blur", "backdropFilter", "WebkitBackdropFilter"].sort(),
		);
		expect(result["--ui-backdrop-blur"]).toBe("var(--ui-blur-sm, 4px)");
	});
});
