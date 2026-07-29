/**
 * Unit tests for the `Monitor` data-access model: CRUD scoped to a team, the SSL
 * cross-team listing, and — most importantly — the raw-SQL `findDue` query the
 * scheduler runs every minute. `findDue`'s join/aggregation logic can't be
 * typo-checked by the type system, so it gets dedicated coverage for the
 * never-checked, interval-not-elapsed, interval-elapsed, and disabled-monitor
 * branches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Database } from "remix/data-table";

import { createTestDatabase } from "~/app/lib/test/db";
import {
	cronJobMonitors,
	cronJobPings,
	dnsMonitorResults,
	dnsMonitors,
	monitorDailyStats,
	monitorResults,
	monitors,
	tcpMonitorResults,
	tcpMonitors,
	teams,
} from "~/database/schema";

/** The message body `Monitor.ping` passes to `env.QUEUE.send(...)`. */
interface PingQueueMessage {
	type: string;
	id: string;
	monitorId: string;
	scheduledAt: number;
}

/**
 * `Monitor.ping` calls `env.QUEUE.send(...)`, a queue binding with nothing to assert on
 * besides "it was called with the right message shape" — stub it so importing the
 * module doesn't crash and so `ping` can assert on the call.
 */
let queueSend = mock(async (_message: PingQueueMessage) => {});
mock.module("cloudflare:workers", () => ({ env: { QUEUE: { send: queueSend } } }));

let { PolarClient } = await import("@pkg/polar");
let { default: Monitor } = await import("~/app/data/monitor");

/** A `PolarClient` whose subscription lookup is forced to `hasActiveSubscription`. */
function fakePolar(hasActiveSubscription: boolean) {
	let client = new PolarClient({ accessToken: "t" });
	(
		client as unknown as {
			hasActiveSubscription: InstanceType<typeof PolarClient>["hasActiveSubscription"];
		}
	).hasActiveSubscription = async () => hasActiveSubscription;
	return client;
}

/** Inserts a team row so `findDue`'s join to `teams` has an owner to resolve. */
async function createTeam(db: Database, overrides: Partial<{ ownerId: string }> = {}) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: overrides.ownerId ?? crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

describe("Monitor.create", () => {
	test("creates a monitor for a team, enabled immediately", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		expect(monitor.team_id).toBe(team.id);
		expect(monitor.author_id).toBe("author-1");
		expect(monitor.name).toBe("Homepage");
		expect(monitor.url).toBe("https://example.com");
		expect(monitor.enabled_at).not.toBeNull();
		expect(monitor.id).toMatch(/^[0-9a-f-]{36}$/);
	});
});

describe("Monitor.listByTeam", () => {
	test("lists a team's monitors, most recently created first", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		let first = await Monitor.create(db, team.id, "author-1", {
			name: "First",
			url: "https://a.example.com",
		});
		/**
		 * Force a distinct `created_at` so the ordering assertion below is
		 * deterministic — two creates in the same millisecond would otherwise tie.
		 */
		await db.update(monitors, first.id, { created_at: first.created_at - 1000 }, { touch: false });
		let second = await Monitor.create(db, team.id, "author-1", {
			name: "Second",
			url: "https://b.example.com",
		});

		let rows = await Monitor.listByTeam(db, team.id);
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's monitors", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		await Monitor.create(db, teamA.id, "author-1", { name: "A", url: "https://a.example.com" });

		expect(await Monitor.listByTeam(db, teamB.id)).toEqual([]);
	});
});

describe("Monitor.countByTeam", () => {
	test("counts a team's monitors and ignores other teams", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		await Monitor.create(db, teamA.id, "author-1", { name: "A", url: "https://a.example.com" });
		await Monitor.create(db, teamA.id, "author-1", { name: "B", url: "https://b.example.com" });

		expect(await Monitor.countByTeam(db, teamA.id)).toBe(2);
		expect(await Monitor.countByTeam(db, teamB.id)).toBe(0);
	});
});

