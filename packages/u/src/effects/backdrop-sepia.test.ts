/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropSepia } from "./backdrop-sepia";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropSepia", () => {
	test("no-arg defaults to 1", () => {
		expect(styles(backdropSepia())).toEqual({
			"--ui-backdrop-sepia": "1",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit partial amount", () => {
		expect(styles(backdropSepia(0.6))).toEqual({
			"--ui-backdrop-sepia": "0.6",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit string amount passes through unchanged", () => {
		expect(styles(backdropSepia("60%"))).toEqual({
			"--ui-backdrop-sepia": "60%",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});
