/**
 * The docs contact form's validation: an address and a message are required, the name and
 * page are optional.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import { DocsContactSchema } from "~/app/http/validators/docs-contact";

/** A form as the contact page submits it. */
function form(fields: Record<string, string>): FormData {
	let data = new FormData();
	for (let [name, value] of Object.entries(fields)) data.set(name, value);
	return data;
}

describe("DocsContactSchema", () => {
	test("accepts an address and a message, defaulting the rest", async () => {
		let result = await validate(
			form({ email: "ada@example.com", message: "Hi" }),
			DocsContactSchema,
		);

		expect(isSuccess(result) && result.data).toEqual({
			name: "",
			email: "ada@example.com",
			message: "Hi",
			page: "",
		});
	});

	test("refuses an address that isn't one", async () => {
		let result = await validate(form({ email: "ada", message: "Hi" }), DocsContactSchema);
		expect(isFailure(result)).toBe(true);
	});

	test("refuses an empty message", async () => {
		let result = await validate(form({ email: "ada@example.com", message: "" }), DocsContactSchema);
		expect(isFailure(result)).toBe(true);
	});
});
