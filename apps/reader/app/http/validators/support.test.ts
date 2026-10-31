/**
 * Tests the support form's fields: a complete message passes with its address normalised,
 * and each refusal is the key the form translates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import { SupportSchema } from "~/app/http/validators/support";

/** A form holding `fields`. */
function formOf(fields: Record<string, string>): FormData {
	let form = new FormData();
	for (let [name, value] of Object.entries(fields)) form.set(name, value);
	return form;
}

/** A message a person would send. */
const VALID = {
	email: "  Ada@Example.com ",
	topic: "question",
	message: "How do I import my feeds from Feedly?",
};

describe("SupportSchema", () => {
	test("accepts a complete message, its name optional", async () => {
		let result = await validate(formOf(VALID), SupportSchema);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.name).toBe("");
	});

	test.each([
		[{ email: "" }, "support.errors.emailMissing"],
		[{ email: "not an address" }, "support.errors.emailInvalid"],
		[{ topic: "refund-now" }, "support.errors.topic"],
		[{ message: "help" }, "support.errors.messageShort"],
	])("refuses %o with %s", async (override, key) => {
		let result = await validate(formOf({ ...VALID, ...override }), SupportSchema);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.issues.map((issue) => issue.message)).toContain(key);
	});
});
