/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { sepia } from "./sepia";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("sepia", () => {
	test("no-arg defaults to a full conversion", () => {
		expect(styles(sepia())).toEqual({
			"--ui-filter-sepia": "1",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit partial amount", () => {
		expect(styles(sepia(0.4))).toEqual({
			"--ui-filter-sepia": "0.4",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit string amount passes through unchanged", () => {
		expect(styles(sepia("40%"))).toEqual({
			"--ui-filter-sepia": "40%",
			filter: COMPOSITE_FILTER,
		});
	});
});
