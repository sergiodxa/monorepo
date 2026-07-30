/**
 * Unit tests for the alert-dispatch pipeline: maintenance-window suppression,
 * candidate resolution (monitor-specific + team-wide for HTTP/SSL, team-wide-only for
 * everything else), cooldown skipping, delivery success/failure recording, the
 * per-strategy delivery mechanics (email/webhook/Slack/Discord, including the webhook
 * HMAC signature), and the recovery/notify-on-recovery branching in every `notify*`
 * helper. `Alert` and `AlertEvent` are mocked because their `config`/`snapshot`
 * columns are untyped JSON text columns this test harness's SQLite adapter can't bind
 * object values into — mocking isolates the orchestration logic in `alerts.ts` (this
 * file's subject) from that unrelated data-layer gap. `MaintenanceWindow` has no JSON
 * columns, so suppression is exercised against the real in-memory database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

import type { Resend } from "resend";

import type {
	AlertEventSnapshot,
	SelectAlert,
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

let listForHttpMonitorMock = mock(async (..._args: unknown[]) => [] as SelectAlert[]);
let listTeamWideMock = mock(async (..._args: unknown[]) => [] as SelectAlert[]);
let recordMock = mock(async (..._args: unknown[]) => ({}) as unknown);
let isInCooldownMock = mock(async (..._args: unknown[]) => false);

/**
 * `bun:test`'s `mock.module` patches the shared module registry for the lifetime of
 * the whole `bun test` process (it's a live rebinding, not scoped to this file), and
 * `beforeAll`/`afterAll` don't actually bound that window the way they look like they
 * should — `bun test` can interleave another file's test bodies with this file's
 * mocked window, so a same-process file that imports the real `~/app/data/alert`
 * (e.g. a page controller's own test) can observe the mock. Subclassing the real
 * `Alert`/`AlertEvent` classes (rather than object-spreading them) means any other
 * file caught in that window still gets every real static method it needs — object
 * spread silently drops class static methods since they're non-enumerable, which is
 * exactly what caused the two overridden methods to look like the only ones that
 * existed at all. Only `listForHttpMonitor`/`listTeamWide` (and
 * `record`/`isInCooldown` on `AlertEvent`) are actually faked here.
 */
let realAlertModule = await import("~/app/data/alert");
let realAlertEventModule = await import("~/app/data/alert-event");

beforeAll(async () => {
	class FakeAlert extends realAlertModule.default {
		static override listForHttpMonitor = listForHttpMonitorMock;
		static override listTeamWide = listTeamWideMock;
	}
	class FakeAlertEvent extends realAlertEventModule.default {
		static override record =
			recordMock as unknown as (typeof realAlertEventModule)["default"]["record"];
		static override isInCooldown = isInCooldownMock;
	}

	await mock.module("~/app/data/alert", () => ({ default: FakeAlert }));
	await mock.module("~/app/data/alert-event", () => ({ default: FakeAlertEvent }));
});

afterAll(async () => {
	await mock.module("~/app/data/alert", () => realAlertModule);
	await mock.module("~/app/data/alert-event", () => realAlertEventModule);
});

let { createTestDatabase } = await import("~/app/lib/test/db");
let { teams, monitors, maintenanceWindows } = await import("~/database/schema");
let {
	dashboardUrl,
	dispatchAlerts,
	notifyCronJobResult,
	notifyDnsResult,
	notifyHttpResult,
	notifySslResult,
	notifyTcpResult,
} = await import("~/app/services/alerts");

type Db = Awaited<ReturnType<typeof createTestDatabase>>["db"];

/** Builds a fixture alert row; defaults to an unconditional, cooldown-free email alert. */
function makeAlert(overrides: Partial<SelectAlert> = {}): SelectAlert {
	return {
		id: crypto.randomUUID(),
		created_at: Date.now(),
		updated_at: Date.now(),
		team_id: "team-1",
		monitor_id: null,
		name: "Alert",
		notify_on_recovery: true,
		cooldown_minutes: 0,
		config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "" } },
		...overrides,
	};
}

