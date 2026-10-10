/**
 * Unit tests for the report reads: which monitors a filter selects, what the summary and
 * daily rows sum from the roll-up, and how maintenance windows turn into minutes. Rows are
 * seeded directly so every monitor table, status-page link and window scope stays reachable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { DailyStatsMonitorType } from "~/app/models/monitor-daily-stats";
import type { Report } from "~/app/repositories/reports";
import type { InsertMaintenanceWindow, MonitorStatus } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { dailyRows, listMonitors, summaryRows } from "~/app/repositories/reports";
import {
	cronJobMonitors,
	dnsMonitors,
	flowMonitors,
	maintenanceWindows,
	monitors,
	statusPageCronJobs,
	statusPageDnsMonitors,
	statusPageFlowMonitors,
	statusPageMonitors,
	statusPages,
	statusPageTcpMonitors,
	tcpMonitors,
} from "~/database/schema";

const TEAM = "team-a";

const OTHER_TEAM = "team-b";

/** Four whole UTC days across the July/August boundary, the range most cases report on. */
const RANGE: Report.Filter = { from: "2026-07-30", to: "2026-08-02" };

const MINUTE_MS = 60_000;

/** A monitor as the tests refer to it: the pair the roll-up is keyed on, plus its name. */
interface Seeded {
	id: string;
	type: DailyStatsMonitorType;
	name: string;
}

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** One monitor of `type` on `teamId`, with the target column each table reports. */
async function seedMonitor(
	type: DailyStatsMonitorType,
	options: { teamId?: string; name?: string; enabled?: boolean } = {},
): Promise<Seeded> {
	let id = crypto.randomUUID();
	let name = options.name ?? `${type} monitor`;
	let enabled = options.enabled ?? true;
	let shared = { id, team_id: options.teamId ?? TEAM, name };
	let write = { touch: true, returnRow: true } as const;

	if (type === "http") {
		await db.create(
			monitors,
			{
				...shared,
				author_id: crypto.randomUUID(),
				url: "https://example.com/health",
				enabled_at: enabled ? Date.now() : null,
			},
			write,
		);
	}
	if (type === "dns") {
		await db.create(dnsMonitors, { ...shared, domain: "example.com", is_enabled: enabled }, write);
	}
	if (type === "tcp") {
		await db.create(
			tcpMonitors,
			{ ...shared, host: "db.example.com", port: 5432, is_enabled: enabled },
			write,
		);
	}
	if (type === "cron") {
		await db.create(
			cronJobMonitors,
			{ ...shared, cron_expression: "0 3 * * *", enabled_at: enabled ? Date.now() : null },
			write,
		);
	}
	if (type === "flow") {
		await db.create(
			flowMonitors,
			{ ...shared, source: 'get "https://example.com" with password "hunter2"' },
			write,
		);
	}

	return { id, type, name };
}

/** One of every type, named so their order within a type is known. */
async function seedEveryType(teamId = TEAM) {
	return {
		http: await seedMonitor("http", { teamId }),
		dns: await seedMonitor("dns", { teamId }),
		tcp: await seedMonitor("tcp", { teamId }),
		cron: await seedMonitor("cron", { teamId }),
		flow: await seedMonitor("flow", { teamId }),
	};
}

/** One day of the roll-up for a monitor. */
async function seedDay(
	monitor: Seeded,
	date: string,
	counts: {
		total?: number;
		successful?: number;
		avg?: number | null;
		max?: number | null;
		status?: MonitorStatus;
	} = {},
) {
	let total = counts.total ?? 10;
	let successful = counts.successful ?? total;

	unwrap(
		await bindModels(db).monitorDailyStats.upsertDay({
			monitor_id: monitor.id,
			monitor_type: monitor.type,
			date,
			total_checks: total,
			successful_checks: successful,
			failed_checks: total - successful,
			avg_response_time_ms: counts.avg === undefined ? 40 : counts.avg,
			max_response_time_ms: counts.max === undefined ? 60 : counts.max,
			status: counts.status ?? "up",
		}),
	);
}

