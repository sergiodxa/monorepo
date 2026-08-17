/**
 * Tests the daily team digest as a value. Two things carry the email: a subject that names the
 * team and how much of it was fine, because a member of three teams decides from the inbox which
 * one this is about, and a monitor list ordered so whatever might need somebody this morning is
 * the first row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { render } from "@pkg/mail";

import type { TeamDigestMonitor } from "~/app/emails/shared/team-digest";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { emailTranslator } from "~/app/emails/locale";
import { TeamDailyDigestEmail } from "~/app/emails/team-daily-digest";

/** Where the digest sends a reader who wants the detail it leaves out. */
let DASHBOARD_URL = "https://uptime.test/acme";

/** The reader's own email settings, anchored at the switches. */
let PREFERENCES_URL = "https://uptime.test/acme/account#emails";

/** One monitor's day, clean and HTTP unless the test says otherwise. */
function monitor(
	name: string,
	status: UptimeBar.Status = "up",
	overrides: Partial<TeamDigestMonitor> = {},
): TeamDigestMonitor {
	return { id: name.toLowerCase(), name, type: "http", status, uptime: "100", ...overrides };
}

/** A team whose day went four different ways, which is what the list has to sort. */
function mixedTeam(): TeamDigestMonitor[] {
	return [
		monitor("Website"),
		monitor("API", "down", { uptime: "42.5" }),
		monitor("Backup", null, { type: "cron", uptime: null }),
		monitor("Cache", "degraded", { type: "tcp", uptime: "97" }),
	];
}

/** The listed names in the order the email renders them, by where each one lands. */
function order(text: string, names: string[]): string[] {
	return [...names].sort((left, right) => text.indexOf(left) - text.indexOf(right));
}

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TeamDailyDigestEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TeamDailyDigestEmail({
		to: "member@example.com",
		teamName: "Acme",
		date: "2026-08-02",
		monitors: mixedTeam(),
		dashboardUrl: DASHBOARD_URL,
		preferencesUrl: PREFERENCES_URL,
		locale,
		t,
		...overrides,
	});
}

describe("TeamDailyDigestEmail", () => {
	test("goes to the one member this copy is for, not to the team", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "member@example.com" });
	});

	describe("subject", () => {
		test("names the team and says nothing needs a look when every monitor was up", async () => {
			let email = await makeEmail({
				monitors: [monitor("Website"), monitor("API"), monitor("Cache")],
			});

			expect(email.subject).toBe("Acme: all 3 monitors up yesterday");
		});

		test("names the team and counts the healthy ones when one was not", async () => {
			let email = await makeEmail();

			expect(email.subject).toBe("Acme: 1 of 4 monitors up yesterday");
		});

		/**
		 * One monitor is the state every team starts in, so the singular is the wording most of
		 * this mail is read in — and "all 1 monitors" is what a counted sentence with no plural
		 * rule behind it says.
		 */
		test("speaks of the one monitor in the singular, either way it went", async () => {
			let clean = await makeEmail({ monitors: [monitor("Website")] });
			let broken = await makeEmail({ monitors: [monitor("Website", "down", { uptime: "0" })] });

			expect(clean.subject).toBe("Acme: the monitor was up yesterday");
			expect(broken.subject).toBe("Acme: the monitor needs a look");
		});
	});

	test("offers a way out through the settings page, deliberately not one-click", async () => {
		let email = await makeEmail();

		expect(email.headers).toEqual({ "List-Unsubscribe": `<${PREFERENCES_URL}>` });
	});

	describe("body", () => {
		test("names the day the numbers were measured over", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain("1 of 4 monitors were up on Aug 2, 2026.");
		});

		test("says it in the singular for a team with one monitor", async () => {
			let email = await makeEmail({ monitors: [monitor("Website")] });

			let { text } = await render(email.body());

			expect(text).toContain("The team's monitor was up on Aug 2, 2026.");
		});

		test("lists every monitor of the team", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			for (let name of ["Website", "API", "Backup", "Cache"]) expect(text).toContain(name);
		});

		test("puts the worst news first: down, degraded, unchecked, then up", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(order(text, ["Website", "API", "Backup", "Cache"])).toEqual([
				"API",
				"Cache",
				"Backup",
				"Website",
			]);
		});

		test("says a monitor nothing checked is unchecked rather than giving it a number", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain("Backup Cron job Not checked —");
		});

		test("sends a reader who wants the detail to the team's dashboard", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain(`Open the dashboard (${DASHBOARD_URL})`);
		});

		test("ships the dark counterpart of the colours it paints the statuses in", async () => {
			let email = await makeEmail();

			let { html } = await render(email.body());

			expect(html).toContain(".uptime-ink-down{color:#f87171 !important;}");
			expect(html).toContain('class="uptime-ink-down mail-rule"');
			// An unchecked row is muted copy, which the kit's own dark rules already cover.
			expect(html).toContain('class="mail-muted mail-rule"');
		});

		test("names the team in the footer and links to the switches that stop the email", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain(
				`You received this email because you are a member of Acme on Uptime. Choose which emails you get (${PREFERENCES_URL})`,
			);
		});
	});
});
