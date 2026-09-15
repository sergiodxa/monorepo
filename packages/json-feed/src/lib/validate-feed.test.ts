/**
 * Exercises validateFeed against the one field JSON Feed requires of a feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { validateFeed } from "./validate-feed.js";

describe("validateFeed", () => {
	test("accepts a feed carrying a title", () => {
		expect(() => validateFeed({ title: "My Blog" })).not.toThrow();
	});

	test("rejects a feed missing a title", () => {
		expect(() => validateFeed({ title: "" })).toThrow("Feed must include a title.");
	});
});
