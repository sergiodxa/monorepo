/**
 * Tests the deletion confirmation schema. The point of the literal is that near-misses fail: a
 * lowercase word, a padded one, or a missing field must not queue an account for erasure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isFailure, isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";

import { RequestAccountDeletionSchema } from "~/app/http/validators/account";

/** The form body as a browser posts it, so the schema is exercised through its real input. */
function body(fields: Record<string, string>) {
	let data = new FormData();
	for (let [name, value] of Object.entries(fields)) data.append(name, value);
	return data;
}

describe("RequestAccountDeletionSchema", () => {
	test("accepts the word typed exactly", async () => {
		let result = await validate(body({ confirmation: "DELETE" }), RequestAccountDeletionSchema);

		expect(isSuccess(result)).toBe(true);
	});

	test("rejects a lowercase, padded, or wrong word", async () => {
		for (let value of ["delete", " DELETE", "DELETE ", "DELETE ACCOUNT", ""]) {
			let result = await validate(body({ confirmation: value }), RequestAccountDeletionSchema);
			expect(isFailure(result)).toBe(true);
		}
	});

	test("rejects a body with no confirmation at all", async () => {
		let result = await validate(body({}), RequestAccountDeletionSchema);

		expect(isFailure(result)).toBe(true);
	});
});
