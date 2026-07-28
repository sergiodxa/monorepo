/**
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

describe("shadow", () => {
	test("no-arg defaults to the md shadow, written to the elevation slot", () => {
		expect(styles(shadow())).toEqual({
			"--ui-box-shadow-elevation":
				"var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});

	test("an explicit named shadow", () => {
		expect(styles(shadow("lg"))).toEqual({
			"--ui-box-shadow-elevation":
				"var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});

	test("the base shadow", () => {
		expect(styles(shadow("base"))).toEqual({
			"--ui-box-shadow-elevation":
				"var(--ui-shadow-base, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});
});

describe("composability with ringShadow", () => {
	test("composing shadow() and ringShadow() together sets both slots under the same composite boxShadow", () => {
		let merged = merge(styles(shadow("lg")), styles(ringShadow("brand")));

		expect(merged).toEqual({
			"--ui-box-shadow-elevation":
				"var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
			"--ui-box-shadow-ring": "0 0 0 2px var(--ui-brand-bg-solid)",
			boxShadow: COMPOSITE_BOX_SHADOW,
		});
	});

	test("neither utility's slot depends on which one is merged last", () => {
		let elevationFirst = merge(styles(shadow("lg")), styles(ringShadow("brand")));
		let ringFirst = merge(styles(ringShadow("brand")), styles(shadow("lg")));

		expect(ringFirst).toEqual(elevationFirst);
	});
});
