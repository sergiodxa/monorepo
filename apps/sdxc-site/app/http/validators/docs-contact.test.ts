/**
 * Tests the docs contact form's validation: a reply address and a message are required, the
 * name may be left out, and a page outside this site is dropped rather than refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import {
	DocsContactSchema,
	MAX_MESSAGE_LENGTH,
	sameSitePath,
} from "~/app/http/validators/docs-contact";

/** The form a browser posts with `fields` filled. */
function form(fields: Record<string, string>): FormData {
	let data = new FormData();
	for (let [name, value] of Object.entries(fields)) data.set(name, value);
	return data;
}

describe("DocsContactSchema", () => {
	test("accepts a complete submission, trimmed", async () => {
		let result = await validate(
			form({
				name: " Ada ",
				email: " ada@example.com ",
				message: "  How do I deploy?  ",
				page: "/docs/sdxc/deploy",
			}),
			DocsContactSchema,
		);

		expect(unwrap(result)).toEqual({
			name: "Ada",
			email: "ada@example.com",
			message: "How do I deploy?",
			page: "/docs/sdxc/deploy",
		});
	});

	test("takes a submission without a name or a page", async () => {
		let result = await validate(
			form({ email: "ada@example.com", message: "Hi" }),
			DocsContactSchema,
		);

		expect(unwrap(result)).toMatchObject({ name: "", page: "" });
	});

	test.each([
		["an invalid address", { email: "ada", message: "Hi" }],
		["a blank message", { email: "ada@example.com", message: "   " }],
		[
			"an oversized message",
			{ email: "ada@example.com", message: "a".repeat(MAX_MESSAGE_LENGTH + 1) },
		],
	])("refuses %s", async (_, fields) => {
		expect(isFailure(await validate(form(fields), DocsContactSchema))).toBe(true);
	});
});

describe("sameSitePath", () => {
	test("keeps a path on this site", () => {
		expect(sameSitePath("/docs/sdxc/deploy?x=1")).toBe("/docs/sdxc/deploy?x=1");
	});

	test.each(["https://evil.com/phish", "//evil.com/phish", "/\\evil.com", "docs", ""])(
		"drops %s",
		(page) => {
			expect(sameSitePath(page)).toBe("");
		},
	);
});
