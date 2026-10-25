/**
 * Exercises validateItem against title/description acceptance and rejection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { RSSParseError } from "../index.js";

import { validateItem } from "./validate-item.js";

describe("validateItem", () => {
	test("accepts items with a title", () => {
		expect(isSuccess(validateItem({ title: "Post title" }))).toBe(true);
	});

	test("accepts items with a description", () => {
		expect(isSuccess(validateItem({ description: "Post description" }))).toBe(true);
	});

	test("rejects items missing both title and description", () => {
		let result = validateItem({});

		expect(isFailure(result) && result.error).toEqual(
			new RSSParseError("Item must include at least a title or description."),
		);
	});
});