/** A maintenance window with its creation instant fixed, since a recurrence starts from it. */
async function seedWindow(
	input: Partial<InsertMaintenanceWindow> & { starts_at: number; ends_at: number },
) {
	let createdAt = input.created_at ?? Date.parse("2026-01-01T00:00:00Z");
	await db.create(
		maintenanceWindows,
		{
			id: crypto.randomUUID(),
			team_id: TEAM,
			name: "Maintenance",
			monitor_type: null,
			monitor_id: null,
			...input,
			created_at: createdAt,
			updated_at: createdAt,
		},
		{ touch: false },
	);
}

/** A status page of `teamId` showing exactly `attached`, each through its own link table. */
async function seedStatusPage(attached: Seeded[], teamId = TEAM) {
	let page = await db.create(
		statusPages,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: "Client",
			slug: `client-${crypto.randomUUID()}`,
			title: "Client status",
		},
		{ touch: true, returnRow: true },
	);
	let idsOf = (type: DailyStatsMonitorType) =>
		attached.filter((monitor) => monitor.type === type).map((monitor) => monitor.id);
	let link = { status_page_id: page.id };

	for (let id of idsOf("http")) await db.create(statusPageMonitors, { ...link, monitor_id: id });
	for (let id of idsOf("dns")) {
		await db.create(statusPageDnsMonitors, {
			...link,
			id: crypto.randomUUID(),
			dns_monitor_id: id,
		});
	}
	for (let id of idsOf("tcp")) {
		await db.create(statusPageTcpMonitors, {
			...link,
			id: crypto.randomUUID(),
			tcp_monitor_id: id,
		});
	}
	for (let id of idsOf("cron")) {
		await db.create(statusPageCronJobs, { ...link, cron_job_monitor_id: id });
	}
	for (let id of idsOf("flow")) {
		await db.create(statusPageFlowMonitors, {
			...link,
			id: crypto.randomUUID(),
			flow_monitor_id: id,
		});
	}

	return page;
}

/** Every daily row for `filter`, drained from the stream. */
async function collectDaily(filter: Report.Filter) {
	let rows: Report.DailyRow[] = [];
	for await (let row of dailyRows(db, TEAM, filter)) rows.push(row);
	return rows;
}

/** Epoch ms of an ISO instant, for writing window bounds legibly. */
function at(iso: string) {
	return Date.parse(iso);
}

