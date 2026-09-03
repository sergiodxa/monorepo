/**
 * Unit tests for the alert-dispatch pipeline: maintenance suppression, candidate
 * resolution, the repeat policy, recovery suppression totals, delivery outcome
 * recording, and per-strategy delivery (email/webhook/Slack/Discord). `Alert` and
 * `AlertEvent` are mocked because this harness's SQLite adapter can't bind their JSON
 * `config`/`snapshot` columns; webhook endpoints are intercepted with MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";

import { Mailer, MailError } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { failure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type {
	AlertEventSnapshot,
	SelectAlert,
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectDnsMonitorRecord,
	SelectFlowMonitor,
	SelectFlowMonitorResult,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

import { AlertEmail } from "~/app/emails/alert";
import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";

let listForMonitorMock = vi.fn(async (..._args: unknown[]) => [] as SelectAlert[]);
let recordMock = vi.fn(async (..._args: unknown[]) => ({}) as unknown);
let isInCooldownMock = vi.fn(async (..._args: unknown[]) => false);
let countSentSinceRecoveryMock = vi.fn(async (..._args: unknown[]) => 0);
let summarizeIncidentMock = vi.fn(async (..._args: unknown[]) => ({ sent: 0, suppressed: 0 }));

/**
 * The real classes, imported before the `vi.doMock` calls below so this file keeps a handle
 * on the implementations being replaced. A mock registered with `vi.doMock` only reaches
 * imports that run after it, so the subject module is imported dynamically further down.
 */
let realAlertModule = await import("~/app/data/alert");
let realAlertEventModule = await import("~/app/data/alert-event");

/**
 * The two history reads, captured as function values before the mocks take their place —
 * reaching for them through the fake classes later would find the mocks and recurse. Bound to
 * the real class so any static they reach for is the real one too.
 */
let realIsInCooldown = realAlertEventModule.default.isInCooldown.bind(realAlertEventModule.default);
let realCountSentSinceRecovery = realAlertEventModule.default.countSentSinceRecovery.bind(
	realAlertEventModule.default,
);

/**
 * The fakes subclass the real classes rather than object-spreading them, so every static
 * this file doesn't fake stays equal to the real class's own — object spread silently
 * drops class statics, since they are non-enumerable.
 */
class FakeAlert extends realAlertModule.default {
	static override listForMonitor = listForMonitorMock;
}

/** See `FakeAlert`: the four history statics `dispatchAlerts` calls, and nothing else. */
class FakeAlertEvent extends realAlertEventModule.default {
	static override record =
		recordMock as unknown as (typeof realAlertEventModule)["default"]["record"];
	static override isInCooldown = isInCooldownMock;
	static override countSentSinceRecovery = countSentSinceRecoveryMock;
	static override summarizeIncident = summarizeIncidentMock;
}

vi.doMock("~/app/data/alert", () => ({ default: FakeAlert }));
vi.doMock("~/app/data/alert-event", () => ({ default: FakeAlertEvent }));

let { createTestDatabase } = await import("~/app/lib/test/db");
let { alertEvents, teams, monitors, maintenanceWindows } = await import("~/database/schema");
let {
	dashboardUrl,
	dispatchAlerts,
	dnsAlertResultFromDiff,
	dnsAlertResultFromRecords,
	flowAlertResultFromResult,
	notifyCronJobResult,
	notifyDnsResult,
	notifyFlowResult,
	notifyHttpResult,
	notifySslResult,
	notifyTcpResult,
	shouldNotifyCronJobResult,
	shouldNotifyDnsResult,
	shouldNotifyFlowResult,
	shouldNotifyTcpResult,
} = await import("~/app/services/alerts");

type Db = Awaited<ReturnType<typeof createTestDatabase>>["db"];

/** Builds a fixture alert row; defaults to an unconditional, cooldown-free email alert. */
function makeAlert(overrides: Partial<SelectAlert> = {}): SelectAlert {
	return {
		id: crypto.randomUUID(),
		created_at: Date.now(),
		updated_at: Date.now(),
		team_id: "team-1",
		monitor_type: null,
		monitor_id: null,
		name: "Alert",
		notify_on_recovery: true,
		cooldown_minutes: 0,
		config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "" } },
		...overrides,
	};
}

/**
 * A mailer carrying the app's own sender identity over a recording transport, so a
 * test asserts on the message a provider would have received instead of on a mocked SDK.
 */
function makeMailer(transport: Transport = new MemoryTransport()): Mailer {
	return new Mailer({ transport, from: MAIL_FROM, replyTo: MAIL_REPLY_TO });
}

/** A transport that refuses every delivery, which is how a provider reports a bad address. */
function failingTransport(message: string): Transport {
	return {
		async send() {
			return failure(new MailError(message));
		},
	};
}

const WEBHOOK_URL = "https://hooks.example.com/uptime";

const SLACK_URL = "https://hooks.slack.example/abc";

const DISCORD_URL = "https://discord.example/webhooks/abc";

/** One webhook delivery as it went on the wire. */
interface Delivery {
	url: string;
	method: string;
	headers: Headers;
	body: string;
}

/** Every delivery that left over the three webhook channels, in order. */
let deliveries: Delivery[] = [];

/**
 * Records what a channel POSTs and answers with `status`. Registered at 200 for all three
 * endpoints, since an accepted delivery is what most tests need; a test that wants an
 * endpoint to refuse re-registers that one endpoint through `server.use`.
 */
function webhookHandler(url: string, status = 200) {
	return http.post(url, async ({ request }) => {
		deliveries.push({
			url: request.url,
			method: request.method,
			headers: request.headers,
			body: await request.text(),
		});
		return new HttpResponse(null, { status });
	});
}

