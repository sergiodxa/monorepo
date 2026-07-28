/**
 * Unit tests for `marker.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { marker } from "./marker";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("marker", () => {
	test("nests the input's styles under '&::marker'", () => {
		expect(styles(marker(p(4)))).toEqual({
			"&::marker": { padding: "calc(var(--ui-spacing, 0.25rem) * 4)" },
		});
	});
});
