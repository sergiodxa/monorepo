/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { viewTimelineName } from "./view-timeline-name";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("viewTimelineName", () => {
	test("prefixes the name with --", () => {
		expect(styles(viewTimelineName("reveal"))).toEqual({ viewTimelineName: "--reveal" });
	});

	test("prefixes a multi-word name the same way", () => {
		expect(styles(viewTimelineName("hero-image"))).toEqual({ viewTimelineName: "--hero-image" });
	});

	test("emits only viewTimelineName", () => {
		expect(Object.keys(styles(viewTimelineName("reveal")))).toEqual(["viewTimelineName"]);
	});
});
