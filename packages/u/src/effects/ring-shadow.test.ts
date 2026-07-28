/**
 * Unit tests for `ringShadow()` writing its ring to the `ring` slot of the
 * shared composite `boxShadow` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BOX_SHADOW } from "../internal/box-shadow";
import { merge } from "../internal/descriptor";

import { ringShadow } from "./ring-shadow";
import { shadow } from "./shadow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("ringShadow", () => {
	test("a bare tone defaults to a 2px ring in that tone's solid background color", () => {
		expect(styles(ringShadow("brand"))).toEqual({
			"--ui-box-shadow-ring": "0 0 0 2px var(--ui-brand-bg-solid)",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});

	test("accepts a numeric width", () => {
		expect(styles(ringShadow("danger", 3))).toEqual({
			"--ui-box-shadow-ring": "0 0 0 3px var(--ui-danger-bg-solid)",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});

	test("accepts a string width, passed through unchanged", () => {
		expect(styles(ringShadow("neutral", "0.25rem"))).toEqual({
			"--ui-box-shadow-ring": "0 0 0 0.25rem var(--ui-neutral-bg-solid)",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});
});

describe("composability with shadow", () => {
	test("composing ringShadow() and shadow() together sets both slots under the same composite boxShadow", () => {
		let merged = merge(styles(ringShadow("brand", 3)), styles(shadow("md")));

		expect(merged).toEqual({
			"--ui-box-shadow-ring": "0 0 0 3px var(--ui-brand-bg-solid)",
			"--ui-box-shadow-elevation":
				"var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});

	test("the ring slot paints before the elevation slot in the composite", () => {
		expect(COMPOSITE_BOX_SHADOW.indexOf("--ui-box-shadow-ring")).toBeLessThan(
			COMPOSITE_BOX_SHADOW.indexOf("--ui-box-shadow-elevation"),
		);
	});
});
