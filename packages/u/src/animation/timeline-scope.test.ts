/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { timelineScope } from "./timeline-scope";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("timelineScope", () => {
	test("prefixes a single name with --", () => {
		expect(styles(timelineScope("page-scroll"))).toEqual({ timelineScope: "--page-scroll" });
	});

	test("prefixes every name and joins them with a comma", () => {
		expect(styles(timelineScope("page-scroll", "hero-reveal"))).toEqual({
			timelineScope: "--page-scroll, --hero-reveal",
		});
	});

	test("emits an empty value when called with no names", () => {
		expect(styles(timelineScope())).toEqual({ timelineScope: "" });
	});
});