describe("Monitor.listSslEnabled", () => {
	test("lists only SSL-monitoring-enabled monitors, across every team", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);

		let sslEnabled = await Monitor.create(db, teamA.id, "author-1", {
			name: "SSL on",
			url: "https://a.example.com",
			ssl_monitoring_enabled: true,
		});
		await Monitor.create(db, teamB.id, "author-1", {
			name: "SSL off",
			url: "https://b.example.com",
			ssl_monitoring_enabled: false,
		});

		let rows = await Monitor.listSslEnabled(db);
		expect(rows.map((row) => row.id)).toEqual([sslEnabled.id]);
	});
});

describe("Monitor.findByIdForTeam", () => {
	test("finds a monitor scoped to its team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		let found = await Monitor.findByIdForTeam(db, team.id, monitor.id);
		expect(found?.id).toBe(monitor.id);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		let monitor = await Monitor.create(db, teamA.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		expect(await Monitor.findByIdForTeam(db, teamB.id, monitor.id)).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		expect(await Monitor.findByIdForTeam(db, team.id, crypto.randomUUID())).toBeNull();
	});
});

describe("Monitor.updateById", () => {
	test("updates a monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		let updated = await Monitor.updateById(db, monitor.id, { name: "Renamed" });
		expect(updated.name).toBe("Renamed");
		expect(updated.updated_at).toBeGreaterThanOrEqual(monitor.updated_at);
	});
});

describe("Monitor.deleteById", () => {
	test("deletes a monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
		});

		expect(await Monitor.deleteById(db, monitor.id)).toBe(true);
		expect(await Monitor.findByIdForTeam(db, team.id, monitor.id)).toBeNull();
	});

	test("returns false for a monitor that doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await Monitor.deleteById(db, crypto.randomUUID())).toBe(false);
	});
});

describe("Monitor.ping", () => {
	test("enqueues a checkHttp message with a job id derived from the monitor id", async () => {
		queueSend.mockClear();
		let monitorId = crypto.randomUUID();

		expect(await Monitor.ping(fakePolar(true), monitorId, "owner-1")).toBe(true);

		expect(queueSend).toHaveBeenCalledTimes(1);
		let message = queueSend.mock.calls[0]?.[0];
		expect(message?.type).toBe("checkHttp");
		expect(message?.monitorId).toBe(monitorId);
		expect(message?.id.startsWith(`${monitorId}:manual:`)).toBe(true);
		expect(typeof message?.scheduledAt).toBe("number");
	});

	test("enqueues nothing when the team owner has no active subscription", async () => {
		queueSend.mockClear();

		expect(await Monitor.ping(fakePolar(false), crypto.randomUUID(), "owner-1")).toBe(false);

		expect(queueSend).not.toHaveBeenCalled();
	});

	test("gives two cron deliveries in the same minute one shared job id", async () => {
		let monitorId = crypto.randomUUID();
		// The two deliveries this cron really produces: same minute, ~7s apart.
		let first = Date.UTC(2026, 6, 28, 12, 34, 8, 0);
		let second = Date.UTC(2026, 6, 28, 12, 34, 15, 0);

		expect(Monitor.scheduledJobId(monitorId, first)).toBe(
			Monitor.scheduledJobId(monitorId, second),
		);
	});

	test("gives consecutive minutes distinct job ids", async () => {
		let monitorId = crypto.randomUUID();
		let minute = Date.UTC(2026, 6, 28, 12, 34, 8, 0);
		let nextMinute = Date.UTC(2026, 6, 28, 12, 35, 8, 0);

		expect(Monitor.scheduledJobId(monitorId, minute)).not.toBe(
			Monitor.scheduledJobId(monitorId, nextMinute),
		);
	});

	test("scopes the scheduled job id to the monitor", async () => {
		let scheduledAt = Date.UTC(2026, 6, 28, 12, 34, 8, 0);

		expect(Monitor.scheduledJobId("monitor-a", scheduledAt)).not.toBe(
			Monitor.scheduledJobId("monitor-b", scheduledAt),
		);
	});

	test("gives each on-demand check its own job id", async () => {
		queueSend.mockClear();
		let monitorId = crypto.randomUUID();

		await Monitor.ping(fakePolar(true), monitorId, "owner-1");
		await Monitor.ping(fakePolar(true), monitorId, "owner-1");

		let [first, second] = queueSend.mock.calls.map((call) => call[0]?.id);
		expect(first).not.toBe(second);
	});
});

