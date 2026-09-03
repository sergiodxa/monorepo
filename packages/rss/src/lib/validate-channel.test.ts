/**
 * Exercises validateChannel against required-field acceptance and rejection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { validateChannel } from "./validate-channel.js";

describe("validateChannel", () => {
	test("accepts channels with required fields", () => {
		expect(() =>
			validateChannel({
				title: "Feed",
				description: "Description",
				link: "https://example.com",
			}),
		).not.toThrow();
	});

	test("rejects channels missing required fields", () => {
		expect(() =>
			validateChannel({
				title: "Feed",
				description: "",
				link: "https://example.com",
			}),
		).toThrow("Channel must include title, description, and link.");
	});
});
