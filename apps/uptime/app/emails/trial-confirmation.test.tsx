/**
 * Tests the confirmation as a value: it answers the address it was given, takes every
 * word from the locale files, repeats back the probe it was constructed with, and
 * ships a way to stop the mail in the message that starts it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import { emailTranslator } from "~/app/emails/locale";
import { TrialConfirmationEmail } from "~/app/emails/trial-confirmation";

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TrialConfirmationEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TrialConfirmationEmail({
		to: "visitor@example.com",
		url: "https://example.com",
		status: "up",
		responseStatus: 200,
		responseTimeMs: 143,
		checkedAt: new Date("2026-08-01T10:00:00.000Z"),
		watchUntil: new Date("2026-08-08T10:00:00.000Z"),
		unsubscribeToken: "tok-abc123",
		locale,
		t,
		...overrides,
	});
}

describe("TrialConfirmationEmail", () => {
	test("answers the address the visitor handed over", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "visitor@example.com" });
	});

	test("takes its subject from the locale files, naming the URL", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("We are now checking https://example.com every hour");
	});

	test("states what happens next and until when", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("every hour until 2026-08-08T10:00:00.000Z");
		expect(text).toContain("summary once a day");
	});

	test("repeats back the probe that just ran", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("URL: https://example.com");
		expect(text).toContain("Status: UP");
		expect(text).toContain("Response status: 200");
		expect(text).toContain("Response time: 143ms");
		expect(text).toContain("Checked at: 2026-08-01T10:00:00.000Z");
	});

	test("reports an em dash for a URL that never answered", async () => {
		let email = await makeEmail({ status: "down", responseStatus: null, responseTimeMs: null });

		let { text } = await render(email.body());

		expect(text).toContain("Status: DOWN");
		expect(text).toContain("Response status: —");
		expect(text).toContain("Response time: —");
	});

	test("does not read as marketing: the unsubscribe is the only link in it", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html.split("<a ").length - 1).toBe(1);
		expect(html).toContain("https://uptime.sergiodxa.com/unsubscribe/tok-abc123");
	});

	test("carries the unsubscribe as a link and as one-click headers", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain(
			"Stop these emails (https://uptime.sergiodxa.com/unsubscribe/tok-abc123)",
		);
		expect(text).toContain("ends every URL you asked us to watch");
		expect(email.headers).toEqual({
			"List-Unsubscribe": "<https://uptime.sergiodxa.com/unsubscribe/tok-abc123>",
			"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
		});
	});

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("ja");
		let email = await makeEmail({ locale, t });

		expect(email.subject).not.toBe("We are now checking https://example.com every hour");
		expect(email.subject).toContain("https://example.com");
	});
});
