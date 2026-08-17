/**
 * Tests the report a repeat submission earns as a value: it reports the watch that already
 * covers the URL, says plainly that no second free week was started, and carries the same
 * one call to action and the same one-click unsubscribe every other trial email does.
 *
 * The copy assertions are the point of the class existing at all — see its docblock. Each of
 * the four sentences here is one the wrap-up would have got wrong for a reader whose week is
 * still running or ended three weeks ago.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { render } from "@pkg/mail";

import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { emailTranslator } from "~/app/emails/locale";
import { TrialRepeatReportEmail } from "~/app/emails/trial-repeat-report";

/** Fill of a passing day; `--ui-color-success-600`. */
let UP = "#107f04";

/** A week with three days behind it and four not yet reached. */
function partialWeek(): UptimeBar.Status[] {
	return ["up", "up", "up", null, null, null, null];
}

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TrialRepeatReportEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TrialRepeatReportEmail({
		to: "visitor@example.com",
		url: "https://example.com",
		watchingSince: new Date(Date.UTC(2026, 6, 30, 9, 15)),
		segments: partialWeek(),
		stats: { checks: 72, uptime: "98.6", slowestResponseMs: 1400 },
		subscribeUrl: "https://uptime.test/app",
		unsubscribeToken: "tok-abc123",
		locale,
		t,
		...overrides,
	});
}

describe("TrialRepeatReportEmail", () => {
	/**
	 * The message this link matters most on. A repeat submission is somebody asking a second
	 * time about a URL we already hold real measurements for, so the durable copy of those
	 * measurements is what they were reaching for — and unlike the wrap-up, this can arrive on
	 * day two of a week still running, when the page has more to say later than the email does.
	 */
	test("links the report's own page when the sender supplies the watch's token", async () => {
		let email = await makeEmail({ reportToken: "report-tok-123" });

		let { text } = await render(email.body());

		expect(text).toContain("https://uptime.sergiodxa.com/try/report/report-tok-123");
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

	test("addresses the spelling the submission came from", async () => {
		let email = await makeEmail({ to: "hello+news@sergiodxa.com" });

		expect(email.to).toEqual({ email: "hello+news@sergiodxa.com" });
	});

	test("reads as a report in the subject, not as a rejection notice", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("What we have found on example.com so far");
	});

	test("names when the watch that already covers the URL was opened", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("You asked us to watch example.com on");
		expect(text).toContain("UTC");
		expect(text).not.toContain("2026-07-30T09:15");
	});

	test("reports what the existing watch has found", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("Checks run 72");
		expect(text).toContain("Uptime 98.6%");
		expect(text).toContain("Slowest response 1400ms");
		expect(text).toContain("Day 1");
		expect(text).toContain("Day 7");
	});

	/** Days the watch has not reached draw as no data, which is honest for a running week. */
	test("plots only the days that have happened", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html.split(UP).length - 1).toBe(4);
	});

	/**
	 * The sentence the wrap-up cannot say. It states the rule rather than claiming either that
	 * checking continues or that it has stopped, both of which are false for some readers.
	 */
	test("says the request did not start a second free week", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("one free week every 30 days");
		expect(text).toContain("did not start a second one");
		expect(text).not.toContain("stop here");
		expect(text).not.toContain("This is the last one");
	});

	test("offers the subscribe link with no persuasion copy around it", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("Keep checking this URL (https://uptime.test/app)");
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

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("de");
		let email = await makeEmail({ locale, t });

		expect(email.subject).toBe("Was wir bisher zu example.com gefunden haben");
	});
});
