/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollTimelineName } from "./scroll-timeline-name";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollTimelineName", () => {
	test("prefixes the name with --", () => {
		expect(styles(scrollTimelineName("page-scroll"))).toEqual({
			scrollTimelineName: "--page-scroll",
		});
	});

	test("prefixes a single-word name the same way", () => {
		expect(styles(scrollTimelineName("log"))).toEqual({ scrollTimelineName: "--log" });
	});

	test("emits only scrollTimelineName", () => {
		expect(Object.keys(styles(scrollTimelineName("page-scroll")))).toEqual(["scrollTimelineName"]);
	});
});
