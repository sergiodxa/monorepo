/**
 * The docs feedback form's validation: a vote and a page are required, the note is optional
 * and capped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import { DocsFeedbackSchema } from "~/app/http/validators/docs-feedback";

/** A form as the feedback component submits it. */
function form(fields: Record<string, string>): FormData {
	let data = new FormData();
	for (let [name, value] of Object.entries(fields)) data.set(name, value);
	return data;
}

describe("DocsFeedbackSchema", () => {
	test("accepts a vote without a note", async () => {
		let result = await validate(
			form({ helpful: "yes", page: "/docs/quickstart" }),
			DocsFeedbackSchema,
		);
		expect(isSuccess(result) && result.data.note).toBe("");
	});

	test("refuses a vote other than yes or no", async () => {
		let result = await validate(
			form({ helpful: "maybe", page: "/docs/quickstart" }),
			DocsFeedbackSchema,
		);
		expect(isFailure(result)).toBe(true);
	});

	test("refuses a note past the cap", async () => {
		let result = await validate(
			form({ helpful: "no", page: "/docs/quickstart", note: "x".repeat(2001) }),
			DocsFeedbackSchema,
		);
		expect(isFailure(result)).toBe(true);
	});
});
