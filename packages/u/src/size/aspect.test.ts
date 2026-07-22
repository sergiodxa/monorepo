/**
 * Unit tests for `aspect()`'s width/height `aspect-ratio` pairing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { aspect } from "./aspect";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("aspect", () => {
	test("joins width and height into an aspect-ratio expression", () => {
		expect(styles(aspect(16, 9))).toEqual({ aspectRatio: "16 / 9" });
	});

	test("resolves every named ratio", () => {
		expect(styles(aspect("square"))).toEqual({ aspectRatio: "1 / 1" });
		expect(styles(aspect("video"))).toEqual({ aspectRatio: "16 / 9" });
		expect(styles(aspect("widescreen"))).toEqual({ aspectRatio: "21 / 9" });
		expect(styles(aspect("portrait"))).toEqual({ aspectRatio: "3 / 4" });
		expect(styles(aspect("story"))).toEqual({ aspectRatio: "9 / 16" });
		expect(styles(aspect("photo"))).toEqual({ aspectRatio: "4 / 3" });
	});
});
