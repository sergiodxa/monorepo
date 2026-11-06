/**
 * Tests the Wakaba support form's rules: the devices Wakaba ships on pass and others are
 * refused, a reply address is required and normalised, and a message too short to act on
 * is refused with the field's message before any mail is built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseSafe } from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { WakabaSupportRequestSchema } from "~/app/http/validators/wakaba-support";

/** A valid submission with any field replaced, as the form posts it. */
function submission(fields: Record<string, string> = {}): FormData {
	let form = new FormData();
	let values = {
		email: "ada@example.com",
		topic: "Vocabulary correction",
		platform: "iPad",
		message: "The reading for 今日 should be きょう.",
		...fields,
	};
	for (let [key, value] of Object.entries(values)) form.set(key, value);
	return form;
}

/** The messages `field` reports for the submission, empty when it passes. */
function issuesFor(form: FormData, field: string): string[] {
	let result = parseSafe(WakabaSupportRequestSchema, form);
	if (result.success) return [];
	return result.issues
		.filter((issue) =>
			issue.path?.some(
				(segment) => segment === field || (typeof segment === "object" && segment.key === field),
			),
		)
		.map((issue) => issue.message);
}

describe("WakabaSupportRequestSchema", () => {
	test("accepts a request from an iPhone or an iPad", () => {
		for (let platform of ["iPhone", "iPad", "Other"]) {
			expect(issuesFor(submission({ platform }), "platform")).toEqual([]);
		}
	});

	test("refuses devices Wakaba does not list", () => {
		for (let platform of ["Mac", "Apple Watch", ""]) {
			expect(issuesFor(submission({ platform }), "platform")).toEqual([
				"Choose the device you're using.",
			]);
		}
	});

	test("normalises the reply address and trims the message", () => {
		let result = parseSafe(
			WakabaSupportRequestSchema,
			submission({ email: "  ada@example.com ", message: "  The word of the day repeats.  " }),
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.email).toBe("ada@example.com");
			expect(result.value.message).toBe("The word of the day repeats.");
			expect(result.value.name).toBe("");
		}
	});

	test("requires an email and a message long enough to act on", () => {
		expect(issuesFor(submission({ email: "" }), "email")).toEqual([
			"Enter your email address so I can reply.",
		]);
		expect(issuesFor(submission({ message: "Help" }), "message")).toEqual([
			"Your message must be at least 10 characters.",
		]);
	});
});
