/**
 * Exercises validateItem against the one field JSON Feed insists on for an item.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { JSONFeedParseError } from "../index.js";

import { validateItem } from "./validate-item.js";

describe("validateItem", () => {
	test("accepts an item carrying an id", () => {
		expect(isSuccess(validateItem({ id: "1", contentText: "Hi" }))).toBe(true);
	});

	test("accepts an item carrying neither body, which a reader still keeps", () => {
		expect(isSuccess(validateItem({ id: "1" }))).toBe(true);
	});

	test("rejects an item missing an id", () => {
		let result = validateItem({ id: "" });
		expect(isFailure(result) && result.error).toEqual(
			new JSONFeedParseError("Item must include an id."),
		);
	});
});