let server = setupServer(
	webhookHandler(WEBHOOK_URL),
	webhookHandler(SLACK_URL),
	webhookHandler(DISCORD_URL),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The one delivery a single-alert dispatch is expected to have made. */
function onlyDelivery(): Delivery {
	expect(deliveries).toHaveLength(1);
	let [delivery] = deliveries;
	if (!delivery) throw new Error("expected exactly one webhook delivery");
	return delivery;
}

let httpSnapshot: AlertEventSnapshot = {
	type: "http",
	responseStatus: 500,
	responseTimeMs: 1200,
	expectedStatus: 200,
	url: "https://example.com",
};

/** A domain sweep's snapshot: counters plus the findings they count, unless overridden. */
function makeDnsSnapshot(
	overrides: Partial<Extract<AlertEventSnapshot, { type: "dns" }>> = {},
): AlertEventSnapshot {
	return {
		type: "dns",
		status: "error",
		domain: "x.com",
		recordsChanged: 0,
		recordsMissing: 0,
		recordsNew: 0,
		findings: [],
		...overrides,
	};
}

beforeEach(() => {
	listForMonitorMock.mockClear();
	recordMock.mockClear();
	isInCooldownMock.mockClear();
	countSentSinceRecoveryMock.mockClear();
	summarizeIncidentMock.mockClear();
	listForMonitorMock.mockImplementation(async () => []);
	recordMock.mockImplementation(async () => ({}));
	isInCooldownMock.mockImplementation(async () => false);
	countSentSinceRecoveryMock.mockImplementation(async () => 0);
	summarizeIncidentMock.mockImplementation(async () => ({ sent: 0, suppressed: 0 }));
	deliveries = [];
});

describe("dashboardUrl", () => {
	test("prefixes a relative path with the production dashboard origin", () => {
		expect(dashboardUrl("/app/team-1/monitors/mon-1")).toBe(
			"https://uptime.sergiodxa.com/app/team-1/monitors/mon-1",
		);
	});
});

describe("dispatchAlerts — maintenance-window suppression", () => {
	async function seedTeamAndMonitor(db: Db) {
		await db.create(teams, { id: "team-1", owner_id: "owner-1", name: "Team", slug: "team-1" });
		await db.create(monitors, {
			id: "monitor-1",
			team_id: "team-1",
			author_id: "owner-1",
			name: "Homepage",
			url: "https://example.com",
		});
	}

	test("skips resolving and delivering alerts entirely when a suppressing window covers the monitor", async () => {
		let { db } = createTestDatabase();
		await seedTeamAndMonitor(db);
		let now = Date.now();
		await db.create(maintenanceWindows, {
			id: "win-1",
			team_id: "team-1",
			monitor_id: "monitor-1",
			name: "Deploy window",
			starts_at: now - 1000,
			ends_at: now + 100_000,
			suppress_alerts: true,
		});

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).not.toHaveBeenCalled();
		expect(recordMock).not.toHaveBeenCalled();
	});

	test("does not suppress when the window has suppress_alerts disabled", async () => {
		let { db } = createTestDatabase();
		await seedTeamAndMonitor(db);
		let now = Date.now();
		await db.create(maintenanceWindows, {
			id: "win-1",
			team_id: "team-1",
			monitor_id: "monitor-1",
			name: "Deploy window",
			starts_at: now - 1000,
			ends_at: now + 100_000,
			suppress_alerts: false,
		});

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).toHaveBeenCalledTimes(1);
	});

	test("does not suppress once the window's time range has already ended", async () => {
		let { db } = createTestDatabase();
		await seedTeamAndMonitor(db);
		let now = Date.now();
		await db.create(maintenanceWindows, {
			id: "win-1",
			team_id: "team-1",
			monitor_id: "monitor-1",
			name: "Deploy window",
			starts_at: now - 200_000,
			ends_at: now - 100_000,
			suppress_alerts: true,
		});

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).toHaveBeenCalledTimes(1);
	});

	test("a team-wide window (monitor_id null) suppresses any HTTP monitor in the team", async () => {
		let { db } = createTestDatabase();
		await seedTeamAndMonitor(db);
		let now = Date.now();
		await db.create(maintenanceWindows, {
			id: "win-1",
			team_id: "team-1",
			monitor_id: null,
			name: "Team-wide window",
			starts_at: now - 1000,
			ends_at: now + 100_000,
			suppress_alerts: true,
		});

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("a monitor-specific window never suppresses a non-HTTP monitor type, even with a matching monitor_id", async () => {
		let { db } = createTestDatabase();
		await seedTeamAndMonitor(db);
		let now = Date.now();
		await db.create(maintenanceWindows, {
			id: "win-1",
			team_id: "team-1",
			monitor_id: "monitor-1",
			name: "Deploy window",
			starts_at: now - 1000,
			ends_at: now + 100_000,
			suppress_alerts: true,
		});

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "dns",
			monitorName: "Domain",
			eventType: "down",
			snapshot: makeDnsSnapshot(),
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).toHaveBeenCalledTimes(1);
	});

	test("an 'ssl' monitor type is suppressed like 'http' (same monitor id, same windows)", async () => {
		let { db } = createTestDatabase();
		await seedTeamAndMonitor(db);
		let now = Date.now();
		await db.create(maintenanceWindows, {
			id: "win-1",
			team_id: "team-1",
			monitor_id: "monitor-1",
			name: "Deploy window",
			starts_at: now - 1000,
			ends_at: now + 100_000,
			suppress_alerts: true,
		});

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "ssl",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: {
				type: "ssl",
				status: "expired",
				expiresAt: null,
				daysUntilExpiry: -1,
				hostname: "example.com",
			},
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});
});

describe("dispatchAlerts — candidate resolution", () => {
	test("resolves an 'ssl' event as 'http', so it reaches whatever watches that monitor", async () => {
		let { db } = createTestDatabase();

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "ssl",
			monitorName: "Homepage",
			eventType: "degraded",
			snapshot: {
				type: "ssl",
				status: "expiring_soon",
				expiresAt: null,
				daysUntilExpiry: 5,
				hostname: "example.com",
			},
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).toHaveBeenCalledWith(db, "team-1", "http", "monitor-1");
	});

	test("resolves monitor-specific + team-wide alerts for an HTTP monitor", async () => {
		let { db } = createTestDatabase();

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForMonitorMock).toHaveBeenCalledWith(db, "team-1", "http", "monitor-1");
	});

	test("resolves alerts by the monitor's own type for a DNS, TCP, or cron-job monitor", async () => {
		let { db } = createTestDatabase();

		for (let monitorType of ["dns", "tcp", "cron"] as const) {
			listForMonitorMock.mockClear();

			await dispatchAlerts({
				db,
				mailer: makeMailer(),
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType,
				monitorName: "Some monitor",
				eventType: "down",
				snapshot: httpSnapshot,
				dashboardUrl: "https://uptime.sergiodxa.com/x",
			});

			expect(listForMonitorMock).toHaveBeenCalledWith(db, "team-1", monitorType, "monitor-1");
		}
	});
});

describe("dispatchAlerts — notify_on_recovery filtering", () => {
	test("an 'up' event only delivers to alerts with notify_on_recovery enabled", async () => {
		let { db } = createTestDatabase();
		let recovers = makeAlert({ id: "recovers", notify_on_recovery: true });
		let silent = makeAlert({ id: "silent", notify_on_recovery: false });
		listForMonitorMock.mockImplementation(async () => [recovers, silent]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "up",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(isInCooldownMock).toHaveBeenCalledTimes(1);
		expect(isInCooldownMock).toHaveBeenCalledWith(db, "recovers", "monitor-1", "up", 0);
	});

	test("a 'down' or 'degraded' event delivers to every candidate regardless of notify_on_recovery", async () => {
		let { db } = createTestDatabase();
		let a = makeAlert({ id: "a", notify_on_recovery: true });
		let b = makeAlert({ id: "b", notify_on_recovery: false });
		listForMonitorMock.mockImplementation(async () => [a, b]);
		let transport = new MemoryTransport();

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.messages).toHaveLength(2);
	});
});

