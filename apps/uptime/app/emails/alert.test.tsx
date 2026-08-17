/**
 * Tests the alert email as a value: it addresses the mailbox its alert names, takes
 * every word of its subject and its field labels from the locale files, reports the
 * detail of whichever snapshot it was given, and only mentions an incident's totals
 * when there are totals to mention.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@pkg/i18n";

import { render } from "@pkg/mail";
import { describe, expect, test } from "vitest";

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

/** A domain sweep's snapshot, defaulting to a `changed` check with nothing to quote. */
function makeDnsSnapshot(
	overrides: Partial<Extract<AlertEventSnapshot, { type: "dns" }>> = {},
): AlertEventSnapshot {
	return {
		type: "dns",
		status: "changed",
		domain: "example.com",
		recordsChanged: 0,
		recordsMissing: 0,
		recordsNew: 0,
		findings: [],
		...overrides,
	};
}

/**
 * A translator that answers with the key it was asked for and remembers the question, so
 * a test can state which keys the copy is made of and what is interpolated into them.
 */
function keyRecorder() {
	let calls: { key: string; options: unknown }[] = [];
	let t = ((key: string, options?: unknown) => {
		calls.push({ key, options });
		return key;
	}) as unknown as TFunction;

	return { calls, t };
}

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
		expect(instants(text)).toContain("Time Aug 1, 2026 at 10:00 AM UTC");
		expect(text).toContain("https://uptime.test/app/team-1/monitors/monitor-1");
	});

	/**
	 * Asserted as the key the email asks for, with its interpolations, rather than as
	 * rendered copy: the totals moved to a key of their own when the per-incident ceiling
	 * was removed, because the old key's every translation names that ceiling. Written this
	 * way the test states the contract the locale files have to satisfy, and keeps stating
	 * it once they do.
	 */
	test("reports the incident totals on a recovery that held notifications back", async () => {
		let asked = keyRecorder();
		let email = await makeEmail({
			eventType: "up",
			incident: { sent: 10, suppressed: 300 },
			t: asked.t,
		});

		await render(email.body());

		expect(asked.calls).toContainEqual({
			key: "emails.alert.incidentCooldown",
			options: { sent: 10, suppressed: 300 },
		});
	});

	test("says nothing about an incident when there is nothing to report", async () => {
		let email = await makeEmail({ eventType: "up" });

		let { text } = await render(email.body());

		expect(text).not.toContain("suppressed");
	});

	test("reports a DNS check's own detail", async () => {
		let email = await makeEmail({
			monitorType: "dns",
			snapshot: makeDnsSnapshot(),
		});

		let { text } = await render(email.body());

		expect(text).toContain("Domain example.com");
		expect(text).toContain("Status changed");
	});

	/**
	 * Asserted as the keys the email asks for, with their interpolations, rather than as
	 * rendered copy: these keys are the contract the locale files have to satisfy, and
	 * stating it this way keeps stating it once they do.
	 */
	test("quotes each of a domain sweep's findings, with the counters behind them", async () => {
		let asked = keyRecorder();
		let email = await makeEmail({
			monitorType: "dns",
			t: asked.t,
			snapshot: makeDnsSnapshot({
				recordsMissing: 1,
				recordsNew: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
					{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
				],
			}),
		});

		await render(email.body());

		expect(asked.calls).toContainEqual({
			key: "emails.alert.values.dnsRecordCounts",
			options: { missing: 1, changed: 0, new: 1 },
		});
		expect(asked.calls).toContainEqual({
			key: "emails.alert.values.dnsFinding.missing",
			options: { name: "example.com", type: "MX", value: "10 mx1.example.com" },
		});
		expect(asked.calls).toContainEqual({
			key: "emails.alert.values.dnsFinding.new",
			options: { name: "example.com", type: "MX", value: "20 mx2.example.com" },
		});
	});

	/**
	 * A value edited inside a record set holding several values is reported as one record
	 * no longer resolving plus one new record, because DNS gives a record no identity of
	 * its own. The email says so whenever that shape is present, or the truthful report
	 * reads as a bug.
	 */
	test("explains an edited record set, and says a new record is not being watched yet", async () => {
		let asked = keyRecorder();
		let email = await makeEmail({
			monitorType: "dns",
			t: asked.t,
			snapshot: makeDnsSnapshot({
				recordsMissing: 1,
				recordsNew: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
					{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
				],
			}),
		});

		await render(email.body());

		let keys = asked.calls.map((call) => call.key);
		expect(keys).toContain("emails.alert.dns.recordSetEditNote");
		expect(keys).toContain("emails.alert.dns.newRecordsNote");
	});

	test("says nothing about an edit when a record simply stopped resolving", async () => {
		let asked = keyRecorder();
		let email = await makeEmail({
			monitorType: "dns",
			t: asked.t,
			snapshot: makeDnsSnapshot({
				recordsMissing: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
				],
			}),
		});

		await render(email.body());

		let keys = asked.calls.map((call) => call.key);
		expect(keys).not.toContain("emails.alert.dns.recordSetEditNote");
		expect(keys).not.toContain("emails.alert.dns.newRecordsNote");
	});

	/** The counters are the totals; the findings are the capped sample quoted back. */
	test("says how many findings it is not showing", async () => {
		let asked = keyRecorder();
		let email = await makeEmail({
			monitorType: "dns",
			t: asked.t,
			snapshot: makeDnsSnapshot({
				recordsMissing: 9,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
				],
			}),
		});

		await render(email.body());

		expect(asked.calls).toContainEqual({
			key: "emails.alert.values.dnsMoreFindings",
			options: { count: 8 },
		});
	});

	test("renders every quoted finding on a line of its own", async () => {
		let email = await makeEmail({
			monitorType: "dns",
			snapshot: makeDnsSnapshot({
				recordsMissing: 1,
				recordsNew: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
					{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
				],
			}),
		});

		let { html, text } = await render(email.body());

		expect(html).toContain("<br");
		/**
		 * Both findings survive into the text part rather than running together. Located by
		 * the RDATA each one carries, which is what distinguishes the two halves of an
		 * edited record set from each other.
		 */
		let lines = text.split("\n");
		let missingLine = lines.findIndex((line) => line.includes("10 mx1.example.com"));
		let newLine = lines.findIndex((line) => line.includes("20 mx2.example.com"));
		expect(missingLine).toBeGreaterThanOrEqual(0);
		expect(newLine).toBeGreaterThanOrEqual(0);
		expect(newLine).not.toBe(missingLine);
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

		expect(instants(text)).toContain("Last ping Aug 1, 2026 at 9:45 AM UTC");
		expect(instants(text)).toContain("Next expected Aug 1, 2026 at 9:50 AM UTC");
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
		expect(instants(text)).toContain("Expires at Aug 20, 2026 at 12:00 AM UTC");
	});

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("de");
		let email = await makeEmail({ locale, t });

		expect(email.subject).not.toBe("[Uptime Alert] Homepage is DOWN");
		expect(email.subject).toContain("Homepage");
	});
});