describe("Monitor.findDue", () => {
	test("a monitor with no completed result is due", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});

		let due = await Monitor.findDue(db, Date.now());
		expect(due).toEqual([{ monitorId: monitor.id, ownerId: team.owner_id }]);
	});

	test("a monitor whose interval hasn't elapsed since its last completed result is not due", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let scheduledAt = Date.now();
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await db.create(monitorResults, {
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: scheduledAt - 30_000,
			response_status: 200,
			response_time_ms: 42,
		});

		expect(await Monitor.findDue(db, scheduledAt)).toEqual([]);
	});

	test("a monitor whose interval has elapsed since its last completed result is due", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let scheduledAt = Date.now();
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await db.create(monitorResults, {
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: scheduledAt - 90_000,
			response_status: 200,
			response_time_ms: 42,
		});

		expect(await Monitor.findDue(db, scheduledAt)).toEqual([
			{ monitorId: monitor.id, ownerId: team.owner_id },
		]);
	});

	test("uses the most recent completed result, not an older one", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let scheduledAt = Date.now();
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		/** Old enough to be due on its own, but a more recent completed result exists. */
		await db.create(monitorResults, {
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: scheduledAt - 500_000,
			response_status: 200,
			response_time_ms: 42,
		});
		await db.create(monitorResults, {
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: scheduledAt - 10_000,
			response_status: 200,
			response_time_ms: 42,
		});

		expect(await Monitor.findDue(db, scheduledAt)).toEqual([]);
	});

	test("a pending (not yet completed) result doesn't count as a completed check", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let scheduledAt = Date.now();
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await db.create(monitorResults, {
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: null,
			response_status: null,
			response_time_ms: null,
		});

		expect(await Monitor.findDue(db, scheduledAt)).toEqual([
			{ monitorId: monitor.id, ownerId: team.owner_id },
		]);
	});

	test("a disabled monitor is never due, even with no completed result", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });

		expect(await Monitor.findDue(db, Date.now())).toEqual([]);
	});

	test("a disabled monitor is never due, even past its interval", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let scheduledAt = Date.now();
		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "Homepage",
			url: "https://example.com",
			interval_seconds: 60,
		});
		await db.create(monitorResults, {
			id: crypto.randomUUID(),
			monitor_id: monitor.id,
			completed_at: scheduledAt - 90_000,
			response_status: 200,
			response_time_ms: 42,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });

		expect(await Monitor.findDue(db, scheduledAt)).toEqual([]);
	});
});

/**
 * Every case below reads the month as of 2026-07-15, which puts the raw-counting
 * window at July 14–15 and the rollup window at July 1–13. `monitor_results` rows
 * dated before the 14th therefore never count on their own — after `CleanJob`'s
 * retention they wouldn't exist anyway, and the rollup is what stands in for them.
 */