describe("listMonitors", () => {
	test("lists every type with its target, ordered by type and then name", async () => {
		await seedMonitor("flow", { name: "Checkout" });
		await seedMonitor("http", { name: "Website" });
		await seedMonitor("http", { name: "API" });
		await seedMonitor("tcp", { name: "Database" });
		await seedMonitor("cron", { name: "Backups" });
		await seedMonitor("dns", { name: "Zone" });

		let listed = await listMonitors(db, TEAM, RANGE);

		expect(listed.map(({ type, name, target }) => ({ type, name, target }))).toEqual([
			{ type: "http", name: "API", target: "https://example.com/health" },
			{ type: "http", name: "Website", target: "https://example.com/health" },
			{ type: "dns", name: "Zone", target: "example.com" },
			{ type: "tcp", name: "Database", target: "db.example.com:5432" },
			{ type: "cron", name: "Backups", target: "0 3 * * *" },
			{ type: "flow", name: "Checkout", target: null },
		]);
	});

	test("keeps a disabled monitor, since it is still one of the team's monitors", async () => {
		let paused = await seedMonitor("http", { enabled: false });
		let pausedTcp = await seedMonitor("tcp", { enabled: false });

		let listed = await listMonitors(db, TEAM, RANGE);

		expect(listed.map((monitor) => monitor.id)).toEqual([paused.id, pausedTcp.id]);
	});

	test("never lists another team's monitors", async () => {
		let own = await seedMonitor("http");
		await seedEveryType(OTHER_TEAM);

		let listed = await listMonitors(db, TEAM, RANGE);

		expect(listed.map((monitor) => monitor.id)).toEqual([own.id]);
	});

	test("narrows to the monitors attached to a status page, through every link table", async () => {
		let attached = await seedEveryType();
		await seedEveryType();
		let page = await seedStatusPage(Object.values(attached));

		let listed = await listMonitors(db, TEAM, { ...RANGE, statusPageId: page.id });

		expect(listed.map((monitor) => monitor.id)).toEqual([
			attached.http.id,
			attached.dns.id,
			attached.tcp.id,
			attached.cron.id,
			attached.flow.id,
		]);
	});

	test("lists nothing for another team's status page, even one showing this team's ids", async () => {
		let own = await seedEveryType();
		let foreign = await seedStatusPage(Object.values(own), OTHER_TEAM);

		expect(await listMonitors(db, TEAM, { ...RANGE, statusPageId: foreign.id })).toEqual([]);
	});

	test("matches a status page link on type as well as id", async () => {
		let http = await seedMonitor("http");
		let page = await seedStatusPage([{ ...http, type: "dns" }]);

		expect(await listMonitors(db, TEAM, { ...RANGE, statusPageId: page.id })).toEqual([]);
	});

	test("narrows to one monitor type", async () => {
		let every = await seedEveryType();

		let listed = await listMonitors(db, TEAM, { ...RANGE, monitorType: "tcp" });

		expect(listed.map((monitor) => monitor.id)).toEqual([every.tcp.id]);
	});

	test("combines the status page and type filters", async () => {
		let every = await seedEveryType();
		let otherHttp = await seedMonitor("http");
		let page = await seedStatusPage([every.http, every.dns]);

		let listed = await listMonitors(db, TEAM, {
			...RANGE,
			statusPageId: page.id,
			monitorType: "http",
		});

		expect(listed.map((monitor) => monitor.id)).toEqual([every.http.id]);
		expect(listed.map((monitor) => monitor.id)).not.toContain(otherHttp.id);
	});
});