describe("dispatchAlerts — cooldown", () => {
	test("skips delivery and records skipped_cooldown when the alert is in cooldown", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({ cooldown_minutes: 30 });
		listForMonitorMock.mockImplementation(async () => [alert]);
		countSentSinceRecoveryMock.mockImplementation(async () => 1);
		isInCooldownMock.mockImplementation(async () => true);
		let transport = new MemoryTransport();

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.messages).toHaveLength(0);
		expect(recordMock).toHaveBeenCalledTimes(1);
		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("skipped_cooldown");
		expect(call.error_message).toBeNull();
		expect(call.alert_id).toBe(alert.id);
	});

	test("delivers and checks cooldown per-alert-id/monitor/event-type with the alert's own cooldown_minutes", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({ id: "alert-7", cooldown_minutes: 15 });
		listForMonitorMock.mockImplementation(async () => [alert]);
		countSentSinceRecoveryMock.mockImplementation(async () => 1);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "degraded",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(isInCooldownMock).toHaveBeenCalledWith(db, "alert-7", "monitor-1", "degraded", 15);
	});
});

/**
 * The alert repeat policy: alert immediately when a monitor goes down, stay quiet during
 * the cooldown, and always alert on recovery. These tests run the real `isInCooldown` and
 * `countSentSinceRecovery` against a seeded database, since mocking both would only assert the mocks.
 */
describe("dispatchAlerts — repeat policy", () => {
	/** Points the two history reads at their real implementations for this test. */
	function useRealHistoryReads(): void {
		isInCooldownMock.mockImplementation(async (...args: unknown[]) =>
			realIsInCooldown(...(args as Parameters<typeof realIsInCooldown>)),
		);
		countSentSinceRecoveryMock.mockImplementation(async (...args: unknown[]) =>
			realCountSentSinceRecovery(...(args as Parameters<typeof realCountSentSinceRecovery>)),
		);
	}

	/** Writes one delivered event into the history at an exact instant. */
	async function seedSent(
		db: Db,
		alertId: string,
		eventType: "down" | "up" | "degraded",
		sentAt: number,
	): Promise<void> {
		await db.create(alertEvents, {
			id: crypto.randomUUID(),
			created_at: sentAt,
			sent_at: sentAt,
			alert_id: alertId,
			monitor_id: "monitor-1",
			event_type: eventType,
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Homepage",
			snapshot: null,
		});
	}

	/** Dispatches one event for `alert` and reports what came of it. */
	async function dispatchOne(
		db: Db,
		alert: SelectAlert,
		eventType: "down" | "up" | "degraded",
	): Promise<{ delivered: number; status: unknown }> {
		listForMonitorMock.mockImplementation(async () => [alert]);
		let transport = new MemoryTransport();

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType,
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = recordMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
		return { delivered: transport.messages.length, status: call.status };
	}

	/**
	 * Seeds a previous outage this alert already reported and saw recover, minutes ago — the
	 * hour-long cooldown must not hold back the news that it is down again.
	 */
	test("alerts immediately the first time a monitor is detected down", async () => {
		let { db } = createTestDatabase();
		useRealHistoryReads();
		let now = Date.now();
		let alert = makeAlert({ id: "alert-first", cooldown_minutes: 60 });
		await seedSent(db, alert.id, "down", now - 10 * 60_000);
		await seedSent(db, alert.id, "up", now - 9 * 60_000);

		expect(await dispatchOne(db, alert, "down")).toEqual({ delivered: 1, status: "sent" });
	});

	test("skips a repeat while it is still down until the hour has passed, then alerts again", async () => {
		let now = Date.now();
		let alert = makeAlert({ id: "alert-repeat", cooldown_minutes: 60 });

		let inside = createTestDatabase().db;
		useRealHistoryReads();
		await seedSent(inside, alert.id, "down", now - 30 * 60_000);
		expect(await dispatchOne(inside, alert, "down")).toEqual({
			delivered: 0,
			status: "skipped_cooldown",
		});

		let after = createTestDatabase().db;
		await seedSent(after, alert.id, "down", now - 61 * 60_000);
		expect(await dispatchOne(after, alert, "down")).toEqual({ delivered: 1, status: "sent" });
	});

	/**
	 * Seeds twelve hourly down notifications culminating a minute before recovery, so the
	 * recovery alert must fire however long the outage already ran.
	 */
	test("alerts on recovery however long the outage lasted, with no ceiling to stop it", async () => {
		let { db } = createTestDatabase();
		useRealHistoryReads();
		let now = Date.now();
		let alert = makeAlert({ id: "alert-recovers", cooldown_minutes: 60 });
		for (let hour = 12; hour >= 1; hour--) {
			await seedSent(db, alert.id, "down", now - hour * 60 * 60_000);
		}
		await seedSent(db, alert.id, "down", now - 60_000);

		expect(await dispatchOne(db, alert, "up")).toEqual({ delivered: 1, status: "sent" });
	});

	test("an alert storing a cooldown of 0 still can't notify once per check", async () => {
		let now = Date.now();
		let alert = makeAlert({ id: "alert-zero", cooldown_minutes: 0 });

		/**
		 * A stored `cooldown_minutes: 0` is clamped to the minimum spacing between repeats,
		 * so a check one minute after the previous down alert still falls inside that floor.
		 */
		let perCheck = createTestDatabase().db;
		useRealHistoryReads();
		await seedSent(perCheck, alert.id, "down", now - 60_000);
		expect(await dispatchOne(perCheck, alert, "down")).toEqual({
			delivered: 0,
			status: "skipped_cooldown",
		});

		/**
		 * The floor sets the fastest cadence a zero-cooldown alert can repeat at; a check
		 * past that floor is delivered on the next dispatch.
		 */
		let afterFloor = createTestDatabase().db;
		await seedSent(afterFloor, alert.id, "down", now - 6 * 60_000);
		expect(await dispatchOne(afterFloor, alert, "down")).toEqual({ delivered: 1, status: "sent" });
	});

	test("repeats an SSL reminder on its cooldown, even though nothing ever recovers it", async () => {
		let { db } = createTestDatabase();
		useRealHistoryReads();
		let now = Date.now();
		let alert = makeAlert({ id: "alert-ssl", cooldown_minutes: 60 });
		await seedSent(db, alert.id, "degraded", now - 30 * 60_000);
		listForMonitorMock.mockImplementation(async () => [alert]);
		let transport = new MemoryTransport();

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "ssl",
			monitorName: "Homepage",
			eventType: "degraded",
			snapshot: {
				type: "ssl",
				status: "expiring",
				expiresAt: null,
				daysUntilExpiry: 3,
				hostname: "example.com",
			},
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.messages).toHaveLength(0);
		let call = recordMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;
		expect(call.status).toBe("skipped_cooldown");
	});
});

