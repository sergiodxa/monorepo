/**
 * Tests the weekly wrap-up as a value: it covers one URL's seven days a day per
 * segment, says the free checks end here, and carries exactly one call to action —
 * the only one this family of emails is allowed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { emailTranslator } from "~/app/emails/locale";
import { TrialWeeklyDigestEmail } from "~/app/emails/trial-weekly-digest";

/** Fill of a passing day; `--ui-color-success-600`. */
let UP = "#107f04";

/** Fill of a failing day; `--ui-color-danger-600`. */
let DOWN = "#ba2b2e";

/** A clean week, one segment per day. */
function goodWeek(): UptimeBar.Status[] {
	return Array.from({ length: 7 }, () => "up" as const);
}

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TrialWeeklyDigestEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TrialWeeklyDigestEmail({
		to: "visitor@example.com",
		url: "https://example.com",
		segments: goodWeek(),
		stats: { checks: 168, uptime: "99.4", slowestResponseMs: 2100 },
		subscribeUrl: "https://uptime.test/signup?target=https%3A%2F%2Fexample.com",
		unsubscribeToken: "tok-abc123",
		locale,
		t,
		...overrides,
	});
}

describe("TrialWeeklyDigestEmail", () => {
	test("addresses the watcher of the URL whose week ended", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "visitor@example.com" });
	});

	test("reads as a report in the subject, not as an offer", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("Seven-day report: example.com");
	});

	test("reports the whole week's numbers", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("example.com over the last seven days");
		expect(text).toContain("Checks run 168");
		expect(text).toContain("Uptime 99.4%");
		expect(text).toContain("Slowest response 2100ms");
		expect(text).toContain("7 days ago");
		expect(text).toContain("Today");
	});

	test("plots one segment per day, not per hour", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html.split(UP).length - 1).toBe(8);
	});

	test("colours a bad day from the same palette the web bar uses", async () => {
		let email = await makeEmail({ segments: ["up", "up", "down", "up", "up", "up", "up"] });

		let { html } = await render(email.body());

		expect(html.split(UP).length - 1).toBe(7);
		expect(html.split(DOWN).length - 1).toBe(2);
	});

	test("reports an em dash for a week where nothing ever answered", async () => {
		let email = await makeEmail({
			segments: Array.from({ length: 7 }, () => null),
			stats: { checks: 0, uptime: null, slowestResponseMs: null },
		});

		let { text } = await render(email.body());

		expect(text).toContain("Uptime —");
		expect(text).toContain("Slowest response —");
	});

	test("states that the free checks stop here", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("the free checks on example.com stop here");
	});

	test("offers the subscribe link with no persuasion copy around it", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain(
			"Keep checking this URL (https://uptime.test/signup?target=https%3A%2F%2Fexample.com)",
		);
	});

	test("carries exactly two links: the offer and the way out", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html.split("<a ").length - 1).toBe(2);
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

	test("links the report's own page when the sender supplies the watch's token", async () => {
		let email = await makeEmail({ reportToken: "report-tok-123" });

		let { text, html } = await render(email.body());

		expect(text).toContain("https://uptime.sergiodxa.com/try/report/report-tok-123");
		// In the footer, so the subscribe button is still the only call to action; three links
		// now, the third being the way out.
		expect(html.split("<a ").length - 1).toBe(3);
	});

	test("never puts the unsubscribe token in the report link", async () => {
		let email = await makeEmail({ reportToken: "report-tok-123" });

		let { text } = await render(email.body());

		expect(text).not.toContain("/try/report/tok-abc123");
	});

	test("sends without the link rather than a broken one when no token is given", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).not.toContain("/try/report/");
	});

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("it");
		let email = await makeEmail({ locale, t });

		expect(email.subject).toBe("Rapporto di sette giorni: example.com");
	});
});