describe("Monitor.countConsumedPingsByTeam", () => {
	let date = new Date("2026-07-15T12:00:00.000Z");
	let insideRawWindow = Date.UTC(2026, 6, 14, 8, 0, 0);

	/** A completed HTTP check recorded at `createdAt`, the row one consumed ping produces. */
	async function createHttpResult(db: Database, monitorId: string, createdAt: number) {
		let result = await db.create(
			monitorResults,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				response_status: 200,
				response_time_ms: 100,
				completed_at: createdAt,
			},
			{ touch: true, returnRow: true },
		);
		// `touch` stamps `created_at` with the current time, so backdate it afterwards.
		await db.update(monitorResults, result.id, { created_at: createdAt }, { touch: false });
	}

	/** A rolled-up day for one monitor, as `AggregateDailyStatsJob` would have written it. */
	async function createDailyStats(
		db: Database,
		monitorId: string,
		monitorType: "http" | "dns" | "tcp" | "cron",
		day: string,
		totalChecks: number,
	) {
		await db.create(
			monitorDailyStats,
			{
				id: crypto.randomUUID(),
				monitor_id: monitorId,
				monitor_type: monitorType,
				date: day,
				total_checks: totalChecks,
				successful_checks: totalChecks,
				failed_checks: 0,
				avg_response_time_ms: 100,
				max_response_time_ms: 200,
				p95_response_time_ms: null,
				status: "up",
			},
			{ touch: true },
		);
	}

	/** One monitor of every type for `teamId`, to hang results and rollup rows off. */
	async function createMonitors(db: Database, teamId: string) {
		let http = await Monitor.create(db, teamId, "author-1", {
			name: "HTTP",
			url: "https://example.com",
		});
		let dns = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "DNS",
				domain: "example.com",
				record_type: "A",
			},
			{ touch: true, returnRow: true },
		);
		let tcp = await db.create(
			tcpMonitors,
			{ id: crypto.randomUUID(), team_id: teamId, name: "TCP", host: "example.com", port: 443 },
			{ touch: true, returnRow: true },
		);
		let cron = await db.create(
			cronJobMonitors,
			{ id: crypto.randomUUID(), team_id: teamId, name: "Nightly", cron_expression: "0 0 * * *" },
			{ touch: true, returnRow: true },
		);

		return { http, dns, tcp, cron };
	}

	test("sums the rollup and the raw window across every monitor type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let { http, dns, tcp, cron } = await createMonitors(db, team.id);

		// Rolled-up days, inside the month and before the raw window: 1000 + 100 + 10 + 1.
		await createDailyStats(db, http.id, "http", "2026-07-02", 1000);
		await createDailyStats(db, dns.id, "dns", "2026-07-02", 100);
		await createDailyStats(db, tcp.id, "tcp", "2026-07-13", 10);
		await createDailyStats(db, cron.id, "cron", "2026-07-13", 1);

		// Raw results the rollup hasn't reached yet: 2 HTTP + 1 DNS + 1 TCP + 1 cron.
		await createHttpResult(db, http.id, insideRawWindow);
		await createHttpResult(db, http.id, insideRawWindow + 60_000);
		await db.create(dnsMonitorResults, {
			id: crypto.randomUUID(),
			dns_monitor_id: dns.id,
			status: "ok",
			resolved_value: "1.1.1.1",
			response_time_ms: 10,
			error_message: null,
			checked_at: insideRawWindow,
		});
		await db.create(tcpMonitorResults, {
			id: crypto.randomUUID(),
			tcp_monitor_id: tcp.id,
			status: "up",
			response_time_ms: 10,
			error_message: null,
			checked_at: insideRawWindow,
		});
		let ping = await db.create(
			cronJobPings,
			{ id: crypto.randomUUID(), cron_job_monitor_id: cron.id, was_on_time: true },
			{ touch: true, returnRow: true },
		);
		await db.update(cronJobPings, ping.id, { created_at: insideRawWindow }, { touch: false });

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(1116);
	});

	test("never double counts a day that has both a rollup row and surviving raw rows", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let { http } = await createMonitors(db, team.id);

		// The 13th is rolled up, and its raw rows are still inside the 7-day retention.
		await createDailyStats(db, http.id, "http", "2026-07-13", 5);
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 13, 6, 0, 0));
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 13, 7, 0, 0));

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(5);
	});

	test("counts the whole month raw when the raw window covers it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let { http } = await createMonitors(db, team.id);

		// On the 1st the raw window is clamped to the month, leaving no rolled-up days.
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 1, 0, 30, 0));
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 1, 1, 30, 0));

		expect(
			await Monitor.countConsumedPingsByTeam(db, team.id, new Date("2026-07-01T12:00:00.000Z")),
		).toBe(2);
	});

	test("never counts another month or another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let otherTeam = await createTeam(db);
		let { http, dns, tcp, cron } = await createMonitors(db, team.id);

		// Rolled-up days on either side of July.
		await createDailyStats(db, http.id, "http", "2026-06-30", 1000);
		await createDailyStats(db, dns.id, "dns", "2026-08-01", 1000);
		// Raw checks the millisecond before July starts and the millisecond after it ends.
		await createHttpResult(db, http.id, Date.UTC(2026, 6, 1) - 1);
		await createHttpResult(db, http.id, Date.UTC(2026, 7, 1));
		// A rollup row for the right day, but keyed to the wrong monitor type.
		await createDailyStats(db, tcp.id, "cron", "2026-07-02", 1000);
		await createDailyStats(db, cron.id, "tcp", "2026-07-02", 1000);

		let other = await createMonitors(db, otherTeam.id);
		await createDailyStats(db, other.http.id, "http", "2026-07-02", 1000);
		await createHttpResult(db, other.http.id, insideRawWindow);

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});

	test("counts zero, not null, for a team that has never been checked", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		expect(await Monitor.countConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});
});

