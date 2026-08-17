/**
 * Tests for the item data contracts and the authored item catalog.
 *
 * This suite guards the boundary between the content-agnostic item data layer
 * and the authored content that fills it. In particular it verifies that every
 * item exposes a content-defined `category` as a plain, non-empty string. This
 * protects against a franchise-specific enum creeping back into the engine data
 * layer and against items shipping with an empty or missing category value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, it } from "vitest";

import { ITEMS } from "~/content/items";

describe("ITEMS catalog", () => {
	it("assigns every entry a non-empty string category", () => {
		for (let [id, item] of Object.entries(ITEMS)) {
			expect(typeof item.category, `${id} category should be a string`).toBe("string");
			expect(item.category.length, `${id} category should not be empty`).toBeGreaterThan(0);
		}
	});
});