describe("summaryRows", () => {
	test("sums every type's days across a month boundary, ignoring days outside the range", async () => {
		let every = await seedEveryType();
		for (let monitor of Object.values(every)) {
			await seedDay(monitor, "2026-07-29", { total: 1000, successful: 0, status: "down" });
			await seedDay(monitor, "2026-07-30", { total: 100, successful: 100, avg: 10, max: 50 });
			await seedDay(monitor, "2026-07-31", {
				total: 300,
				successful: 297,
				avg: 30,
				max: 90,
				status: "degraded",
			});
			await seedDay(monitor, "2026-08-01", {
				total: 100,
				successful: 40,
				avg: 20,
				max: 70,
				status: "down",
			});
			await seedDay(monitor, "2026-08-03", { total: 1000, successful: 0, status: "down" });
		}

		let rows = await summaryRows(db, TEAM, RANGE);

		expect(rows.map((row) => row.type)).toEqual(["http", "dns", "tcp", "cron", "flow"]);
		expect(rows[0]).toEqual({
			monitorId: every.http.id,
			monitor: "http monitor",
			type: "http",
			target: "https://example.com/health",
			daysWithData: 3,
			totalChecks: 500,
			successfulChecks: 437,
			failedChecks: 63,
			uptimePercent: (437 / 500) * 100,
			avgResponseTimeMs: (10 * 100 + 30 * 300 + 20 * 100) / 500,
			maxResponseTimeMs: 90,
			daysDown: 1,
			daysDegraded: 1,
			maintenanceMinutes: 0,
		});
		for (let row of rows.slice(1)) {
			expect(row).toMatchObject({ daysWithData: 3, totalChecks: 500, successfulChecks: 437 });
		}
	});

	test("counts only the days that have a roll-up row", async () => {
		let monitor = await seedMonitor("http");
		await seedDay(monitor, "2026-07-30");
		await seedDay(monitor, "2026-08-02");

		let [row] = await summaryRows(db, TEAM, RANGE);

		expect(row).toMatchObject({ daysWithData: 2, totalChecks: 20, uptimePercent: 100 });
	});

	test("reports no uptime for a monitor whose days have no checks", async () => {
		let monitor = await seedMonitor("cron");
		await seedDay(monitor, "2026-07-30", { total: 0, successful: 0, status: "down" });

		let [row] = await summaryRows(db, TEAM, RANGE);

		expect(row).toMatchObject({ daysWithData: 1, totalChecks: 0, uptimePercent: null });
	});

	test("keeps a monitor with no roll-up rows at all, with nothing measured", async () => {
		let monitor = await seedMonitor("dns");

		let rows = await summaryRows(db, TEAM, RANGE);

		expect(rows).toEqual([
			{
				monitorId: monitor.id,
				monitor: "dns monitor",
				type: "dns",
				target: "example.com",
				daysWithData: 0,
				totalChecks: 0,
				successfulChecks: 0,
				failedChecks: 0,
				uptimePercent: null,
				avgResponseTimeMs: null,
				maxResponseTimeMs: null,
				daysDown: 0,
				daysDegraded: 0,
				maintenanceMinutes: 0,
			},
		]);
	});

	test("reports no average response time for a cron job", async () => {
		let monitor = await seedMonitor("cron");
		await seedDay(monitor, "2026-07-30", { avg: 25 });

		let [row] = await summaryRows(db, TEAM, RANGE);

		expect(row?.avgResponseTimeMs).toBeNull();
	});

	test("weights the average only by the checks of days that recorded one", async () => {
		let monitor = await seedMonitor("tcp");
		await seedDay(monitor, "2026-07-30", { total: 10, avg: 100 });
		await seedDay(monitor, "2026-07-31", { total: 90, avg: null, max: null });

		let [row] = await summaryRows(db, TEAM, RANGE);

		expect(row).toMatchObject({ avgResponseTimeMs: 100, maxResponseTimeMs: 60 });
	});

	test("reads a team with more monitors than one query can bind", async () => {
		let seeded: Seeded[] = [];
		for (let index = 0; index < 150; index++) {
			let monitor = await seedMonitor("http", { name: `m${String(index).padStart(3, "0")}` });
			await seedDay(monitor, "2026-07-30", { total: index + 1 });
			seeded.push(monitor);
		}

		let rows = await summaryRows(db, TEAM, RANGE);

		expect(rows).toHaveLength(150);
		expect(rows.map((row) => row.totalChecks)).toEqual(seeded.map((_, index) => index + 1));
	});

	test("applies the status page and type filters, and never reads another team's rows", async () => {
		let every = await seedEveryType();
		let foreign = await seedEveryType(OTHER_TEAM);
		for (let monitor of [...Object.values(every), ...Object.values(foreign)]) {
			await seedDay(monitor, "2026-07-30");
		}
		let page = await seedStatusPage([every.dns, every.cron]);

		let onPage = await summaryRows(db, TEAM, { ...RANGE, statusPageId: page.id });
		let dnsOnly = await summaryRows(db, TEAM, { ...RANGE, monitorType: "dns" });
		let all = await summaryRows(db, TEAM, RANGE);

		expect(onPage.map((row) => row.monitorId)).toEqual([every.dns.id, every.cron.id]);
		expect(dnsOnly.map((row) => row.monitorId)).toEqual([every.dns.id]);
		expect(all.map((row) => row.monitorId)).toEqual(Object.values(every).map((m) => m.id));
	});
});

