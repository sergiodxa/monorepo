/**
 * Unit tests for `absolute()`'s fixed `position: absolute` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { absolute } from "./absolute";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("absolute", () => {
	test("sets position: absolute", () => {
		expect(styles(absolute())).toEqual({ position: "absolute" });
	});
});
