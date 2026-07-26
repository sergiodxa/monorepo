/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { merge } from "../internal/descriptor";

import { backdropBlur } from "./backdrop-blur";
import { backdropSaturate } from "./backdrop-saturate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropSaturate", () => {
	test("no-arg defaults to 1.4", () => {
		expect(styles(backdropSaturate())).toEqual({
			"--ui-backdrop-saturate": "1.4",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit numeric factor", () => {
		expect(styles(backdropSaturate(2))).toEqual({
			"--ui-backdrop-saturate": "2",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit string factor passes through unchanged", () => {
		expect(styles(backdropSaturate("200%"))).toEqual({
			"--ui-backdrop-saturate": "200%",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});

describe("composability with backdropBlur", () => {
	test("composing backdropBlur() and backdropSaturate() together sets both variables under the same composite backdropFilter", () => {
		let blurMixin = backdropBlur("lg");
		let saturateMixin = backdropSaturate(1.4);

		let merged = merge(styles(blurMixin), styles(saturateMixin));

		expect(merged).toEqual({
			"--ui-backdrop-blur": "var(--ui-blur-lg, 24px)",
			"--ui-backdrop-saturate": "1.4",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});
