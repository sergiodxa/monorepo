/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { filterOpacity } from "./filter-opacity";
import { opacity } from "./opacity";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("filterOpacity", () => {
	test("no-arg defaults to 0.5", () => {
		expect(styles(filterOpacity())).toEqual({
			"--ui-filter-opacity": "0.5",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit numeric amount in the native 0-1 range", () => {
		expect(styles(filterOpacity(0.25))).toEqual({
			"--ui-filter-opacity": "0.25",
			filter: COMPOSITE_FILTER,
		});
	});

	test("a raw percentage string passes through unchanged", () => {
		expect(styles(filterOpacity("25%"))).toEqual({
			"--ui-filter-opacity": "25%",
			filter: COMPOSITE_FILTER,
		});
	});

	test("it sets the filter variable, never the opacity property", () => {
		let result = styles(filterOpacity(0.5)) as Record<string, unknown>;

		expect(Object.keys(result).sort()).toEqual(["--ui-filter-opacity", "filter"]);
		expect(result.opacity).toBeUndefined();
	});

	test("it does not share the 0-100 convention u.opacity() uses", () => {
		let plain = styles(opacity(50)) as Record<string, unknown>;
		let filtered = styles(filterOpacity(0.5)) as Record<string, unknown>;

		expect(plain).toEqual({ opacity: 0.5 });
		expect(filtered["--ui-filter-opacity"]).toBe("0.5");
	});
});