describe("dispatchAlerts — recovery reports what was suppressed", () => {
	/**
	 * Asserted on the webhook channel, which puts the pipeline's own `text` on the wire
	 * verbatim; the email channel renders the same totals through a locale key, so
	 * asserting there would check the translation instead of the sentence this pipeline writes.
	 */
	test("adds the incident's sent and suppressed totals to the recovery message", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [
			makeAlert({
				id: "alert-11",
				config: { strategy: "webhook", config: { url: WEBHOOK_URL, secret: "" } },
			}),
		]);
		summarizeIncidentMock.mockImplementation(async () => ({ sent: 10, suppressed: 300 }));

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "up",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(summarizeIncidentMock).toHaveBeenCalledWith(db, "alert-11", "monitor-1");
		let parsed = JSON.parse(onlyDelivery().body) as { message: string };
		expect(parsed.message).toContain(
			"Notifications for this incident: 10 sent, 300 held back by the alert's cooldown.",
		);
	});

	test("leaves a recovery message alone when nothing was suppressed", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);
		summarizeIncidentMock.mockImplementation(async () => ({ sent: 1, suppressed: 0 }));
		let transport = new MemoryTransport();

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "up",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.last?.text).not.toContain("suppressed");
	});

	test("doesn't summarize an incident for a non-recovery event", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(summarizeIncidentMock).not.toHaveBeenCalled();
	});
});

describe("dispatchAlerts — delivery outcome recording", () => {
	test("records 'sent' with a null error_message on a successful delivery", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("sent");
		expect(call.error_message).toBeNull();
		expect(call.monitor_type).toBe("http");
		expect(call.monitor_name).toBe("Homepage");
		expect(call.snapshot).toEqual(httpSnapshot);
	});

	test("records 'failed' with the error message when the transport refuses the message", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);
		let transport = failingTransport("bad recipient");

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("failed");
		expect(call.error_message).toBe("bad recipient");
	});

	test("one alert's delivery failure doesn't stop other alerts from being delivered (Promise.allSettled)", async () => {
		let { db } = createTestDatabase();
		let failing = makeAlert({ id: "failing" });
		let succeeding = makeAlert({
			id: "succeeding",
			config: { strategy: "slack", config: { webhookUrl: SLACK_URL } },
		});
		listForMonitorMock.mockImplementation(async () => [failing, succeeding]);
		let transport = failingTransport("boom");

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(recordMock).toHaveBeenCalledTimes(2);
		let statuses = recordMock.mock.calls.map((call) => (call[1] as { status: string }).status);
		expect(statuses.sort((a, b) => a.localeCompare(b))).toEqual(["failed", "sent"]);
	});

	test("email subject is prefixed with the alert's configured subjectPrefix", async () => {
		let { db } = createTestDatabase();
		let transport = new MemoryTransport();
		let alert = makeAlert({
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "[PROD]" } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.last?.subject).toBe("[PROD] [Uptime Alert] Homepage is DOWN");
		expect(transport.last?.to).toEqual([{ email: "ops@example.com" }]);
		expect(transport.last?.from).toEqual(MAIL_FROM);
		expect(transport.last?.replyTo).toEqual([MAIL_REPLY_TO]);
	});

	test("sends the alert email itself, identified by type rather than by its copy", async () => {
		let { db } = createTestDatabase();
		let transport = new MemoryTransport();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.find((message) => message.email instanceof AlertEmail)).toBeDefined();
	});

	test("reports the monitor, the snapshot, and the dashboard link in both body parts", async () => {
		let { db } = createTestDatabase();
		let transport = new MemoryTransport();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(transport),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(transport.last?.html).toContain("https://uptime.sergiodxa.com/x");
		expect(transport.last?.text).toContain("Homepage");
		expect(transport.last?.text).toContain("500 (expected 200)");
		expect(transport.last?.text).toContain("https://uptime.sergiodxa.com/x");
	});
});

/**
 * The plain-text body every non-email channel puts on the wire, asserted on the Slack
 * strategy because it sends that text verbatim. A DNS snapshot's body explains itself
 * with counters, findings, and the sentences that keep a true report from reading as a bug.
 */
describe("dispatchAlerts — the DNS body", () => {
	async function slackText(snapshot: AlertEventSnapshot): Promise<string> {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [
			makeAlert({ config: { strategy: "slack", config: { webhookUrl: SLACK_URL } } }),
		]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "dns-monitor-1",
			monitorType: "dns",
			monitorName: "Domain",
			eventType: "degraded",
			snapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		return (JSON.parse(onlyDelivery().body) as { text: string }).text;
	}

	test("lists the counters and quotes every finding", async () => {
		let text = await slackText(
			makeDnsSnapshot({
				status: "changed",
				domain: "example.com",
				recordsMissing: 1,
				recordsNew: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
					{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
				],
			}),
		);

		expect(text).toContain("Domain: example.com");
		expect(text).toContain("Records: 1 missing, 0 changed, 1 newly seen");
		expect(text).toContain("- no longer resolving: example.com MX 10 mx1.example.com");
		expect(text).toContain("- newly seen: example.com MX 20 mx2.example.com");
	});

	test("says in words why an edited record set is reported as two findings", async () => {
		let text = await slackText(
			makeDnsSnapshot({
				status: "changed",
				recordsMissing: 1,
				recordsNew: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
					{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
				],
			}),
		);

		expect(text).toContain("no per-record identity in DNS");
		expect(text).toContain("Newly seen records are not being watched yet");
	});

	test("does not explain an edit when no record set was edited", async () => {
		let text = await slackText(
			makeDnsSnapshot({
				status: "changed",
				recordsMissing: 1,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
				],
			}),
		);

		expect(text).not.toContain("no per-record identity in DNS");
		expect(text).not.toContain("Newly seen records are not being watched yet");
	});

	/** The counters report the true totals, so any gap above the listed findings is what the summary line accounts for. */
	test("says how many findings it is not showing", async () => {
		let text = await slackText(
			makeDnsSnapshot({
				status: "changed",
				recordsMissing: 9,
				findings: [
					{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
				],
			}),
		);

		expect(text).toContain("- and 8 more");
	});
});

describe("dispatchAlerts — webhook delivery", () => {
	async function computeHmacSha256Hex(secret: string, payload: string): Promise<string> {
		let encoder = new TextEncoder();
		let key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		let signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
		return [...new Uint8Array(signature)]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	}

	test("POSTs a JSON body and signs it with a real HMAC-SHA256 signature when a secret is configured", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "webhook", config: { url: WEBHOOK_URL, secret: "shh" } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let delivery = onlyDelivery();
		expect(delivery.url).toBe(WEBHOOK_URL);
		expect(delivery.method).toBe("POST");
		expect(delivery.headers.get("Content-Type")).toBe("application/json");

		let expectedSignature = `sha256=${await computeHmacSha256Hex("shh", delivery.body)}`;
		expect(delivery.headers.get("Webhook-Signature")).toBe(expectedSignature);

		let parsed = JSON.parse(delivery.body) as Record<string, unknown>;
		expect(parsed.monitorId).toBe("monitor-1");
		expect(parsed.monitorType).toBe("http");
		expect(parsed.eventType).toBe("down");
		expect(parsed.snapshot).toEqual(httpSnapshot);
	});

	test("omits the Webhook-Signature header when no secret is configured", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "webhook", config: { url: WEBHOOK_URL, secret: "" } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(onlyDelivery().headers.has("Webhook-Signature")).toBe(false);
	});

	test("records 'failed' when the webhook endpoint responds with a non-2xx status", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "webhook", config: { url: WEBHOOK_URL, secret: "" } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);
		server.use(webhookHandler(WEBHOOK_URL, 500));

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("failed");
		expect(call.error_message).toBe("Webhook failed with status 500");
	});
});

