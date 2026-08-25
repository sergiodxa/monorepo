/**
 * Tests for the item data contracts and the authored item catalog.
 *
 * Guards the boundary between the content-agnostic item data layer and its
 * authored content: every item must expose `category` as a non-empty string.
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
