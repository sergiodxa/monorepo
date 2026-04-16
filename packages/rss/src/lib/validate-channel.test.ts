import { describe, expect, test } from "bun:test";

import { validateChannel } from "./validate-channel";

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
