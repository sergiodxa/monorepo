/**
 * Unit tests for `calc()`, a plain string builder (not a mixin).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { calc } from "./calc";

describe("calc", () => {
	test("wraps the expression in calc(...)", () => {
		expect(calc("100% - 1rem")).toBe("calc(100% - 1rem)");
	});

	test("composes with another raw CSS value", () => {
		expect(calc("var(--ui-overlay-arrow-offset, 0.5rem) * -1")).toBe(
			"calc(var(--ui-overlay-arrow-offset, 0.5rem) * -1)",
		);
	});
});