/** A working `Resend`-shaped stub whose `.emails.send` succeeds unless overridden. */
function makeResend(
	sendImpl: (...args: unknown[]) => Promise<{ data: unknown; error: unknown }> = mock(
		async (..._args: unknown[]) => ({ data: { id: "email_1" }, error: null }),
	),
): Resend {
	return { emails: { send: sendImpl } } as unknown as Resend;
}

/** A minimal HTTP snapshot fixture. */
let httpSnapshot: AlertEventSnapshot = {
	type: "http",
	responseStatus: 500,
	responseTimeMs: 1200,
	expectedStatus: 200,
	url: "https://example.com",
};

beforeEach(() => {
	listForHttpMonitorMock.mockClear();
	listTeamWideMock.mockClear();
	recordMock.mockClear();
	isInCooldownMock.mockClear();
	listForHttpMonitorMock.mockImplementation(async () => []);
	listTeamWideMock.mockImplementation(async () => []);
	recordMock.mockImplementation(async () => ({}));
	isInCooldownMock.mockImplementation(async () => false);
	globalThis.fetch = mock(
		async (..._args: unknown[]) => new Response(null, { status: 200 }),
	) as unknown as typeof fetch;
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
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForHttpMonitorMock).not.toHaveBeenCalled();
		expect(listTeamWideMock).not.toHaveBeenCalled();
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
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForHttpMonitorMock).toHaveBeenCalledTimes(1);
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
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForHttpMonitorMock).toHaveBeenCalledTimes(1);
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
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForHttpMonitorMock).not.toHaveBeenCalled();
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
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "dns",
			monitorName: "Domain",
			eventType: "down",
			snapshot: {
				type: "dns",
				status: "error",
				resolvedValue: null,
				domain: "x.com",
				recordType: "A",
			},
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listTeamWideMock).toHaveBeenCalledTimes(1);
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
			resend: makeResend(),
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

		expect(listForHttpMonitorMock).not.toHaveBeenCalled();
	});
});

describe("dispatchAlerts — candidate resolution", () => {
	test("resolves monitor-specific + team-wide alerts for an HTTP monitor", async () => {
		let { db } = createTestDatabase();

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(listForHttpMonitorMock).toHaveBeenCalledWith(db, "team-1", "monitor-1");
		expect(listTeamWideMock).not.toHaveBeenCalled();
	});

	test("resolves only team-wide alerts for a DNS, TCP, or cron-job monitor", async () => {
		let { db } = createTestDatabase();

		for (let monitorType of ["dns", "tcp", "cron"] as const) {
			listTeamWideMock.mockClear();
			listForHttpMonitorMock.mockClear();

			await dispatchAlerts({
				db,
				resend: makeResend(),
				teamId: "team-1",
				monitorId: "monitor-1",
				monitorType,
				monitorName: "Some monitor",
				eventType: "down",
				snapshot: httpSnapshot,
				dashboardUrl: "https://uptime.sergiodxa.com/x",
			});

			expect(listTeamWideMock).toHaveBeenCalledWith(db, "team-1");
			expect(listForHttpMonitorMock).not.toHaveBeenCalled();
		}
	});
});

