/**
 * Exercises validateItem against the one field JSON Feed insists on for an item.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { validateItem } from "./validate-item.js";

describe("validateItem", () => {
	test("accepts an item carrying an id", () => {
		expect(() => validateItem({ id: "1", contentText: "Hi" })).not.toThrow();
	});

	test("accepts an item carrying neither body, which a reader still keeps", () => {
		expect(() => validateItem({ id: "1" })).not.toThrow();
	});

	test("rejects an item missing an id", () => {
		expect(() => validateItem({ id: "" })).toThrow("Item must include an id.");
	});
});
