/**
 * Unit tests for `detailsContent()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflow } from "../overflow/overflow";
import { bs } from "../size/bs";

import { detailsContent } from "./details-content";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("detailsContent", () => {
	test("nests the merged input under &::details-content", () => {
		expect(styles(detailsContent([overflow("clip"), bs(0)]))).toEqual({
			"&::details-content": {
				overflow: "clip",
				blockSize: "calc(var(--ui-spacing, 0.25rem) * 0)",
			},
		});
	});
});
