/**
 * Tests the alert email as a value: it addresses the mailbox its alert names, takes
 * every word of its subject and its field labels from the locale files, reports the
 * detail of whichever snapshot it was given, and only mentions an incident's totals
 * when there are totals to mention.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import type { AlertEventSnapshot } from "~/database/schema";

import { AlertEmail } from "~/app/emails/alert";
import { emailTranslator } from "~/app/emails/locale";

/** A minimal HTTP snapshot fixture, the shape every default below reports. */
let httpSnapshot: AlertEventSnapshot = {
	type: "http",
	responseStatus: 500,
	responseTimeMs: 1200,
	expectedStatus: 200,
	url: "https://example.com",
};

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<AlertEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new AlertEmail({
		to: "ops@example.com",
		subjectPrefix: "",
		monitorName: "Homepage",
		monitorType: "http",
		eventType: "down",
		snapshot: httpSnapshot,
		dashboardUrl: "https://uptime.test/app/team-1/monitors/monitor-1",
		occurredAt: new Date("2026-08-01T10:00:00.000Z"),
		incident: null,
		locale,
		t,
		...overrides,
	});
}

describe("AlertEmail", () => {
	test("addresses the mailbox the alert is configured with", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "ops@example.com" });
	});

	test("takes its subject from the locale files, naming the monitor and its new state", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("[Uptime Alert] Homepage is DOWN");
	});

	test("puts the team's own prefix in front of the translated subject", async () => {
		let email = await makeEmail({ subjectPrefix: "[PROD]" });

		expect(email.subject).toBe("[PROD] [Uptime Alert] Homepage is DOWN");
	});

	test("announces a recovery rather than an outage for an 'up' event", async () => {
		let email = await makeEmail({ eventType: "up" });

		expect(email.subject).toBe("[Uptime Alert] Homepage is RECOVERED");
	});

	test("reports the monitor, the snapshot, the time, and the dashboard link", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("Monitor Homepage (http)");
		expect(text).toContain("Status DOWN");
		expect(text).toContain("URL https://example.com");
		expect(text).toContain("Response status 500 (expected 200)");
		expect(text).toContain("Response time 1200ms");
		expect(text).toContain("Time Aug 1, 2026 at 10:00 AM UTC");
		expect(text).toContain("https://uptime.test/app/team-1/monitors/monitor-1");
	});

	test("reports the incident totals on a recovery that suppressed something", async () => {
		let email = await makeEmail({
			eventType: "up",
			incident: { sent: 10, suppressed: 300, cap: 10 },
		});

		let { text } = await render(email.body());

		expect(text).toContain("10 sent, 300 suppressed");
	});

	test("says nothing about an incident when there is nothing to report", async () => {
		let email = await makeEmail({ eventType: "up" });

		let { text } = await render(email.body());

		expect(text).not.toContain("suppressed");
	});

	test("reports a DNS check's own detail", async () => {
		let email = await makeEmail({
			monitorType: "dns",
			snapshot: {
				type: "dns",
				status: "changed",
				resolvedValue: "203.0.113.4",
				domain: "example.com",
				recordType: "A",
			},
		});

		let { text } = await render(email.body());

		expect(text).toContain("Domain example.com (A)");
		expect(text).toContain("Resolved value 203.0.113.4");
	});

	test("reports a TCP check's own detail, with an em dash for a missing response time", async () => {
		let email = await makeEmail({
			monitorType: "tcp",
			snapshot: {
				type: "tcp",
				status: "timeout",
				responseTimeMs: null,
				host: "db.example.com",
				port: 5432,
			},
		});

		let { text } = await render(email.body());

		expect(text).toContain("Endpoint db.example.com:5432");
		expect(text).toContain("Response time —");
	});

	test("reports a cron job's own detail, saying 'never' for a monitor that never pinged", async () => {
		let email = await makeEmail({
			monitorType: "cron",
			snapshot: {
				type: "cron",
				status: "missed",
				lastPingAt: null,
				nextExpectedAt: null,
				cronExpression: "*/5 * * * *",
				timezone: "UTC",
			},
		});

		let { text } = await render(email.body());

		expect(text).toContain("Schedule */5 * * * * (UTC)");
		expect(text).toContain("Last ping never");
	});

	test("reports a cron job's own timestamps in the reader's language, labelled UTC", async () => {
		let email = await makeEmail({
			monitorType: "cron",
			snapshot: {
				type: "cron",
				status: "missed",
				lastPingAt: "2026-08-01T09:45:00.000Z",
				nextExpectedAt: "2026-08-01T09:50:00.000Z",
				cronExpression: "*/5 * * * *",
				timezone: "UTC",
			},
		});

		let { text } = await render(email.body());

		expect(text).toContain("Last ping Aug 1, 2026 at 9:45 AM UTC");
		expect(text).toContain("Next expected Aug 1, 2026 at 9:50 AM UTC");
	});

	test("reports a certificate's own detail", async () => {
		let email = await makeEmail({
			monitorType: "ssl",
			eventType: "degraded",
			snapshot: {
				type: "ssl",
				status: "expiring",
				expiresAt: "2026-08-20T00:00:00.000Z",
				daysUntilExpiry: 19,
				hostname: "example.com",
			},
		});

		let { text } = await render(email.body());

		expect(text).toContain("Hostname example.com");
		expect(text).toContain("Expires at Aug 20, 2026 at 12:00 AM UTC");
	});

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("de");
		let email = await makeEmail({ locale, t });

		expect(email.subject).not.toBe("[Uptime Alert] Homepage is DOWN");
		expect(email.subject).toContain("Homepage");
	});
});
