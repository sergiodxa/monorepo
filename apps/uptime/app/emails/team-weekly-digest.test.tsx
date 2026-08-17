/**
 * Tests the weekly team digest as a value. It carries the same subject and the same monitor list
 * as the daily one, plus the thing no single day can show: the team's week as seven segments, each
 * the worst status any monitor reported that day, captioned with the two ends of the window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { render } from "@pkg/mail";

import type { TeamDigestMonitor } from "~/app/emails/shared/team-digest";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { emailTranslator } from "~/app/emails/locale";
import { TeamWeeklyDigestEmail } from "~/app/emails/team-weekly-digest";

/** Fill of a day every check passed; `--ui-color-success-600`. */
let UP = "#107f04";

/** Fill of a day that answered but not well; `--ui-color-warning-600`. */
let DEGRADED = "#925d00";

/** Fill of a day something failed; `--ui-color-danger-600`. */
let DOWN = "#ba2b2e";

/** Where the digest sends a reader who wants the detail it leaves out. */
let DASHBOARD_URL = "https://uptime.test/acme";

/** The reader's own email settings, anchored at the switches. */
let PREFERENCES_URL = "https://uptime.test/acme/account#emails";

/**
 * How many of the bar's own segments carry `fill`, or how many there are in total.
 *
 * Matched on the segment cell's height rather than on the colour alone, because the monitor
 * list paints its status column from the same palette and would otherwise count as days.
 */
function days(html: string, fill = ""): number {
	return html.split(`height:32px;background-color:${fill}`).length - 1;
}

/** One monitor's week, clean and HTTP unless the test says otherwise. */
function monitor(
	name: string,
	status: UptimeBar.Status = "up",
	overrides: Partial<TeamDigestMonitor> = {},
): TeamDigestMonitor {
	return { id: name.toLowerCase(), name, type: "http", status, uptime: "100", ...overrides };
}

/** A team whose week went four different ways, which is what the list has to sort. */
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
async function makeEmail(overrides: Partial<TeamWeeklyDigestEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TeamWeeklyDigestEmail({
		to: "member@example.com",
		teamName: "Acme",
		since: "2026-07-27",
		until: "2026-08-02",
		segments: ["up", "up", "down", "up", "degraded", "up", "up"],
		uptime: "98.2",
		monitors: mixedTeam(),
		dashboardUrl: DASHBOARD_URL,
		preferencesUrl: PREFERENCES_URL,
		locale,
		t,
		...overrides,
	});
}

describe("TeamWeeklyDigestEmail", () => {
	test("goes to the one member this copy is for, not to the team", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "member@example.com" });
	});

	describe("subject", () => {
		test("names the team and says nothing needs a look when every monitor was up", async () => {
			let email = await makeEmail({
				monitors: [monitor("Website"), monitor("API"), monitor("Cache")],
			});

			expect(email.subject).toBe("Acme: all 3 monitors up all week");
		});

		test("names the team and counts the healthy ones when one was not", async () => {
			let email = await makeEmail();

			expect(email.subject).toBe("Acme: 1 of 4 monitors up all week");
		});

		/** See the daily digest's own singular case: one monitor is where every team starts. */
		test("speaks of the one monitor in the singular, either way its week went", async () => {
			let clean = await makeEmail({ monitors: [monitor("Website")] });
			let broken = await makeEmail({ monitors: [monitor("Website", "down", { uptime: "0" })] });

			expect(clean.subject).toBe("Acme: the monitor was up all week");
			expect(broken.subject).toBe("Acme: the monitor had a bad day this week");
		});
	});

	test("offers a way out through the settings page, deliberately not one-click", async () => {
		let email = await makeEmail();

		expect(email.headers).toEqual({ "List-Unsubscribe": `<${PREFERENCES_URL}>` });
	});

	describe("body", () => {
		test("plots the team's week as one segment per day, from the palette the web bar uses", async () => {
			let email = await makeEmail();

			let { html } = await render(email.body());

			expect(days(html)).toBe(7);
			expect(days(html, UP)).toBe(5);
			expect(days(html, DOWN)).toBe(1);
			expect(days(html, DEGRADED)).toBe(1);
		});

		test("captions the bar with the two ends of the window as dates", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain("Jul 27, 2026");
			expect(text).toContain("Aug 2, 2026");
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

		test("names the team in the footer and links to the switches that stop the email", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain(
				`You received this email because you are a member of Acme on Uptime. Choose which emails you get (${PREFERENCES_URL})`,
			);
		});
	});
});
