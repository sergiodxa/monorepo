/**
 * Exercises validateItem against title/description acceptance and rejection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { validateItem } from "./validate-item.js";

describe("validateItem", () => {
	test("accepts items with a title", () => {
		expect(() =>
			validateItem({
				title: "Post title",
			}),
		).not.toThrow();
	});

	test("accepts items with a description", () => {
		expect(() =>
			validateItem({
				description: "Post description",
			}),
		).not.toThrow();
	});

	test("rejects items missing both title and description", () => {
		expect(() => validateItem({})).toThrow("Item must include at least a title or description.");
	});
});