describe("dailyRows", () => {
	test("yields one row per roll-up row, by monitor and then date, across a month boundary", async () => {
		let every = await seedEveryType();
		for (let monitor of Object.values(every)) {
			await seedDay(monitor, "2026-07-29");
			await seedDay(monitor, "2026-07-31", {
				total: 200,
				successful: 150,
				avg: 35,
				max: 80,
				status: "degraded",
			});
			await seedDay(monitor, "2026-08-01");
			await seedDay(monitor, "2026-08-03");
		}

		let rows = await collectDaily(RANGE);

		expect(rows.map((row) => `${row.type} ${row.date}`)).toEqual(
			["http", "dns", "tcp", "cron", "flow"].flatMap((type) => [
				`${type} 2026-07-31`,
				`${type} 2026-08-01`,
			]),
		);
		expect(rows[0]).toEqual({
			date: "2026-07-31",
			monitorId: every.http.id,
			monitor: "http monitor",
			type: "http",
			totalChecks: 200,
			successfulChecks: 150,
			failedChecks: 50,
			uptimePercent: 75,
			avgResponseTimeMs: 35,
			maxResponseTimeMs: 80,
			status: "degraded",
			maintenanceMinutes: 0,
		});
		expect(rows.find((row) => row.type === "cron")?.avgResponseTimeMs).toBeNull();
	});

	test("reports no uptime for a day without checks", async () => {
		let monitor = await seedMonitor("cron");
		await seedDay(monitor, "2026-07-30", { total: 0, successful: 0, status: "down" });

		let [row] = await collectDaily(RANGE);

		expect(row).toMatchObject({ totalChecks: 0, uptimePercent: null, status: "down" });
	});

	test("applies the filters and never yields another team's rows", async () => {
		let every = await seedEveryType();
		let foreign = await seedEveryType(OTHER_TEAM);
		for (let monitor of [...Object.values(every), ...Object.values(foreign)]) {
			await seedDay(monitor, "2026-07-30");
		}
		let page = await seedStatusPage([every.flow, every.http]);

		let onPage = await collectDaily({ ...RANGE, statusPageId: page.id });
		let tcpOnly = await collectDaily({ ...RANGE, monitorType: "tcp" });
		let all = await collectDaily(RANGE);

		expect(onPage.map((row) => row.monitorId)).toEqual([every.http.id, every.flow.id]);
		expect(tcpOnly.map((row) => row.monitorId)).toEqual([every.tcp.id]);
		expect(all).toHaveLength(5);
	});
});

