/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { merge } from "../internal/descriptor";
import { COMPOSITE_FILTER } from "../internal/filter";

import { backdropSaturate } from "./backdrop-saturate";
import { saturate } from "./saturate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("saturate", () => {
	test("no-arg defaults to 1.5", () => {
		expect(styles(saturate())).toEqual({
			"--ui-filter-saturate": "1.5",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit numeric factor", () => {
		expect(styles(saturate(0))).toEqual({
			"--ui-filter-saturate": "0",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit string factor passes through unchanged", () => {
		expect(styles(saturate("150%"))).toEqual({
			"--ui-filter-saturate": "150%",
			filter: COMPOSITE_FILTER,
		});
	});

	test("does not collide with backdropSaturate, which writes a different variable and property", () => {
		let merged = merge(styles(saturate(1.5)), styles(backdropSaturate(1.4)));

		expect(merged).toEqual({
			"--ui-filter-saturate": "1.5",
			filter: COMPOSITE_FILTER,
			"--ui-backdrop-saturate": "1.4",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});
