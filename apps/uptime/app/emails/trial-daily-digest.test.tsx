/**
 * Tests the daily digest as a value, with the two shapes that matter: one URL, where it
 * must read as a plain report and not as a list of one, and several, where it must say
 * up front how many are fine and then name each one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import type { TrialStatus } from "~/app/emails/shared/trial";
import type { UptimeBar } from "~/app/emails/shared/uptime-bar";

import { emailTranslator } from "~/app/emails/locale";
import { TrialDailyDigestEmail } from "~/app/emails/trial-daily-digest";

/** Fill of a passing hour; `--ui-color-success-600`. */
let UP = "#107f04";

/** Fill of a failing hour; `--ui-color-danger-600`. */
let DOWN = "#ba2b2e";

/** A full day of hourly checks, all of them passing. */
function goodDay(): UptimeBar.Status[] {
	return Array.from({ length: 24 }, () => "up" as const);
}

/** One target with a full clean day behind it, overridable per test. */
function target(
	url: string,
	status: TrialStatus = "up",
	overrides: Partial<TrialDailyDigestEmail.Target> = {},
): TrialDailyDigestEmail.Target {
	return {
		url,
		status,
		segments: goodDay(),
		stats: { checks: 24, uptime: "100", slowestResponseMs: 310 },
		...overrides,
	};
}

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TrialDailyDigestEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TrialDailyDigestEmail({
		to: "visitor@example.com",
		targets: [target("https://example.com")],
		unsubscribeToken: "tok-abc123",
		locale,
		t,
		...overrides,
	});
}

describe("TrialDailyDigestEmail", () => {
	test("goes to the lead rather than to a URL", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "visitor@example.com" });
	});

	describe("with a single URL", () => {
		test("names the URL in the subject rather than counting it", async () => {
			let email = await makeEmail();

			expect(email.subject).toBe("Daily report: https://example.com");
		});

		test("reads as one report: no roll-up line and no per-URL heading", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain("https://example.com over the last 24 hours");
			expect(text).not.toContain("were up at the last check");
			expect(text).not.toContain("—  UP");
		});

		test("reports the day's numbers under the bar", async () => {
			let email = await makeEmail();

			let { text } = await render(email.body());

			expect(text).toContain("Checks run: 24");
			expect(text).toContain("Uptime: 100%");
			expect(text).toContain("Slowest response: 310ms");
			expect(text).toContain("24 hours ago");
		});

		test("plots one segment per hour of the day", async () => {
			let email = await makeEmail();

			let { html } = await render(email.body());

			expect(html.split(UP).length - 1).toBe(25);
		});

		test("reports an em dash for a day where nothing answered", async () => {
			let email = await makeEmail({
				targets: [
					target("https://example.com", "down", {
						segments: Array.from({ length: 24 }, () => null),
						stats: { checks: 0, uptime: null, slowestResponseMs: null },
					}),
				],
			});

			let { text } = await render(email.body());

			expect(text).toContain("Checks run: 0");
			expect(text).toContain("Uptime: —");
			expect(text).toContain("Slowest response: —");
		});
	});

	describe("with several URLs", () => {
		test("counts them in the subject instead of naming one", async () => {
			let email = await makeEmail({
				targets: [target("https://a.example"), target("https://b.example")],
			});

			expect(email.subject).toBe("Daily report: 2 URLs");
		});

		test("opens with a roll-up saying everything is fine", async () => {
			let email = await makeEmail({
				targets: [
					target("https://a.example"),
					target("https://b.example"),
					target("https://c.example"),
				],
			});

			let { text } = await render(email.body());

			expect(text).toContain("Your 3 URLs over the last 24 hours");
			expect(text).toContain("All 3 were up at the last check.");
		});

		test("counts the healthy ones when one of them is not", async () => {
			let email = await makeEmail({
				targets: [
					target("https://a.example"),
					target("https://b.example", "down"),
					target("https://c.example"),
				],
			});

			let { text } = await render(email.body());

			expect(text).toContain("2 of 3 were up at the last check.");
		});

		test("heads each URL with its own name and state", async () => {
			let email = await makeEmail({
				targets: [target("https://a.example"), target("https://b.example", "degraded")],
			});

			let { text } = await render(email.body());

			expect(text).toContain("https://a.example — UP");
			expect(text).toContain("https://b.example — DEGRADED");
		});

		test("gives every URL its own bar", async () => {
			let email = await makeEmail({
				targets: [
					target("https://a.example"),
					target("https://b.example", "down", {
						segments: Array.from({ length: 24 }, () => "down" as const),
						stats: { checks: 24, uptime: "0", slowestResponseMs: null },
					}),
				],
			});

			let { html } = await render(email.body());

			expect(html.split(UP).length - 1).toBe(26);
			expect(html.split(DOWN).length - 1).toBe(26);
		});
	});

	test("has no call to action: the digest is not the email that sells", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

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
		let { locale, t } = await emailTranslator("de");
		let email = await makeEmail({ locale, t });

		expect(email.subject).toBe("Täglicher Bericht: https://example.com");
	});
});