describe("dispatchAlerts — Slack delivery", () => {
	test("POSTs a formatted message to the Slack webhook URL, including an optional channel", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "slack", config: { webhookUrl: SLACK_URL, channel: "#alerts" } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let delivery = onlyDelivery();
		expect(delivery.url).toBe(SLACK_URL);
		let body = JSON.parse(delivery.body) as { text: string; channel?: string };
		expect(body.channel).toBe("#alerts");
		expect(body.text).toContain("[Uptime Alert] Homepage is DOWN");
	});

	test("omits the channel field when the alert has no channel configured", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "slack", config: { webhookUrl: SLACK_URL } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let body = JSON.parse(onlyDelivery().body) as Record<string, unknown>;
		expect("channel" in body).toBe(false);
	});

	test("records 'failed' when the Slack webhook responds with a non-2xx status", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "slack", config: { webhookUrl: SLACK_URL } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);
		server.use(webhookHandler(SLACK_URL, 404));

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("failed");
		expect(call.error_message).toBe("Slack webhook failed with status 404");
	});
});

describe("dispatchAlerts — Discord delivery", () => {
	test("POSTs a formatted `content` field to the Discord webhook URL", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "discord", config: { webhookUrl: DISCORD_URL } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let delivery = onlyDelivery();
		expect(delivery.url).toBe(DISCORD_URL);
		let body = JSON.parse(delivery.body) as { content: string };
		expect(body.content).toContain("[Uptime Alert] Homepage is DOWN");
	});

	test("records 'failed' when the Discord webhook responds with a non-2xx status", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "discord", config: { webhookUrl: DISCORD_URL } },
		});
		listForMonitorMock.mockImplementation(async () => [alert]);
		server.use(webhookHandler(DISCORD_URL, 503));

		await dispatchAlerts({
			db,
			mailer: makeMailer(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("failed");
		expect(call.error_message).toBe("Discord webhook failed with status 503");
	});
});

/** Minimal `SelectMonitor` fixture; only the fields `notifyHttpResult` reads are set. */
function makeHttpMonitor(overrides: Partial<SelectMonitor> = {}): SelectMonitor {
	return {
		id: "monitor-1",
		created_at: Date.now(),
		updated_at: Date.now(),
		enabled_at: Date.now(),
		next_due_at: null,
		team_id: "team-1",
		author_id: "author-1",
		name: "Homepage",
		url: "https://example.com",
		method: "HEAD",
		expected_status: 200,
		interval_seconds: 60,
		degraded_after_ms: 5000,
		timeout_seconds: 10,
		location_hint: "wnam",
		ssl_monitoring_enabled: false,
		ssl_expiry_warning_days: 30,
		ssl_expires_at: null,
		ssl_issuer: null,
		ssl_last_checked_at: null,
		ssl_status: "unknown",
		last_status: null,
		last_checked_at: null,
		last_response_time_ms: null,
		...overrides,
	};
}

describe("notifyHttpResult", () => {
	test("does not dispatch on the first-ever 'up' result (previousStatus null never counts as a recovery)", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeMailer(), makeHttpMonitor(), null, {
			status: "up",
			responseStatus: 200,
			responseTimeMs: 50,
		});

		expect(listForMonitorMock).not.toHaveBeenCalled();
		expect(recordMock).not.toHaveBeenCalled();
	});

	test("does not dispatch when already up and staying up", async () => {
		let { db } = createTestDatabase();
		await notifyHttpResult(db, makeMailer(), makeHttpMonitor(), "up", {
			status: "up",
			responseStatus: 200,
			responseTimeMs: 50,
		});

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery ('up') event when transitioning from down to up", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeMailer(), makeHttpMonitor(), "down", {
			status: "up",
			responseStatus: 200,
			responseTimeMs: 50,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
		expect(call.monitor_type).toBe("http");
		expect(call.snapshot).toEqual({
			type: "http",
			responseStatus: 200,
			responseTimeMs: 50,
			expectedStatus: 200,
			url: "https://example.com",
		});
	});

	test("dispatches a 'down' event on a down result", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeMailer(), makeHttpMonitor(), "up", {
			status: "down",
			responseStatus: 503,
			responseTimeMs: 30,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("dispatches a 'degraded' event on a degraded result", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeMailer(), makeHttpMonitor(), "up", {
			status: "degraded",
			responseStatus: 200,
			responseTimeMs: 6000,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
	});
});

/** Minimal `SelectDnsMonitor` fixture; only the fields `notifyDnsResult` reads are set. */
function makeDnsMonitor(overrides: Partial<SelectDnsMonitor> = {}): SelectDnsMonitor {
	return {
		id: "dns-monitor-1",
		created_at: Date.now(),
		updated_at: Date.now(),
		team_id: "team-1",
		name: "Domain",
		domain: "example.com",
		interval_seconds: 3600,
		next_due_at: null,
		is_enabled: true,
		last_checked_at: null,
		last_status: null,
		zone_file_imported_at: null,
		...overrides,
	};
}

/** A tracked record row; only the columns a finding is built from are meaningful. */
function makeDnsRecord(overrides: Partial<SelectDnsMonitorRecord> = {}): SelectDnsMonitorRecord {
	return {
		id: crypto.randomUUID(),
		created_at: Date.now(),
		updated_at: Date.now(),
		dns_monitor_id: "dns-monitor-1",
		name: "example.com",
		record_type: "MX",
		value: "10 mx1.example.com",
		source: "resolver",
		is_enabled: true,
		status: "ok",
		first_seen_at: Date.now(),
		last_seen_at: null,
		last_checked_at: null,
		...overrides,
	};
}

/** A sweep result with no findings, for the cases that are about the transition only. */
function dnsResult(status: "ok" | "changed" | "error") {
	return dnsAlertResultFromDiff(status, {
		ok: [],
		missing: [],
		changed: [],
		created: [],
		seen: [],
		absent: [],
	});
}

