/**
 * Exercises validateFeed against the one field JSON Feed requires of a feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { JSONFeedParseError } from "../index.js";

import { validateFeed } from "./validate-feed.js";

describe("validateFeed", () => {
	test("accepts a feed carrying a title", () => {
		expect(isSuccess(validateFeed({ title: "My Blog" }))).toBe(true);
	});

	test("rejects a feed missing a title", () => {
		let result = validateFeed({ title: "" });
		expect(isFailure(result) && result.error).toEqual(
			new JSONFeedParseError("Feed must include a title."),
		);
	});
});