describe("maintenance minutes", () => {
	test("counts overlapping windows once", async () => {
		let monitor = await seedMonitor("http");
		await seedDay(monitor, "2026-07-31");
		await seedWindow({
			starts_at: at("2026-07-31T01:00:00Z"),
			ends_at: at("2026-07-31T03:00:00Z"),
		});
		await seedWindow({
			monitor_type: "http",
			monitor_id: monitor.id,
			starts_at: at("2026-07-31T02:00:00Z"),
			ends_at: at("2026-07-31T04:00:00Z"),
		});
		await seedWindow({
			monitor_type: "http",
			starts_at: at("2026-07-31T02:30:00Z"),
			ends_at: at("2026-07-31T02:45:00Z"),
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);
		let [day] = await collectDaily(RANGE);

		expect(summary?.maintenanceMinutes).toBe(180);
		expect(day?.maintenanceMinutes).toBe(180);
	});

	test("applies each window only to the monitors its scope covers", async () => {
		let http = await seedMonitor("http");
		let otherHttp = await seedMonitor("http", { name: "second http" });
		let dns = await seedMonitor("dns");
		await seedWindow({
			monitor_type: "http",
			monitor_id: http.id,
			starts_at: at("2026-07-30T00:00:00Z"),
			ends_at: at("2026-07-30T00:10:00Z"),
		});
		await seedWindow({
			monitor_type: "dns",
			starts_at: at("2026-07-30T01:00:00Z"),
			ends_at: at("2026-07-30T01:20:00Z"),
		});
		/** A monitor id without a type predates the type column, so it names an HTTP monitor. */
		await seedWindow({
			monitor_id: otherHttp.id,
			starts_at: at("2026-07-30T02:00:00Z"),
			ends_at: at("2026-07-30T02:30:00Z"),
		});

		let rows = await summaryRows(db, TEAM, RANGE);

		expect(rows.map((row) => [row.monitorId, row.maintenanceMinutes])).toEqual([
			[http.id, 10],
			[otherHttp.id, 30],
			[dns.id, 20],
		]);
	});

	test("clips a window to the range, and a daily row to its own day", async () => {
		let monitor = await seedMonitor("tcp");
		await seedDay(monitor, "2026-07-31");
		await seedDay(monitor, "2026-08-01");
		await seedWindow({
			starts_at: at("2026-07-29T23:00:00Z"),
			ends_at: at("2026-07-30T00:30:00Z"),
		});
		await seedWindow({
			starts_at: at("2026-07-31T23:00:00Z"),
			ends_at: at("2026-08-01T01:00:00Z"),
		});
		await seedWindow({
			starts_at: at("2026-08-02T23:50:00Z"),
			ends_at: at("2026-08-03T05:00:00Z"),
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);
		let days = await collectDaily(RANGE);

		expect(summary?.maintenanceMinutes).toBe(30 + 120 + 10);
		expect(days.map((row) => [row.date, row.maintenanceMinutes])).toEqual([
			["2026-07-31", 60],
			["2026-08-01", 60],
		]);
	});

	test("expands a recurring window inside the range", async () => {
		let monitor = await seedMonitor("http");
		await seedDay(monitor, "2026-07-30");
		await seedDay(monitor, "2026-08-02");
		await seedWindow({
			is_recurring: true,
			recurring_pattern: "daily:02:00-03:00",
			starts_at: at("2026-01-01T02:00:00Z"),
			ends_at: at("2026-01-01T03:00:00Z"),
		});
		/** Sunday 2026-08-02 is the only Sunday in the range. */
		await seedWindow({
			is_recurring: true,
			recurring_pattern: "weekly:sunday:02:30-05:00",
			starts_at: at("2026-01-01T02:00:00Z"),
			ends_at: at("2026-01-01T03:00:00Z"),
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);
		let days = await collectDaily(RANGE);

		expect(summary?.maintenanceMinutes).toBe(3 * 60 + 180);
		expect(days.map((row) => [row.date, row.maintenanceMinutes])).toEqual([
			["2026-07-30", 60],
			["2026-08-02", 180],
		]);
	});

	test("counts a recurring window's occurrences only from its creation onwards", async () => {
		await seedMonitor("http");
		await seedWindow({
			is_recurring: true,
			recurring_pattern: "daily:02:00-03:00",
			created_at: at("2026-07-31T12:00:00Z"),
			starts_at: at("2026-07-31T12:00:00Z"),
			ends_at: at("2026-07-31T12:15:00Z"),
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);

		expect(summary?.maintenanceMinutes).toBe(15 + 2 * 60);
	});

	test("ends a window that was ended early at the moment it was ended", async () => {
		let monitor = await seedMonitor("dns");
		await seedDay(monitor, "2026-08-01");
		await seedWindow({
			starts_at: at("2026-08-01T10:00:00Z"),
			ends_at: at("2026-08-01T18:00:00Z"),
			ended_early_at: at("2026-08-01T10:45:00Z"),
		});
		await seedWindow({
			starts_at: at("2026-08-02T10:00:00Z"),
			ends_at: at("2026-08-02T18:00:00Z"),
			ended_early_at: at("2026-08-02T09:00:00Z"),
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);
		let [day] = await collectDaily(RANGE);

		expect(summary?.maintenanceMinutes).toBe(45);
		expect(day?.maintenanceMinutes).toBe(45);
	});

	test("rounds a window ended part-way through a minute to whole minutes", async () => {
		await seedMonitor("http");
		await seedWindow({
			starts_at: at("2026-08-01T10:00:00Z"),
			ends_at: at("2026-08-01T18:00:00Z"),
			ended_early_at: at("2026-08-01T10:00:00Z") + 20 * MINUTE_MS + 40_000,
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);

		expect(summary?.maintenanceMinutes).toBe(21);
	});

	test("ignores another team's windows", async () => {
		await seedMonitor("http");
		await seedWindow({
			team_id: OTHER_TEAM,
			starts_at: at("2026-07-30T00:00:00Z"),
			ends_at: at("2026-07-31T00:00:00Z"),
		});

		let [summary] = await summaryRows(db, TEAM, RANGE);

		expect(summary?.maintenanceMinutes).toBe(0);
	});
});
