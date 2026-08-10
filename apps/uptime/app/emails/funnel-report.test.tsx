/**
 * Tests the funnel report as a value: the headline it puts in the subject, the five counters
 * it tabulates, and what it says about each account that converted.
 *
 * The unsubscribe case is here rather than only in the job's suite because it is the one
 * thing this email must not inherit from the four beside it. Those go to strangers and carry
 * a one-click opt-out; this goes to an operator, and a report offering to delete its own
 * reporting is a bug that would look like consistency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Email } from "@pkg/mail";

import { render } from "@pkg/mail";

import { FunnelReportEmail } from "~/app/emails/funnel-report";

const NO_COUNTERS = {
	newLeads: 0,
	urlsChecked: 0,
	emailsSent: 0,
	freeSignups: 0,
	paidConversions: 0,
};

/** A paid conversion that took six days and eight emails. */
const PAID: FunnelReportEmail.Conversion = {
	urls: ["https://ada.example", "https://lovelace.example"],
	watchCount: 3,
	emailsSent: 8,
	leadCreatedAt: new Date("2026-07-26T09:00:00.000Z"),
	signedUpAt: new Date("2026-07-31T09:00:00.000Z"),
	paidAt: new Date("2026-08-01T09:00:00.000Z"),
	attribution: "outreach/agencies-august → /for/agencies",
};

/** A signup that has not paid. */
const FREE: FunnelReportEmail.Conversion = {
	urls: ["https://grace.example"],
	watchCount: 1,
	emailsSent: 2,
	leadCreatedAt: new Date("2026-07-30T09:00:00.000Z"),
	signedUpAt: new Date("2026-08-01T09:00:00.000Z"),
	paidAt: null,
	// The ordinary case for a session that never carried a campaign, printed as "unknown".
	attribution: null,
};

function makeEmail(overrides: Partial<FunnelReportEmail.Data> = {}) {
	return new FunnelReportEmail({
		to: "ops@example.com",
		date: "2026-08-01",
		counters: {
			...NO_COUNTERS,
			newLeads: 3,
			urlsChecked: 4,
			emailsSent: 11,
			freeSignups: 1,
			paidConversions: 1,
		},
		totals: { ...NO_COUNTERS, newLeads: 40, paidConversions: 5 },
		totalDays: 30,
		paid: [PAID],
		signups: [FREE],
		...overrides,
	});
}

/**
 * ICU 72 (CLDR 42) began joining a date to a time with " at "; older builds use ", ".
 * The runner's ICU differs between a developer machine and CI, so the separator is
 * normalised here rather than asserted. What these tests are about is the email's
 * content — the host's Unicode data is not the subject, and production renders on
 * the Workers runtime's own ICU regardless of what built it.
 */
function instants(text: string): string {
	return text.replace(/(\d{1,2}, \d{4}), (\d{1,2}:\d{2})/g, "$1 at $2");
}

describe("FunnelReportEmail", () => {
	test("goes to the one internal address it was given", () => {
		expect(makeEmail().to).toEqual({ email: "ops@example.com" });
	});

	test("carries the headline in the subject, so the common day needs no opening", () => {
		expect(makeEmail().subject).toBe("Uptime trial 2026-08-01 — 3 leads, 1 signup, 1 paid");
	});

	test("says one lead rather than 1 leads", () => {
		let email = makeEmail({ counters: { ...NO_COUNTERS, newLeads: 1 } });

		expect(email.subject).toBe("Uptime trial 2026-08-01 — 1 lead, 0 signups, 0 paid");
	});

	test("tabulates the day in funnel order", async () => {
		let { text } = await render(makeEmail().body());

		expect(text).toContain("New leads 3");
		expect(text).toContain("URLs checked 4");
		expect(text).toContain("Emails sent 11");
		expect(text).toContain("Free signups 1");
		expect(text).toContain("Paid conversions 1");
	});

	test("itemises a paid conversion with the days and the emails it took", async () => {
		let { text } = await render(makeEmail().body());

		expect(text).toContain("Paid conversions");
		expect(text).toContain("https://ada.example, https://lovelace.example");
		expect(text).toContain("Days to paying 6");
		expect(text).toContain("Emails received 8");
		expect(text).toContain("URLs tried 2 (3 tries)");
		expect(instants(text)).toContain("First payment Aug 1, 2026 at 9:00 AM UTC");
	});

	test("itemises a free signup more lightly, with no payment dates to give", async () => {
		let { text } = await render(makeEmail({ paid: [] }).body());

		expect(text).toContain("Free signups");
		expect(text).toContain("Days to signing up 2");
		expect(text).not.toContain("First payment");
	});

	test("closes with the trailing totals, saying how many days they cover", async () => {
		let { text } = await render(makeEmail().body());

		expect(text).toContain("Last 30 days");
		expect(text).toContain("New leads 40");
	});

	test("leaves out a section it has nothing to put in", async () => {
		let { text } = await render(makeEmail({ paid: [], signups: [] }).body());

		// The counter rows still name both, so the absence is the itemisation, not the words.
		expect(text).not.toContain("https://ada.example");
		expect(text).not.toContain("https://grace.example");
		expect(text).not.toContain("Days to");
	});

	/** Internal mail. The opt-out the other four carry would be nonsense here. */
	test("carries no unsubscribe header and no unsubscribe link", async () => {
		// Typed as the contract, because the class declares no `headers` member at all — which
		// is the assertion, and is why this cannot be read off the class type.
		let email: Email = makeEmail();
		let { html } = await render(email.body());

		expect(email.headers).toBeUndefined();
		expect(html).not.toContain("/unsubscribe/");
	});
});
