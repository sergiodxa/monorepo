/**
 * Tests the change notification as a value: it says what the URL is doing now, what it
 * was doing before, and when it changed — and it stays short, because the whole point
 * of this one is that the answer is above the fold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailPropsOutput } from "@sdxc/mail";

import { render } from "@sdxc/mail";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** Composes the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(
	overrides: Partial<EmailPropsOutput<typeof emails.trial.change>> = {},
	delivery: { to?: string; locale?: string } = {},
) {
	return unwrap(
		await mail.compose(emails.trial.change, {
			to: delivery.to ?? "visitor@example.com",
			locale: delivery.locale,
			props: {
				url: "https://example.com",
				status: "down",
				previousStatus: "up",
				responseStatus: 503,
				responseTimeMs: 4200,
				changedAt: Date.parse("2026-08-03T14:32:00.000Z"),
				unsubscribeToken: "tok-abc123",
				...overrides,
			},
		}),
	);
}

/**
 * ICU 72 (CLDR 42) joins a date to a time with " at "; older builds use ", ". The runner's
 * ICU differs between a developer machine and CI, so the separator is normalised here, since
 * these tests check the email's content and production always renders on the Workers runtime's own ICU.
 */
function instants(text: string): string {
	return text.replace(/(\d{1,2}, \d{4}), (\d{1,2}:\d{2})/g, "$1 at $2");
}

describe("trial.change email", () => {
	test("addresses the account-less watcher of the URL", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "visitor@example.com" });
	});

	test("puts the URL and its new state in the subject, and no timestamp", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("example.com is DOWN");
	});

	test("announces a recovery rather than an outage the other way round", async () => {
		let email = await makeEmail({ status: "up", previousStatus: "down" });

		expect(email.subject).toBe("example.com is UP");
	});

	test("reports what changed, what it was, and when", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("URL example.com (https://example.com)");
		expect(text).toContain("Status DOWN");
		expect(text).toContain("Previous status UP");
		expect(text).toContain("Response status 503");
		expect(text).toContain("Response time 4,200ms");
		expect(instants(text)).toContain("Changed at Aug 3, 2026 at 2:32 PM UTC");
	});

	test("reports an em dash for a URL that stopped answering entirely", async () => {
		let email = await makeEmail({ responseStatus: null, responseTimeMs: null });

		let { text } = await render(email.body());

		expect(text).toContain("Response status —");
		expect(text).toContain("Response time —");
	});

	test("stays short: no uptime bar and no call to action", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html).not.toContain("table-layout:fixed");
		expect(html).not.toContain("#107f04");
		expect(html.split("<a ").length - 1).toBe(2);
	});

	test("carries the unsubscribe as a link and as a one-click target", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain(
			"Stop these emails (https://uptime.sergiodxa.com/unsubscribe/tok-abc123)",
		);
		expect(email.unsubscribe).toEqual({
			url: "https://uptime.sergiodxa.com/unsubscribe/tok-abc123",
		});
		expect(email.list).toEqual({ id: "trial.uptime.sergiodxa.com" });
	});

	test("writes the copy in the language it was constructed for", async () => {
		let email = await makeEmail({}, { locale: "fr" });

		expect(email.subject).toBe("example.com est HORS LIGNE");
	});
});
