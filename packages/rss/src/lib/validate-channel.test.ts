/**
 * Exercises validateChannel against required-field acceptance and rejection.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { RSSParseError } from "../index.js";

import { validateChannel } from "./validate-channel.js";

describe("validateChannel", () => {
	test("accepts channels with required fields", () => {
		let result = validateChannel({
			title: "Feed",
			description: "Description",
			link: "https://example.com",
		});

		expect(isSuccess(result)).toBe(true);
	});

	test("rejects channels missing required fields", () => {
		let result = validateChannel({
			title: "Feed",
			description: "",
			link: "https://example.com",
		});

		expect(isFailure(result) && result.error).toEqual(
			new RSSParseError("Channel must include title, description, and link."),
		);
	});
});
