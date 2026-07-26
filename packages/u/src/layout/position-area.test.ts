/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { positionArea } from "./position-area";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("positionArea", () => {
	test("sets a two-keyword area", () => {
		expect(styles(positionArea("top left"))).toEqual({ positionArea: "top left" });
	});

	test("sets a span keyword combination", () => {
		expect(styles(positionArea("bottom span-right"))).toEqual({
			positionArea: "bottom span-right",
		});
	});
});