describe("notifyDnsResult", () => {
	test("does not dispatch on the first-ever 'ok' result", async () => {
		let { db } = createTestDatabase();
		await notifyDnsResult(db, makeMailer(), makeDnsMonitor(), null, dnsResult("ok"));

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery event when a DNS check goes from error to ok", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyDnsResult(db, makeMailer(), makeDnsMonitor(), "error", dnsResult("ok"));

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
		expect(call.monitor_type).toBe("dns");
	});

	test("maps an 'error' result to a 'down' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyDnsResult(db, makeMailer(), makeDnsMonitor(), "ok", dnsResult("error"));

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("maps a 'changed' result to a 'degraded' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyDnsResult(db, makeMailer(), makeDnsMonitor(), "ok", dnsResult("changed"));

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
	});

	test("records the sweep's counters and findings in the snapshot", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyDnsResult(
			db,
			makeMailer(),
			makeDnsMonitor(),
			"ok",
			dnsAlertResultFromDiff("changed", {
				ok: [],
				missing: [makeDnsRecord()],
				changed: [],
				created: [{ name: "example.com", record_type: "MX", value: "20 mx2.example.com" }],
				seen: [],
				absent: [],
			}),
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.snapshot).toEqual({
			type: "dns",
			status: "changed",
			domain: "example.com",
			recordsChanged: 0,
			recordsMissing: 1,
			recordsNew: 1,
			findings: [
				{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
				{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
			],
		});
	});

	/**
	 * The counters are what the reader is told happened; the findings are only the ones
	 * quoted back. A capped list that also capped the counters would understate the event.
	 */
	test("caps the stored findings without capping the counters", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyDnsResult(
			db,
			makeMailer(),
			makeDnsMonitor(),
			"ok",
			dnsAlertResultFromDiff("changed", {
				ok: [],
				missing: Array.from({ length: 9 }, (_value, index) =>
					makeDnsRecord({ name: `host-${index}.example.com`, record_type: "A", value: "1.1.1.1" }),
				),
				changed: [],
				created: [],
				seen: [],
				absent: [],
			}),
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		let snapshot = call.snapshot as Extract<AlertEventSnapshot, { type: "dns" }>;
		expect(snapshot.recordsMissing).toBe(9);
		expect(snapshot.findings).toHaveLength(5);
	});
});

describe("dnsAlertResultFromDiff", () => {
	test("reports the three finding buckets and counts each of them", () => {
		let result = dnsAlertResultFromDiff("changed", {
			ok: [makeDnsRecord({ value: "30 mx3.example.com" })],
			missing: [makeDnsRecord({ name: "mail.example.com", record_type: "A", value: "1.1.1.1" })],
			changed: [
				{
					record: makeDnsRecord({
						name: "www.example.com",
						record_type: "CNAME",
						value: "old.cdn",
					}),
					value: "new.cdn",
				},
			],
			created: [{ name: "example.com", record_type: "TXT", value: "v=spf1 -all" }],
			seen: [makeDnsRecord({ is_enabled: false })],
			absent: [makeDnsRecord({ is_enabled: false })],
		});

		expect(result).toEqual({
			status: "changed",
			recordsMissing: 1,
			recordsChanged: 1,
			recordsNew: 1,
			findings: [
				{ kind: "new", name: "example.com", recordType: "TXT", value: "v=spf1 -all" },
				{ kind: "missing", name: "mail.example.com", recordType: "A", value: "1.1.1.1" },
				{ kind: "changed", name: "www.example.com", recordType: "CNAME", value: "new.cdn" },
			],
		});
	});

	/**
	 * A value edited inside a record set with several values is one `missing` plus one
	 * `new`, and the two have to arrive next to each other or the report reads as two
	 * unrelated events.
	 */
	test("keeps the two halves of an edited record set adjacent", () => {
		let result = dnsAlertResultFromDiff("changed", {
			ok: [],
			missing: [makeDnsRecord()],
			changed: [],
			created: [
				{ name: "zzz.example.com", record_type: "A", value: "1.1.1.1" },
				{ name: "example.com", record_type: "MX", value: "20 mx2.example.com" },
			],
			seen: [],
			absent: [],
		});

		expect(result.findings.map((finding) => `${finding.kind} ${finding.name}`)).toEqual([
			"missing example.com",
			"new example.com",
			"new zzz.example.com",
		]);
	});
});

describe("dnsAlertResultFromRecords", () => {
	test("reports what is outstanding, ignoring records that are resolving", () => {
		let result = dnsAlertResultFromRecords("changed", [
			makeDnsRecord({ status: "ok" }),
			makeDnsRecord({ name: "a.example.com", record_type: "A", status: "missing" }),
			makeDnsRecord({
				name: "b.example.com",
				record_type: "CNAME",
				value: "cdn.example.net",
				status: "changed",
			}),
		]);

		expect(result.recordsMissing).toBe(1);
		expect(result.recordsChanged).toBe(1);
		expect(result.findings.map((finding) => finding.kind)).toEqual(["missing", "changed"]);
	});

	/**
	 * A newly discovered record is stored disabled by construction, so `is_enabled` alone
	 * can't distinguish "awaiting review" from "declined" — both are disabled, and only
	 * `status` tells a new record apart from one missing because it was declined.
	 */
	test("keeps a disabled new record and drops a disabled missing one", () => {
		let result = dnsAlertResultFromRecords("changed", [
			makeDnsRecord({ name: "new.example.com", is_enabled: false, status: "new" }),
			makeDnsRecord({ name: "old.example.com", is_enabled: false, status: "missing" }),
		]);

		expect(result.recordsNew).toBe(1);
		expect(result.recordsMissing).toBe(0);
		expect(result.findings).toEqual([
			{ kind: "new", name: "new.example.com", recordType: "MX", value: "10 mx1.example.com" },
		]);
	});
});

/** Minimal `SelectTcpMonitor` fixture; only the fields `notifyTcpResult` reads are set. */
function makeTcpMonitor(overrides: Partial<SelectTcpMonitor> = {}): SelectTcpMonitor {
	return {
		id: "tcp-monitor-1",
		created_at: Date.now(),
		updated_at: Date.now(),
		team_id: "team-1",
		name: "Database",
		host: "db.example.com",
		port: 5432,
		timeout_ms: 5000,
		interval_seconds: 60,
		next_due_at: null,
		is_enabled: true,
		last_checked_at: null,
		last_status: null,
		last_response_time_ms: null,
		...overrides,
	};
}

describe("notifyTcpResult", () => {
	test("does not dispatch on the first-ever 'up' result", async () => {
		let { db } = createTestDatabase();
		await notifyTcpResult(db, makeMailer(), makeTcpMonitor(), null, {
			status: "up",
			responseTimeMs: 10,
		});

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery event when transitioning from down to up", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyTcpResult(db, makeMailer(), makeTcpMonitor(), "down", {
			status: "up",
			responseTimeMs: 10,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
		expect(call.monitor_type).toBe("tcp");
	});

	test("maps a 'down' result to a 'down' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyTcpResult(db, makeMailer(), makeTcpMonitor(), "up", {
			status: "down",
			responseTimeMs: null,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("maps a 'timeout' result to a 'degraded' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyTcpResult(db, makeMailer(), makeTcpMonitor(), "up", {
			status: "timeout",
			responseTimeMs: null,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
	});
});

/** Minimal `SelectCronJobMonitor` fixture; only the fields `notifyCronJobResult` reads are set. */
function makeCronJobMonitor(overrides: Partial<SelectCronJobMonitor> = {}): SelectCronJobMonitor {
	return {
		id: "cron-monitor-1",
		created_at: Date.now(),
		updated_at: Date.now(),
		team_id: "team-1",
		name: "Nightly backup",
		description: null,
		cron_expression: "0 2 * * *",
		grace_period_seconds: 300,
		timezone: "UTC",
		status: "new",
		alert_on_late: false,
		last_ping_at: null,
		next_expected_at: null,
		enabled_at: null,
		...overrides,
	};
}

describe("notifyCronJobResult", () => {
	test("never dispatches when the new status is 'new'", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeMailer(), makeCronJobMonitor(), "missed", "new");

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("does not dispatch a first-ever 'healthy' status (previousStatus null)", async () => {
		let { db } = createTestDatabase();
		await notifyCronJobResult(db, makeMailer(), makeCronJobMonitor(), null, "healthy");

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("a transition from 'new' to 'healthy' never counts as a recovery", async () => {
		let { db } = createTestDatabase();
		await notifyCronJobResult(db, makeMailer(), makeCronJobMonitor(), "new", "healthy");

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery event transitioning from 'late' to 'healthy'", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(
			db,
			makeMailer(),
			makeCronJobMonitor({ alert_on_late: true }),
			"late",
			"healthy",
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
		expect(call.monitor_type).toBe("cron");
	});

	test("maps 'missed' to a 'down' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeMailer(), makeCronJobMonitor(), "healthy", "missed");

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("maps 'late' to a 'degraded' event and formats last-ping/next-expected as ISO strings", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);
		let lastPingAt = Date.UTC(2026, 0, 1, 0, 0, 0);
		let nextExpectedAt = Date.UTC(2026, 0, 2, 0, 0, 0);

		await notifyCronJobResult(
			db,
			makeMailer(),
			makeCronJobMonitor({
				alert_on_late: true,
				last_ping_at: lastPingAt,
				next_expected_at: nextExpectedAt,
			}),
			"healthy",
			"late",
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
		expect((call.snapshot as { lastPingAt: string }).lastPingAt).toBe(
			new Date(lastPingAt).toISOString(),
		);
		expect((call.snapshot as { nextExpectedAt: string }).nextExpectedAt).toBe(
			new Date(nextExpectedAt).toISOString(),
		);
	});

	test("does not dispatch a 'late' transition when the monitor's alert_on_late is off", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyCronJobResult(
			db,
			makeMailer(),
			makeCronJobMonitor({ alert_on_late: false }),
			"healthy",
			"late",
		);

		expect(listForMonitorMock).not.toHaveBeenCalled();
		expect(recordMock).not.toHaveBeenCalled();
	});

	test("still dispatches 'missed' when alert_on_late is off", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyCronJobResult(
			db,
			makeMailer(),
			makeCronJobMonitor({ alert_on_late: false }),
			"late",
			"missed",
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("dispatches nothing recovering from a suppressed 'late'", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyCronJobResult(
			db,
			makeMailer(),
			makeCronJobMonitor({ alert_on_late: false }),
			"late",
			"healthy",
		);

		expect(recordMock).not.toHaveBeenCalled();
	});

	test("formats a null last-ping/next-expected as null in the snapshot", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeMailer(), makeCronJobMonitor(), "healthy", "missed");

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		let snapshot = call.snapshot as { lastPingAt: string | null; nextExpectedAt: string | null };
		expect(snapshot.lastPingAt).toBeNull();
		expect(snapshot.nextExpectedAt).toBeNull();
	});
});

/** Minimal `SelectFlowMonitor` fixture; only the fields `notifyFlowResult` reads are set. */
function makeFlowMonitor(overrides: Partial<SelectFlowMonitor> = {}): SelectFlowMonitor {
	return {
		id: "flow-monitor-1",
		created_at: Date.now(),
		updated_at: Date.now(),
		team_id: "team-1",
		name: "Checkout",
		source: "",
		interval_seconds: 3_600,
		next_due_at: null,
		is_enabled: true,
		last_checked_at: null,
		last_status: null,
		...overrides,
	};
}

/** One flow run's history row, defaulting to the failure the alert is expected to quote. */
function makeFlowResult(overrides: Partial<SelectFlowMonitorResult> = {}): SelectFlowMonitorResult {
	return {
		id: "flow-result-1",
		flow_monitor_id: "flow-monitor-1",
		status: "down",
		tests_total: 4,
		tests_passed: 2,
		tests_failed: 1,
		requests_made: 3,
		failed_test: "checkout accepts the coupon",
		failed_at_line: 27,
		failure_detail: "expected status 200, got 500",
		duration_ms: 1840,
		error_message: null,
		checked_at: Date.now(),
		...overrides,
	};
}

describe("notifyFlowResult", () => {
	test("does not dispatch on the first-ever 'up' result", async () => {
		let { db } = createTestDatabase();
		await notifyFlowResult(
			db,
			makeMailer(),
			makeFlowMonitor(),
			null,
			flowAlertResultFromResult("up", makeFlowResult({ status: "up" })),
		);

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	/**
	 * An `error` is this app failing to find out, not the customer's flow breaking, so it
	 * reaches nobody — the whole reason the two statuses are kept apart (ADR-027 §1).
	 */
	test("never dispatches an 'error' result, whatever it follows", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		for (let previous of ["up", "down", "error", null] as const) {
			await notifyFlowResult(
				db,
				makeMailer(),
				makeFlowMonitor(),
				previous,
				flowAlertResultFromResult("error", makeFlowResult({ status: "error" })),
			);
		}

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a 'down' event on a failed assertion", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyFlowResult(
			db,
			makeMailer(),
			makeFlowMonitor(),
			"up",
			flowAlertResultFromResult("down", makeFlowResult()),
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
		expect(call.monitor_type).toBe("flow");
	});

	test("dispatches a recovery event coming back up from down", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyFlowResult(
			db,
			makeMailer(),
			makeFlowMonitor(),
			"down",
			flowAlertResultFromResult("up", makeFlowResult({ status: "up" })),
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
	});

	/** Nobody was told about the error, so nobody is told it ended. */
	test("stays silent coming back up from an error", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyFlowResult(
			db,
			makeMailer(),
			makeFlowMonitor(),
			"error",
			flowAlertResultFromResult("up", makeFlowResult({ status: "up" })),
		);

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("records the failing assertion, its line, and the counters in the snapshot", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [makeAlert()]);

		await notifyFlowResult(
			db,
			makeMailer(),
			makeFlowMonitor(),
			"up",
			flowAlertResultFromResult("down", makeFlowResult()),
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.snapshot).toEqual({
			type: "flow",
			status: "down",
			testsTotal: 4,
			testsPassed: 2,
			testsFailed: 1,
			failedTest: "checkout accepts the coupon",
			failedAtLine: 27,
			failureDetail: "expected status 200, got 500",
			durationMs: 1840,
		});
	});

	test("quotes the failing assertion in the delivered body", async () => {
		let { db } = createTestDatabase();
		listForMonitorMock.mockImplementation(async () => [
			makeAlert({ config: { strategy: "webhook", config: { url: WEBHOOK_URL, secret: "" } } }),
		]);

		await notifyFlowResult(
			db,
			makeMailer(),
			makeFlowMonitor(),
			"up",
			flowAlertResultFromResult("down", makeFlowResult()),
		);

		let body = JSON.parse(onlyDelivery().body) as { message: string };
		expect(body.message).toContain("Tests: 2 of 4 passed");
		expect(body.message).toContain("Failed test: checkout accepts the coupon (line 27)");
		expect(body.message).toContain("expected status 200, got 500");
	});
});

describe("flowAlertResultFromResult", () => {
	test("reads the run's counters and its first failure off the history row", () => {
		expect(flowAlertResultFromResult("down", makeFlowResult())).toEqual({
			status: "down",
			testsTotal: 4,
			testsPassed: 2,
			testsFailed: 1,
			failedTest: "checkout accepts the coupon",
			failedAtLine: 27,
			failureDetail: "expected status 200, got 500",
			durationMs: 1840,
		});
	});

	/** A redelivery outliving the history row still has a transition worth reporting. */
	test("reports the transition alone when the history row is already gone", () => {
		expect(flowAlertResultFromResult("down", undefined)).toEqual({
			status: "down",
			testsTotal: 0,
			testsPassed: 0,
			testsFailed: 0,
			failedTest: null,
			failedAtLine: null,
			failureDetail: null,
			durationMs: null,
		});
	});
});

describe("notifySslResult", () => {
	test("does not dispatch when shouldAlertOnSslStatus says not to (e.g. a healthy, non-expiring cert)", async () => {
		let { db } = createTestDatabase();
		await notifySslResult(db, makeMailer(), makeHttpMonitor(), "valid", 90);

		expect(listForMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a 'down' event for an expired certificate", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(db, makeMailer(), makeHttpMonitor(), "expired", -3);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
		expect(call.monitor_type).toBe("ssl");
	});

	test("dispatches a 'degraded' event for a certificate expiring within a warning threshold", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(db, makeMailer(), makeHttpMonitor(), "expiring", 7);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
	});

	test("derives the hostname from the monitor's URL", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(
			db,
			makeMailer(),
			makeHttpMonitor({ url: "https://sub.example.com/path" }),
			"expired",
			-1,
		);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect((call.snapshot as { hostname: string }).hostname).toBe("sub.example.com");
	});

	test("falls back to the raw URL as the hostname when it doesn't parse as a URL", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(db, makeMailer(), makeHttpMonitor({ url: "not-a-url" }), "expired", -1);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect((call.snapshot as { hostname: string }).hostname).toBe("not-a-url");
	});
});

