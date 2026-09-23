/**
 * Tests for validation failures as problems: JSON Pointer escaping, converting
 * Standard Schema issues, the 422 response, and the schema that reads it back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { ISSUES_SCHEMA, issuesFrom, toPointer, validationProblem } from "./issues.js";
import { parseProblem } from "./parse.js";

describe("toPointer", () => {
	test("escapes ~ and / per RFC 6901", () => {
		expect(toPointer(["a/b", "m~n", 0])).toBe("/a~1b/m~0n/0");
	});

	test("reads path segment objects by their key", () => {
		expect(toPointer([{ key: "users" }, { key: 2 }])).toBe("/users/2");
	});

	test("an empty or absent path points at the whole document", () => {
		expect(toPointer([])).toBe("");
		expect(toPointer(undefined)).toBe("");
	});
});

describe("issuesFrom", () => {
	test("converts data-schema issues into errors entries", () => {
		let result = s.parseSafe(s.object({ user: s.object({ email: s.string() }) }), {
			user: { email: 1 },
		});
		if (result.success) throw new Error("expected the input to fail validation");

		expect(issuesFrom(result.issues)).toEqual([
			{ pointer: "/user/email", code: "invalid", message: expect.any(String) },
		]);
	});

	test("reads the issues off an error carrying them, with a custom code", () => {
		let error = Object.assign(new Error("invalid"), { issues: [{ message: "Required" }] });

		expect(issuesFrom(error, "required")).toEqual([
			{ pointer: "", code: "required", message: "Required" },
		]);
	});
});

describe("validationProblem", () => {
	test("answers 422 with the issues, which ISSUES_SCHEMA reads back", async () => {
		let issues = [{ pointer: "/email", code: "invalid", message: "Not an email" }];

		let response = validationProblem(issues, { detail: "Check the form." });
		let result = await parseProblem(response, {
			extensions: s.object({ errors: ISSUES_SCHEMA }),
		});

		expect(response.status).toBe(422);
		expect(isSuccess(result) && result.data.title).toBe("Unprocessable Content");
		expect(isSuccess(result) && result.data.extensions.errors).toEqual(issues);
	});
});

describe("ISSUES_SCHEMA", () => {
	test("rejects an entry missing a member, naming its index", () => {
		let result = ISSUES_SCHEMA["~standard"].validate([
			{ pointer: "", code: "x", message: "ok" },
			{ pointer: "" },
		]);

		expect(result.issues?.[0]?.path?.[0]).toBe(1);
	});
});
