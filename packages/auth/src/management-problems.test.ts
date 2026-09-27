/**
 * Checks the management problem catalog describes itself: the `validationFailed`
 * extension validates `errors` and writes the JSON Schema a documenting tool reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { managementProblems } from "./management-problems.js";

/** The catalog entry named `validationFailed`. */
function validationFailed() {
	let entry = managementProblems.entries().find((each) => each.name === "validationFailed");
	if (entry?.extensions === undefined) throw new Error("validationFailed declares extensions");
	return entry.extensions as unknown as {
		"~standard": {
			validate(value: unknown): unknown;
			jsonSchema: { input(options: { target: string }): Record<string, unknown> };
		};
	};
}

describe("managementProblems", () => {
	test("describes validationFailed's errors member as JSON Schema", () => {
		let schema = validationFailed()["~standard"].jsonSchema.input({ target: "draft-2020-12" });

		expect(schema).toMatchObject({
			type: "object",
			properties: {
				errors: {
					type: "array",
					items: { type: "object", required: ["pointer", "code", "message"] },
				},
			},
		});
	});

	test("still validates validationFailed's errors member", () => {
		let valid = validationFailed()["~standard"].validate({
			errors: [{ pointer: "/name", code: "invalid", message: "Required" }],
		});
		let invalid = validationFailed()["~standard"].validate({ errors: [{ pointer: 1 }] });

		expect(valid).toMatchObject({ value: { errors: [{ pointer: "/name" }] } });
		expect(invalid).toMatchObject({ issues: expect.any(Array) });
	});
});