/**
 * The predicates the sweeps use to decide whether a transition is worth enqueuing a
 * `notify` message for. They're the same rules the `notify*` helpers above apply, so these
 * cases pin the policy down in one place rather than only through dispatch side effects.
 */
describe("shouldNotifyTcpResult", () => {
	test("alerts on every non-up status", () => {
		expect(shouldNotifyTcpResult(null, "down")).toBe(true);
		expect(shouldNotifyTcpResult("up", "timeout")).toBe(true);
		expect(shouldNotifyTcpResult("down", "down")).toBe(true);
	});

	test("alerts on up only as a recovery from a non-up status", () => {
		expect(shouldNotifyTcpResult("timeout", "up")).toBe(true);
		expect(shouldNotifyTcpResult("up", "up")).toBe(false);
		expect(shouldNotifyTcpResult(null, "up")).toBe(false);
	});
});

describe("shouldNotifyDnsResult", () => {
	test("alerts on every non-ok status", () => {
		expect(shouldNotifyDnsResult(null, "error")).toBe(true);
		expect(shouldNotifyDnsResult("ok", "changed")).toBe(true);
	});

	test("alerts on ok only as a recovery from a non-ok status", () => {
		expect(shouldNotifyDnsResult("changed", "ok")).toBe(true);
		expect(shouldNotifyDnsResult("ok", "ok")).toBe(false);
		expect(shouldNotifyDnsResult(null, "ok")).toBe(false);
	});
});

