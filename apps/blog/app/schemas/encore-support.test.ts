/**
 * Tests the Encore support form's address rule: an address a reply can be sent to passes in
 * the form mail headers carry, and one that is no mailbox address, or that would fold onto
 * another host, is refused with the field's message before any mail is built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseSafe } from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { SupportRequestSchema } from "./encore-support";

/** A valid submission with `email` replaced, as the form posts it. */
function submission(email: string): FormData {
	let form = new FormData();
	form.set("email", email);
	form.set("topic", "Question");
	form.set("platform", "iPhone");
	form.set("message", "How do I export my data?");
	return form;
}

/** The messages the email field reports for `email`, empty when it passes. */
function emailIssues(email: string): string[] {
	let result = parseSafe(SupportRequestSchema, submission(email));
	if (result.success) return [];
	return result.issues
		.filter((issue) =>
			issue.path?.some(
				(segment) =>
					segment === "email" || (typeof segment === "object" && segment.key === "email"),
			),
		)
		.map((issue) => issue.message);
}

describe("SupportRequestSchema email", () => {
	test("accepts a tagged address on a multi-label domain", () => {
		let result = parseSafe(
			SupportRequestSchema,
			submission("  Ada.Lovelace+encore@example.co.uk "),
		);

		expect(result.success).toBe(true);
		if (result.success) expect(result.value.email).toBe("Ada.Lovelace+encore@example.co.uk");
	});

	test("replies to an internationalized domain in its ASCII form", () => {
		let result = parseSafe(SupportRequestSchema, submission("jane@bücher.example"));

		expect(result.success).toBe(true);
		if (result.success) expect(result.value.email).toBe("jane@xn--bcher-kva.example");
	});

	test.each([
		["an IP literal", "ada@127.0.0.1"],
		["a trailing root dot", "ada@example.com."],
		["a zero-width character in the local part", "ada​@example.com"],
		["a control character in the local part", "ada\u0001@example.com"],
		["consecutive dots in the local part", "ada..lovelace@example.com"],
		["an underscore in the domain", "ada@exa_mple.com"],
	])("refuses %s, which the loose pattern let through", (_, email) => {
		expect(emailIssues(email)).toEqual(["Enter a valid email address, like name@example.com."]);
	});

	test("refuses an address with no domain", () => {
		expect(emailIssues("not-an-email")).toEqual([
			"Enter a valid email address, like name@example.com.",
		]);
	});

	test("asks for an address when the field is blank, reporting nothing else", () => {
		expect(emailIssues("   ")).toEqual(["Enter your email address so we can reply."]);
	});
});
