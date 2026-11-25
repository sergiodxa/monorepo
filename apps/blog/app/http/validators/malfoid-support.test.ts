/**
 * Tests the Malfoid Stickers support form's rules: the devices the pack runs on pass and others
 * are refused, a reply address is required and normalised, and a message too short to act on
 * is refused with the field's message before any mail is built.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseSafe } from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	MalfoidSupportRequestSchema,
	malfoidSupportSchema,
} from "~/app/http/validators/malfoid-support";

/** A valid submission with any field replaced, as the form posts it. */
function submission(fields: Record<string, string> = {}): FormData {
	let form = new FormData();
	let values = {
		email: "ada@example.com",
		topic: "Stickers not showing",
		platform: "iPhone",
		message: "The stickers don't appear in the iMessage drawer.",
		...fields,
	};
	for (let [key, value] of Object.entries(values)) form.set(key, value);
	return form;
}

/** The messages `field` reports for the submission, empty when it passes. */
function issuesFor(form: FormData, field: string): string[] {
	let result = parseSafe(MalfoidSupportRequestSchema, form);
	if (result.success) return [];
	return result.issues
		.filter((issue) =>
			issue.path?.some(
				(segment) => segment === field || (typeof segment === "object" && segment.key === field),
			),
		)
		.map((issue) => issue.message);
}

describe("MalfoidSupportRequestSchema", () => {
	test("accepts a request from an iPhone or an iPad", () => {
		for (let platform of ["iPhone", "iPad", "Other"]) {
			expect(issuesFor(submission({ platform }), "platform")).toEqual([]);
		}
	});

	test("refuses devices the pack does not list", () => {
		for (let platform of ["Mac", "Apple Watch", ""]) {
			expect(issuesFor(submission({ platform }), "platform")).toEqual([
				"Choose the device you're using.",
			]);
		}
	});

	test("accepts every topic the form lists and refuses others", () => {
		for (let topic of ["Stickers not showing", "Bug report", "Question", "Sticker idea", "Other"]) {
			expect(issuesFor(submission({ topic }), "topic")).toEqual([]);
		}
		expect(issuesFor(submission({ topic: "Refund" }), "topic")).toEqual(["Choose a topic."]);
	});

	test("normalises the reply address and trims the message", () => {
		let result = parseSafe(
			MalfoidSupportRequestSchema,
			submission({ email: "  ada@example.com ", message: "  The pack shows only 59 stickers.  " }),
		);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.value.email).toBe("ada@example.com");
			expect(result.value.message).toBe("The pack shows only 59 stickers.");
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

	test("keeps one-line fields on one line", () => {
		expect(issuesFor(submission({ name: "Ada\nLovelace" }), "name")).toEqual([
			"This field must fit on one line.",
		]);
	});

	test("reports field messages in Spanish for a Spanish page", () => {
		let result = parseSafe(
			malfoidSupportSchema("es-AR"),
			submission({ email: "", message: "Hola" }),
		);

		expect(result.success).toBe(false);
		if (!result.success) {
			let messages = result.issues.map((issue) => issue.message);
			expect(messages).toContain("Escribe tu correo electrónico para que pueda responderte.");
			expect(messages).toContain("Tu mensaje debe tener al menos 10 caracteres.");
		}
	});
});