describe("shouldNotifyFlowResult", () => {
	test("alerts on every failed assertion", () => {
		expect(shouldNotifyFlowResult(null, "down")).toBe(true);
		expect(shouldNotifyFlowResult("up", "down")).toBe(true);
		expect(shouldNotifyFlowResult("down", "down")).toBe(true);
		expect(shouldNotifyFlowResult("error", "down")).toBe(true);
	});

	test("never alerts on an error, which is this app failing to find out", () => {
		expect(shouldNotifyFlowResult(null, "error")).toBe(false);
		expect(shouldNotifyFlowResult("up", "error")).toBe(false);
		expect(shouldNotifyFlowResult("down", "error")).toBe(false);
	});

	test("alerts on up only as a recovery from a down nobody was left waiting on", () => {
		expect(shouldNotifyFlowResult("down", "up")).toBe(true);
		expect(shouldNotifyFlowResult("error", "up")).toBe(false);
		expect(shouldNotifyFlowResult("up", "up")).toBe(false);
		expect(shouldNotifyFlowResult(null, "up")).toBe(false);
	});
});

describe("shouldNotifyCronJobResult", () => {
	let alerting = { alert_on_late: true };
	/** The schema default: late warnings declined. */
	let silent = { alert_on_late: false };

	test("alerts on late only when the monitor opted in", () => {
		expect(shouldNotifyCronJobResult("healthy", "late", alerting)).toBe(true);
		expect(shouldNotifyCronJobResult("healthy", "late", silent)).toBe(false);
	});

	test("alerts on missed regardless of alert_on_late", () => {
		expect(shouldNotifyCronJobResult("late", "missed", silent)).toBe(true);
		expect(shouldNotifyCronJobResult("healthy", "missed", silent)).toBe(true);
		expect(shouldNotifyCronJobResult("late", "missed", alerting)).toBe(true);
	});

	test("never alerts on a move to new", () => {
		expect(shouldNotifyCronJobResult("missed", "new", alerting)).toBe(false);
	});

	test("alerts on healthy only as a recovery from late or missed", () => {
		expect(shouldNotifyCronJobResult("missed", "healthy", silent)).toBe(true);
		expect(shouldNotifyCronJobResult("healthy", "healthy", silent)).toBe(false);
		expect(shouldNotifyCronJobResult("new", "healthy", silent)).toBe(false);
		expect(shouldNotifyCronJobResult(null, "healthy", silent)).toBe(false);
	});

	/**
	 * A monitor flapping healthy -> late -> healthy every minute, with late warnings
	 * declined, once delivered a recovery notice for every flap with no down notice
	 * behind any of them.
	 */
	test("stays silent recovering from a late the monitor was never notified about", () => {
		expect(shouldNotifyCronJobResult("late", "healthy", silent)).toBe(false);
	});

	test("alerts recovering from a late the monitor was notified about", () => {
		expect(shouldNotifyCronJobResult("late", "healthy", alerting)).toBe(true);
	});

	test("alerts recovering from missed whether or not late warnings were declined", () => {
		expect(shouldNotifyCronJobResult("missed", "healthy", silent)).toBe(true);
		expect(shouldNotifyCronJobResult("missed", "healthy", alerting)).toBe(true);
	});
});
