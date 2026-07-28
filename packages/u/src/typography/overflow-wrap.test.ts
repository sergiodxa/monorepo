/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflowWrap } from "./overflow-wrap";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overflowWrap", () => {
	test("no-arg defaults to break-word", () => {
		expect(styles(overflowWrap())).toEqual({ overflowWrap: "break-word" });
	});

	test("normal", () => {
		expect(styles(overflowWrap("normal"))).toEqual({ overflowWrap: "normal" });
	});

	test("anywhere", () => {
		expect(styles(overflowWrap("anywhere"))).toEqual({ overflowWrap: "anywhere" });
	});
});