describe("Monitor.estimateConsumedPingsByTeam", () => {
	test("projects HTTP/DNS/TCP monitors from their interval and sums cron occurrences", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		// 31-day month, checking every 3600s -> 24 checks/day * 31 = 744.
		await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
			interval_seconds: 3600,
		});
		await db.create(dnsMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "DNS",
			domain: "example.com",
			record_type: "A",
			interval_seconds: 3600,
			is_enabled: true,
		});
		await db.create(tcpMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "TCP",
			host: "example.com",
			port: 443,
			interval_seconds: 3600,
			is_enabled: true,
		});
		// Runs once a day at midnight -> 31 occurrences in July.
		await db.create(cronJobMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Nightly job",
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		let estimate = await Monitor.estimateConsumedPingsByTeam(db, team.id, date);
		// 744 (http) + 744 (dns) + 744 (tcp) = 2232, plus cron occurrences strictly
		// after the 1st at midnight through the 31st: 30.
		expect(estimate).toBe(2262);
	});

	test("ignores disabled monitors and jobs", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		let monitor = await Monitor.create(db, team.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
			interval_seconds: 3600,
		});
		await Monitor.updateById(db, monitor.id, { enabled_at: null });
		await db.create(dnsMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "DNS",
			domain: "example.com",
			record_type: "A",
			interval_seconds: 3600,
			is_enabled: false,
		});
		await db.create(cronJobMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Disabled job",
			cron_expression: "0 0 * * *",
			timezone: "UTC",
			enabled_at: null,
		});

		expect(await Monitor.estimateConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});

	test("never counts another team's monitors", async () => {
		let { db } = createTestDatabase();
		let teamA = await createTeam(db);
		let teamB = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		await Monitor.create(db, teamB.id, "author-1", {
			name: "HTTP",
			url: "https://example.com",
			interval_seconds: 3600,
		});

		expect(await Monitor.estimateConsumedPingsByTeam(db, teamA.id, date)).toBe(0);
	});

	test("skips a cron job with an invalid expression instead of throwing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);
		let date = new Date("2026-07-15T12:00:00.000Z");

		await db.create(cronJobMonitors, {
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Broken job",
			cron_expression: "not a cron expression",
			timezone: "UTC",
			enabled_at: Date.now(),
		});

		expect(await Monitor.estimateConsumedPingsByTeam(db, team.id, date)).toBe(0);
	});
});
