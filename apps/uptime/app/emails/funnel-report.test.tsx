/**
 * Tests the funnel report as a value: the headline in its subject, the five
 * counters it tabulates, what it says about each converted account, and why
 * the unsubscribe case lives here — reaching the operator who configured the
 * deployment, where an opt-out link would be circular.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Email, EmailPropsOutput } from "@sdxc/mail";

import { render } from "@sdxc/mail";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** The props the report is sent with. */
type Report = EmailPropsOutput<typeof emails.funnelReport>;

const NO_COUNTERS = {
	newLeads: 0,
	urlsChecked: 0,
	emailsSent: 0,
	freeSignups: 0,
	paidConversions: 0,
};

/** A paid conversion that took six days and eight emails. */
const PAID = {
	urls: ["https://ada.example", "https://lovelace.example"],
	watchCount: 3,
	emailsSent: 8,
	leadCreatedAt: Date.parse("2026-07-26T09:00:00.000Z"),
	signedUpAt: Date.parse("2026-07-31T09:00:00.000Z"),
	paidAt: Date.parse("2026-08-01T09:00:00.000Z"),
	attribution: "outreach/agencies-august → /for/agencies",
};

/**
 * A signup that has not paid, whose blank attribution is the ordinary case
 * for a session that never carried a campaign, printed as "unknown".
 */
const FREE = {
	urls: ["https://grace.example"],
	watchCount: 1,
	emailsSent: 2,
	leadCreatedAt: Date.parse("2026-07-30T09:00:00.000Z"),
	signedUpAt: Date.parse("2026-08-01T09:00:00.000Z"),
	paidAt: null,
	attribution: null,
};

/** Composes the report through the registry, as the job that sends it does. */
async function makeEmail(overrides: Partial<Report> = {}) {
	let props = {
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
	};
	return unwrap(await mail.compose(emails.funnelReport, { to: "ops@example.com", props }));
}

/**
 * ICU 72 (CLDR 42) joins a date to a time with " at "; older builds use ", ".
 * Normalising the separator here keeps the test about the email's content,
 * since the runner's ICU version varies between a developer machine and CI.
 */
function instants(text: string): string {
	return text.replace(/(\d{1,2}, \d{4}), (\d{1,2}:\d{2})/g, "$1 at $2");
}

describe("funnelReport email", () => {
	test("goes to the one internal address it was given", async () => {
		expect((await makeEmail()).to).toEqual({ email: "ops@example.com" });
	});

	test("carries the headline in the subject, so the common day needs no opening", async () => {
		expect((await makeEmail()).subject).toBe("Uptime trial 2026-08-01 — 3 leads, 1 signup, 1 paid");
	});

	test("says one lead rather than 1 leads", async () => {
		let email = await makeEmail({ counters: { ...NO_COUNTERS, newLeads: 1 } });

		expect(email.subject).toBe("Uptime trial 2026-08-01 — 1 lead, 0 signups, 0 paid");
	});

	test("tabulates the day in funnel order", async () => {
		let { text } = await render((await makeEmail()).body());

		expect(text).toContain("New leads 3");
		expect(text).toContain("URLs checked 4");
		expect(text).toContain("Emails sent 11");
		expect(text).toContain("Free signups 1");
		expect(text).toContain("Paid conversions 1");
	});

	test("itemises a paid conversion with the days and the emails it took", async () => {
		let { text } = await render((await makeEmail()).body());

		expect(text).toContain("Paid conversions");
		expect(text).toContain("https://ada.example, https://lovelace.example");
		expect(text).toContain("Days to paying 6");
		expect(text).toContain("Emails received 8");
		expect(text).toContain("URLs tried 2 (3 tries)");
		expect(instants(text)).toContain("First payment Aug 1, 2026 at 9:00 AM UTC");
	});

	test("itemises a free signup more lightly, with no payment dates to give", async () => {
		let { text } = await render((await makeEmail({ paid: [] })).body());

		expect(text).toContain("Free signups");
		expect(text).toContain("Days to signing up 2");
		expect(text).not.toContain("First payment");
	});

	test("closes with the trailing totals, saying how many days they cover", async () => {
		let { text } = await render((await makeEmail()).body());

		expect(text).toContain("Last 30 days");
		expect(text).toContain("New leads 40");
	});

	test("leaves out a section it has nothing to put in", async () => {
		let { text } = await render((await makeEmail({ paid: [], signups: [] })).body());

		expect(text).not.toContain("https://ada.example");
		expect(text).not.toContain("https://grace.example");
		expect(text).not.toContain("Days to");
	});

	/**
	 * Internal mail: the opt-out the other four carry would be nonsense here, so the template
	 * declares no headers and reading them as `undefined` is the assertion the test makes.
	 */
	test("carries no unsubscribe header and no unsubscribe link", async () => {
		let email: Email = await makeEmail();
		let { html } = await render(email.body());

		expect(email.headers).toBeUndefined();
		expect(html).not.toContain("/unsubscribe/");
	});
});
