/**
 * Tests the change notification as a value: it says what the URL is doing now, what it
 * was doing before, and when it changed — and it stays short, because the whole point
 * of this one is that the answer is above the fold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import { emailTranslator } from "~/app/emails/locale";
import { TrialChangeEmail } from "~/app/emails/trial-change";

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TrialChangeEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TrialChangeEmail({
		to: "visitor@example.com",
		url: "https://example.com",
		status: "down",
		previousStatus: "up",
		responseStatus: 503,
		responseTimeMs: 4200,
		changedAt: new Date("2026-08-03T14:32:00.000Z"),
		unsubscribeToken: "tok-abc123",
		locale,
		t,
		...overrides,
	});
}

describe("TrialChangeEmail", () => {
	test("addresses the account-less watcher of the URL", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "visitor@example.com" });
	});

	test("puts the URL and its new state in the subject, and no timestamp", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("https://example.com is DOWN");
	});

	test("announces a recovery rather than an outage the other way round", async () => {
		let email = await makeEmail({ status: "up", previousStatus: "down" });

		expect(email.subject).toBe("https://example.com is UP");
	});

	test("reports what changed, what it was, and when", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("URL: https://example.com");
		expect(text).toContain("Status: DOWN");
		expect(text).toContain("Previous status: UP");
		expect(text).toContain("Response status: 503");
		expect(text).toContain("Response time: 4200ms");
		expect(text).toContain("Changed at: 2026-08-03T14:32:00.000Z");
	});

	test("reports an em dash for a URL that stopped answering entirely", async () => {
		let email = await makeEmail({ responseStatus: null, responseTimeMs: null });

		let { text } = await render(email.body());

		expect(text).toContain("Response status: —");
		expect(text).toContain("Response time: —");
	});

	test("stays short: no uptime bar and no call to action", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html).not.toContain("table-layout:fixed");
		expect(html).not.toContain("#107f04");
		expect(html.split("<a ").length - 1).toBe(1);
	});

	test("carries the unsubscribe as a link and as one-click headers", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain(
			"Stop these emails (https://uptime.sergiodxa.com/unsubscribe/tok-abc123)",
		);
		expect(email.headers).toEqual({
			"List-Unsubscribe": "<https://uptime.sergiodxa.com/unsubscribe/tok-abc123>",
			"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
		});
	});

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("fr");
		let email = await makeEmail({ locale, t });

		expect(email.subject).toBe("https://example.com est HORS LIGNE");
	});
});
