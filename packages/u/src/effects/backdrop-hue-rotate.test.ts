/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropHueRotate } from "./backdrop-hue-rotate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropHueRotate", () => {
	test("no-arg defaults to 90deg", () => {
		expect(styles(backdropHueRotate())).toEqual({
			"--ui-backdrop-hue-rotate": "90deg",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("a bare number is treated as degrees", () => {
		expect(styles(backdropHueRotate(180))).toEqual({
			"--ui-backdrop-hue-rotate": "180deg",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("a raw angle string passes through unchanged", () => {
		expect(styles(backdropHueRotate("0.5turn"))).toEqual({
			"--ui-backdrop-hue-rotate": "0.5turn",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});