describe("dispatchAlerts — notify_on_recovery filtering", () => {
	test("an 'up' event only delivers to alerts with notify_on_recovery enabled", async () => {
		let { db } = createTestDatabase();
		let recovers = makeAlert({ id: "recovers", notify_on_recovery: true });
		let silent = makeAlert({ id: "silent", notify_on_recovery: false });
		listForHttpMonitorMock.mockImplementation(async () => [recovers, silent]);

		await dispatchAlerts({
			db,
			resend: makeResend(),
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
		listForHttpMonitorMock.mockImplementation(async () => [a, b]);

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(isInCooldownMock).toHaveBeenCalledTimes(2);
	});
});

describe("dispatchAlerts — cooldown", () => {
	test("skips delivery and records skipped_cooldown when the alert is in cooldown", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({ cooldown_minutes: 30 });
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		isInCooldownMock.mockImplementation(async () => true);
		let send = mock(async (..._args: unknown[]) => ({ data: { id: "email_1" }, error: null }));

		await dispatchAlerts({
			db,
			resend: makeResend(send),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(send).not.toHaveBeenCalled();
		expect(recordMock).toHaveBeenCalledTimes(1);
		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.status).toBe("skipped_cooldown");
		expect(call.error_message).toBeNull();
		expect(call.alert_id).toBe(alert.id);
	});

	test("delivers and checks cooldown per-alert-id/monitor/event-type with the alert's own cooldown_minutes", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({ id: "alert-7", cooldown_minutes: 15 });
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			resend: makeResend(),
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

describe("dispatchAlerts — delivery outcome recording", () => {
	test("records 'sent' with a null error_message on a successful delivery", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			resend: makeResend(),
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

	test("records 'failed' with the thrown error's message when Resend returns an error", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		let send = mock(async (..._args: unknown[]) => ({
			data: null,
			error: { name: "validation_error", message: "bad recipient" },
		}));

		await dispatchAlerts({
			db,
			resend: makeResend(send),
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
			config: { strategy: "slack", config: { webhookUrl: "https://hooks.slack.example/abc" } },
		});
		listForHttpMonitorMock.mockImplementation(async () => [failing, succeeding]);
		let send = mock(async (..._args: unknown[]) => ({
			data: null,
			error: { name: "x", message: "boom" },
		}));

		await dispatchAlerts({
			db,
			resend: makeResend(send),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(recordMock).toHaveBeenCalledTimes(2);
		let statuses = recordMock.mock.calls.map((call) => (call[1] as Record<string, unknown>).status);
		expect(statuses.sort()).toEqual(["failed", "sent"]);
	});

	test("email subject is prefixed with the alert's configured subjectPrefix", async () => {
		let { db } = createTestDatabase();
		let send = mock(async (..._args: unknown[]) => ({ data: { id: "email_1" }, error: null }));
		let alert = makeAlert({
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "[PROD]" } },
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await dispatchAlerts({
			db,
			resend: makeResend(send),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let call = send.mock.calls[0]?.[0] as {
			subject: string;
			to: string;
			from: string;
			replyTo: string;
		};
		expect(call.subject).toBe("[PROD] [Uptime Alert] Homepage is DOWN");
		expect(call.to).toBe("ops@example.com");
		expect(call.from).toBe("Uptime <no-reply@uptime.sergiodxa.com>");
		expect(call.replyTo).toBe("hello@sergiodxa.com");
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
			config: {
				strategy: "webhook",
				config: { url: "https://hooks.example.com/uptime", secret: "shh" },
			},
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		let fetchMock = mock(async (..._args: unknown[]) => new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://hooks.example.com/uptime");
		expect(init.method).toBe("POST");
		let headers = init.headers as Headers;
		expect(headers.get("Content-Type")).toBe("application/json");

		let body = init.body as string;
		let expectedSignature = `sha256=${await computeHmacSha256Hex("shh", body)}`;
		expect(headers.get("Webhook-Signature")).toBe(expectedSignature);

		let parsed = JSON.parse(body) as Record<string, unknown>;
		expect(parsed.monitorId).toBe("monitor-1");
		expect(parsed.monitorType).toBe("http");
		expect(parsed.eventType).toBe("down");
		expect(parsed.snapshot).toEqual(httpSnapshot);
	});

	test("omits the Webhook-Signature header when no secret is configured", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: {
				strategy: "webhook",
				config: { url: "https://hooks.example.com/uptime", secret: "" },
			},
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		let fetchMock = mock(async (..._args: unknown[]) => new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let headers = init.headers as Headers;
		expect(headers.has("Webhook-Signature")).toBe(false);
	});

	test("records 'failed' when the webhook endpoint responds with a non-2xx status", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: {
				strategy: "webhook",
				config: { url: "https://hooks.example.com/uptime", secret: "" },
			},
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(null, { status: 500 }),
		) as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
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
			config: {
				strategy: "slack",
				config: { webhookUrl: "https://hooks.slack.example/abc", channel: "#alerts" },
			},
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		let fetchMock = mock(async (..._args: unknown[]) => new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://hooks.slack.example/abc");
		let body = JSON.parse(init.body as string) as { text: string; channel?: string };
		expect(body.channel).toBe("#alerts");
		expect(body.text).toContain("[Uptime Alert] Homepage is DOWN");
	});

	test("omits the channel field when the alert has no channel configured", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "slack", config: { webhookUrl: "https://hooks.slack.example/abc" } },
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		let fetchMock = mock(async (..._args: unknown[]) => new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect("channel" in body).toBe(false);
	});

	test("records 'failed' when the Slack webhook responds with a non-2xx status", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: { strategy: "slack", config: { webhookUrl: "https://hooks.slack.example/abc" } },
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(null, { status: 404 }),
		) as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
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
			config: {
				strategy: "discord",
				config: { webhookUrl: "https://discord.example/webhooks/abc" },
			},
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		let fetchMock = mock(async (..._args: unknown[]) => new Response(null, { status: 200 }));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
			teamId: "team-1",
			monitorId: "monitor-1",
			monitorType: "http",
			monitorName: "Homepage",
			eventType: "down",
			snapshot: httpSnapshot,
			dashboardUrl: "https://uptime.sergiodxa.com/x",
		});

		let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://discord.example/webhooks/abc");
		let body = JSON.parse(init.body as string) as { content: string };
		expect(body.content).toContain("[Uptime Alert] Homepage is DOWN");
	});

	test("records 'failed' when the Discord webhook responds with a non-2xx status", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert({
			config: {
				strategy: "discord",
				config: { webhookUrl: "https://discord.example/webhooks/abc" },
			},
		});
		listForHttpMonitorMock.mockImplementation(async () => [alert]);
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(null, { status: 503 }),
		) as unknown as typeof fetch;

		await dispatchAlerts({
			db,
			resend: makeResend(),
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
		...overrides,
	};
}

describe("notifyHttpResult", () => {
	test("does not dispatch on the first-ever 'up' result (previousStatus null never counts as a recovery)", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeResend(), makeHttpMonitor(), null, {
			status: "up",
			responseStatus: 200,
			responseTimeMs: 50,
		});

		expect(listForHttpMonitorMock).not.toHaveBeenCalled();
		expect(recordMock).not.toHaveBeenCalled();
	});

	test("does not dispatch when already up and staying up", async () => {
		let { db } = createTestDatabase();
		await notifyHttpResult(db, makeResend(), makeHttpMonitor(), "up", {
			status: "up",
			responseStatus: 200,
			responseTimeMs: 50,
		});

		expect(listForHttpMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery ('up') event when transitioning from down to up", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeResend(), makeHttpMonitor(), "down", {
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
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeResend(), makeHttpMonitor(), "up", {
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
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifyHttpResult(db, makeResend(), makeHttpMonitor(), "up", {
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
		record_type: "A",
		expected_value: null,
		interval_seconds: 3600,
		is_enabled: true,
		last_checked_at: null,
		last_status: null,
		last_value: null,
		...overrides,
	};
}

describe("notifyDnsResult", () => {
	test("does not dispatch on the first-ever 'ok' result", async () => {
		let { db } = createTestDatabase();
		await notifyDnsResult(db, makeResend(), makeDnsMonitor(), null, {
			status: "ok",
			resolvedValue: "1.2.3.4",
			responseTimeMs: 20,
		});

		expect(listTeamWideMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery event when a DNS check goes from error to ok", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyDnsResult(db, makeResend(), makeDnsMonitor(), "error", {
			status: "ok",
			resolvedValue: "1.2.3.4",
			responseTimeMs: 20,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
		expect(call.monitor_type).toBe("dns");
	});

	test("maps an 'error' result to a 'down' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyDnsResult(db, makeResend(), makeDnsMonitor(), "ok", {
			status: "error",
			resolvedValue: null,
			responseTimeMs: 20,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("maps a 'changed' result to a 'degraded' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyDnsResult(db, makeResend(), makeDnsMonitor(), "ok", {
			status: "changed",
			resolvedValue: "9.9.9.9",
			responseTimeMs: 20,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
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
		await notifyTcpResult(db, makeResend(), makeTcpMonitor(), null, {
			status: "up",
			responseTimeMs: 10,
		});

		expect(listTeamWideMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery event when transitioning from down to up", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyTcpResult(db, makeResend(), makeTcpMonitor(), "down", {
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
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyTcpResult(db, makeResend(), makeTcpMonitor(), "up", {
			status: "down",
			responseTimeMs: null,
		});

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("maps a 'timeout' result to a 'degraded' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyTcpResult(db, makeResend(), makeTcpMonitor(), "up", {
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
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeResend(), makeCronJobMonitor(), "missed", "new");

		expect(listTeamWideMock).not.toHaveBeenCalled();
	});

	test("does not dispatch a first-ever 'healthy' status (previousStatus null)", async () => {
		let { db } = createTestDatabase();
		await notifyCronJobResult(db, makeResend(), makeCronJobMonitor(), null, "healthy");

		expect(listTeamWideMock).not.toHaveBeenCalled();
	});

	test("a transition from 'new' to 'healthy' never counts as a recovery", async () => {
		let { db } = createTestDatabase();
		await notifyCronJobResult(db, makeResend(), makeCronJobMonitor(), "new", "healthy");

		expect(listTeamWideMock).not.toHaveBeenCalled();
	});

	test("dispatches a recovery event transitioning from 'late' to 'healthy'", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeResend(), makeCronJobMonitor(), "late", "healthy");

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("up");
		expect(call.monitor_type).toBe("cron");
	});

	test("maps 'missed' to a 'down' event", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeResend(), makeCronJobMonitor(), "healthy", "missed");

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
	});

	test("maps 'late' to a 'degraded' event and formats last-ping/next-expected as ISO strings", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);
		let lastPingAt = Date.UTC(2026, 0, 1, 0, 0, 0);
		let nextExpectedAt = Date.UTC(2026, 0, 2, 0, 0, 0);

		await notifyCronJobResult(
			db,
			makeResend(),
			makeCronJobMonitor({ last_ping_at: lastPingAt, next_expected_at: nextExpectedAt }),
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

	test("formats a null last-ping/next-expected as null in the snapshot", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listTeamWideMock.mockImplementation(async () => [alert]);

		await notifyCronJobResult(db, makeResend(), makeCronJobMonitor(), "healthy", "missed");

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		let snapshot = call.snapshot as { lastPingAt: string | null; nextExpectedAt: string | null };
		expect(snapshot.lastPingAt).toBeNull();
		expect(snapshot.nextExpectedAt).toBeNull();
	});
});

describe("notifySslResult", () => {
	test("does not dispatch when shouldAlertOnSslStatus says not to (e.g. a healthy, non-expiring cert)", async () => {
		let { db } = createTestDatabase();
		await notifySslResult(db, makeResend(), makeHttpMonitor(), "valid", 90);

		expect(listForHttpMonitorMock).not.toHaveBeenCalled();
	});

	test("dispatches a 'down' event for an expired certificate", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(db, makeResend(), makeHttpMonitor(), "expired", -3);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("down");
		expect(call.monitor_type).toBe("ssl");
	});

	test("dispatches a 'degraded' event for a certificate expiring within a warning threshold", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(db, makeResend(), makeHttpMonitor(), "expiring", 7);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(call.event_type).toBe("degraded");
	});

	test("derives the hostname from the monitor's URL", async () => {
		let { db } = createTestDatabase();
		let alert = makeAlert();
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(
			db,
			makeResend(),
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
		listForHttpMonitorMock.mockImplementation(async () => [alert]);

		await notifySslResult(db, makeResend(), makeHttpMonitor({ url: "not-a-url" }), "expired", -1);

		let call = recordMock.mock.calls[0]?.[1] as Record<string, unknown>;
		expect((call.snapshot as { hostname: string }).hostname).toBe("not-a-url");
	});
});
