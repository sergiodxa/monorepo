/**
 * Tests the API's uptime reports: the `reports:read` scope, the default and checked range,
 * the status-page and type filters, the standard-dialect CSV parsed back with `@sdxc/csv`,
 * the JSON envelope, and the daily report's cursor walking every row exactly once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { parse } from "@sdxc/csv";
import { isFailure, unwrap } from "@sdxc/result";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { DailyStatsMonitorType } from "~/app/models/monitor-daily-stats";
import type { ApiKeyScope, MonitorStatus } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem, problemMessages } from "~/app/lib/test/problem";
import { encodeId, encodeMonitorId } from "~/app/services/typed-id";
import {
	cronJobMonitors,
	dnsMonitors,
	flowMonitors,
	monitors,
	tcpMonitors,
	teams,
} from "~/database/schema";
import { reportsRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(reportsRoutes);

let { default: reportsController } = await import("./reports");

/** Mid-September, so the default range is August and yesterday is 14 September. */
const NOW = Date.parse("2026-09-15T12:00:00Z");

const SUMMARY_PATH = routes.api.v1.reports.uptimeSummary.href();

const DAILY_PATH = routes.api.v1.reports.uptimeDaily.href();

/** A monitor as the tests refer to it: the pair the roll-up is keyed on, plus its name. */
interface Seeded {
	id: string;
	type: DailyStatsMonitorType;
	name: string;
}

/** The fields a summary row's JSON carries. */
interface SummaryJson {
	monitorId: string;
	monitor: string;
	type: string;
	target: string | null;
	daysWithData: number;
	totalChecks: number;
	successfulChecks: number;
	failedChecks: number;
	uptimePercent: number | null;
	avgResponseTimeMs: number | null;
	maxResponseTimeMs: number | null;
	daysDown: number;
	daysDegraded: number;
	maintenanceMinutes: number;
}

/** The fields a daily row's JSON carries. */
interface DayJson {
	date: string;
	monitorId: string;
	monitor: string;
	type: string;
	totalChecks: number;
	uptimePercent: number | null;
	status: string;
}

/** A summary response's body. */
interface SummaryBody {
	data: { from: string; to: string; monitors: SummaryJson[] };
}

/** A daily page's body. */
interface DailyBody {
	data: { from: string; to: string; days: DayJson[] };
	meta: { pagination: { next: string | null; prev: string | null; perPage: number } };
}

let db: Database;

beforeAll(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterAll(() => {
	vi.useRealTimers();
});

beforeEach(() => {
	db = createTestDatabase().db;
});

async function createTeamRow(slug = `acme-${crypto.randomUUID().slice(0, 8)}`) {
	return await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: crypto.randomUUID(), name: "Acme", slug, logo: null },
		{ touch: true, returnRow: true },
	);
}

async function createApiKey(teamId: string, scopes: ApiKeyScope[] = ["reports:read"]) {
	let { key } = unwrap(
		await bindModels(db).apiKeys.issue(teamId, { name: "test", scopes, expires_at: null }),
	);
	return key;
}

/** One monitor of `type` on `teamId`, with the target column each table reports. */
async function seedMonitor(
	teamId: string,
	type: DailyStatsMonitorType,
	name = `${type} monitor`,
): Promise<Seeded> {
	let id = crypto.randomUUID();
	let shared = { id, team_id: teamId, name };
	let write = { touch: true, returnRow: true } as const;

	if (type === "http") {
		await db.create(
			monitors,
			{
				...shared,
				author_id: crypto.randomUUID(),
				url: "https://example.com/health",
				enabled_at: NOW,
			},
			write,
		);
	}
	if (type === "dns") await db.create(dnsMonitors, { ...shared, domain: "example.com" }, write);
	if (type === "tcp") {
		await db.create(tcpMonitors, { ...shared, host: "db.example.com", port: 5432 }, write);
	}
	if (type === "cron") {
		await db.create(cronJobMonitors, { ...shared, cron_expression: "0 3 * * *" }, write);
	}
	if (type === "flow") {
		await db.create(flowMonitors, { ...shared, source: 'get "https://example.com"' }, write);
	}

	return { id, type, name };
}

/** One day of the roll-up for a monitor. */
async function seedDay(
	monitor: Seeded,
	date: string,
	counts: { total?: number; successful?: number; status?: MonitorStatus } = {},
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
			avg_response_time_ms: monitor.type === "cron" ? null : 40.5,
			max_response_time_ms: monitor.type === "cron" ? null : 60,
			status: counts.status ?? "up",
		}),
	);
}

async function dispatch(path: string, options: { key?: string; accept?: string } = {}) {
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(reportsRoutes, reportsController);

	let headers: Record<string, string> = {};
	if (options.key !== undefined) headers.Authorization = `Bearer ${options.key}`;
	if (options.accept !== undefined) headers.Accept = options.accept;

	return router.fetch(new Request(`https://uptime.test${path}`, { headers }));
}

/** Every record of a CSV body as arrays of fields, the header record first. */
async function csvRecords(response: Response) {
	let parsed = parse(await response.text(), { header: false });
	if (isFailure(parsed)) return expect.unreachable(parsed.error.message);
	return parsed.data.rows;
}

describe.each([
	["summary", SUMMARY_PATH],
	["daily", DAILY_PATH],
])("GET %s report authorization", (_name, path) => {
	test("refuses a request without an API key", async () => {
		let response = await dispatch(path);
		expect(response.status).toBe(401);
		await expectProblem(response, "unauthorized");
	});

	test("refuses a key without reports:read", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id, ["monitors:read"]);

		let response = await dispatch(path, { key });

		expect(response.status).toBe(403);
		await expectProblem(response, "forbidden");
	});
});

describe.each([
	["summary", SUMMARY_PATH],
	["daily", DAILY_PATH],
])("GET %s report filters", (_name, path) => {
	test.each([
		["only from", "from=2026-08-01", "from and to must be given together"],
		["only to", "to=2026-08-31", "from and to must be given together"],
		["a malformed day", "from=2026/08/01&to=2026-08-31", "/from"],
		["a day the calendar lacks", "from=2026-02-30&to=2026-03-02", "calendar days"],
		["a reversed range", "from=2026-08-31&to=2026-08-01", "from must not be after to"],
		["a range reaching today", "from=2026-09-01&to=2026-09-15", "yesterday"],
		["a range over 366 days", "from=2025-01-01&to=2026-08-31", "366 days"],
		["an unknown monitor type", "monitor_type=ssl", "/monitor_type"],
		[
			"a status page id of another resource",
			`status_page_id=${encodeId("mon", crypto.randomUUID())}`,
			"/status_page_id",
		],
	])("refuses %s as a validation error", async (_case, query, message) => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);

		let response = await dispatch(`${path}?${query}`, { key });

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problemMessages(problem)).toContain(message);
	});

	test("answers 404 for another team's status page", async () => {
		let team = await createTeamRow();
		let other = await createTeamRow();
		let key = await createApiKey(team.id);
		let page = unwrap(
			await bindModels(db).statusPages.create({
				team_id: other.id,
				name: "Other",
				slug: `other-${crypto.randomUUID()}`,
				title: "Other",
			}),
		);

		let response = await dispatch(`${path}?status_page_id=${encodeId("sp", page.id)}`, { key });

		expect(response.status).toBe(404);
		let problem = await expectProblem(response, "notFound");
		expect(problem.detail).toBe("Status page not found");
	});
});

describe("GET /api/v1/reports/uptime-summary", () => {
	test("covers last month by default and lists every type with its prefixed id", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);
		let http = await seedMonitor(team.id, "http", "Website");
		let dns = await seedMonitor(team.id, "dns");
		let tcp = await seedMonitor(team.id, "tcp");
		let cron = await seedMonitor(team.id, "cron");
		let flow = await seedMonitor(team.id, "flow");
		await seedDay(http, "2026-07-31", { total: 100, successful: 0, status: "down" });
		await seedDay(http, "2026-08-01", { total: 100, successful: 99 });
		await seedDay(http, "2026-08-31", { total: 100, successful: 100 });
		await seedDay(http, "2026-09-01", { total: 100, successful: 0, status: "down" });

		let response = await dispatch(SUMMARY_PATH, { key });

		expect(response.status).toBe(200);
		let body = (await response.json()) as SummaryBody;
		expect(body.data.from).toBe("2026-08-01");
		expect(body.data.to).toBe("2026-08-31");
		expect(body.data.monitors.map((row) => row.monitorId)).toEqual([
			encodeMonitorId("http", http.id),
			encodeMonitorId("dns", dns.id),
			encodeMonitorId("tcp", tcp.id),
			encodeMonitorId("cron", cron.id),
			encodeMonitorId("flow", flow.id),
		]);
		expect(body.data.monitors[0]).toEqual({
			monitorId: encodeMonitorId("http", http.id),
			monitor: "Website",
			type: "http",
			target: "https://example.com/health",
			daysWithData: 2,
			totalChecks: 200,
			successfulChecks: 199,
			failedChecks: 1,
			uptimePercent: 99.5,
			avgResponseTimeMs: 40.5,
			maxResponseTimeMs: 60,
			daysDown: 0,
			daysDegraded: 0,
			maintenanceMinutes: 0,
		});
		expect(body.data.monitors[4]?.target).toBeNull();
		expect(body.data.monitors[4]?.uptimePercent).toBeNull();
	});

	test("leaves out another team's monitors", async () => {
		let team = await createTeamRow();
		let other = await createTeamRow();
		let key = await createApiKey(team.id);
		let own = await seedMonitor(team.id, "http");
		await seedMonitor(other.id, "http");

		let body = (await (await dispatch(SUMMARY_PATH, { key })).json()) as SummaryBody;

		expect(body.data.monitors.map((row) => row.monitorId)).toEqual([
			encodeMonitorId("http", own.id),
		]);
	});

	test("filters by monitor type", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);
		await seedMonitor(team.id, "http");
		let dns = await seedMonitor(team.id, "dns");

		let response = await dispatch(`${SUMMARY_PATH}?monitor_type=dns`, { key });

		let body = (await response.json()) as SummaryBody;
		expect(body.data.monitors.map((row) => row.monitorId)).toEqual([
			encodeMonitorId("dns", dns.id),
		]);
	});

	test("filters by the team's own status page", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);
		let shown = await seedMonitor(team.id, "http", "Shown");
		await seedMonitor(team.id, "http", "Hidden");
		let page = unwrap(
			await bindModels(db).statusPages.create({
				team_id: team.id,
				name: "Client",
				slug: `client-${crypto.randomUUID()}`,
				title: "Client",
			}),
		);
		await bindModels(db).statusPages.setMonitors(page.id, [shown.id]);

		let response = await dispatch(`${SUMMARY_PATH}?status_page_id=${encodeId("sp", page.id)}`, {
			key,
		});

		let body = (await response.json()) as SummaryBody;
		expect(body.data.monitors.map((row) => row.monitor)).toEqual(["Shown"]);
	});

	test("downloads the standard dialect as CSV for Accept: text/csv", async () => {
		let team = await createTeamRow("acme");
		let key = await createApiKey(team.id);
		let http = await seedMonitor(team.id, "http", "Website");
		await seedDay(http, "2026-08-01", { total: 100, successful: 99 });
		await seedDay(http, "2026-08-02", { total: 100, successful: 100 });

		let response = await dispatch(SUMMARY_PATH, { key, accept: "text/csv" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-summary-2026-08.csv"',
		);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Vary")).toMatch(/\baccept\b/i);

		let [header, row] = await csvRecords(response);
		expect(header).toEqual([
			"monitor",
			"type",
			"target",
			"days_with_data",
			"total_checks",
			"successful_checks",
			"failed_checks",
			"uptime_percent",
			"avg_response_time_ms",
			"max_response_time_ms",
			"days_down",
			"days_degraded",
			"maintenance_minutes",
		]);
		expect(row).toEqual([
			"Website",
			"http",
			"https://example.com/health",
			"2",
			"200",
			"199",
			"1",
			"99.5",
			"40.5",
			"60",
			"0",
			"0",
			"0",
		]);
	});

	test("names a range that is not a whole month by both ends", async () => {
		let team = await createTeamRow("acme");
		let key = await createApiKey(team.id);

		let response = await dispatch(`${SUMMARY_PATH}?from=2026-08-03&to=2026-09-01`, {
			key,
			accept: "text/csv",
		});

		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-summary-2026-08-03_2026-09-01.csv"',
		);
	});

	test("answers JSON for a wildcard Accept", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);

		let response = await dispatch(SUMMARY_PATH, { key, accept: "*/*" });

		expect(response.headers.get("Content-Type")).toContain("application/json");
		expect(response.headers.get("Vary")).toMatch(/\baccept\b/i);
	});
});

describe("GET /api/v1/reports/uptime-daily", () => {
	/** Two monitors with three August days each, six rows in the report's order. */
	async function seedSixRows(teamId: string) {
		let api = await seedMonitor(teamId, "http", "API");
		let website = await seedMonitor(teamId, "http", "Website");
		for (let monitor of [api, website]) {
			for (let date of ["2026-08-01", "2026-08-02", "2026-08-03"]) await seedDay(monitor, date);
		}
		return [api, website].flatMap((monitor) =>
			["2026-08-01", "2026-08-02", "2026-08-03"].map(
				(date) => `${encodeMonitorId("http", monitor.id)} ${date}`,
			),
		);
	}

	/** A row's position in the report, as the test compares pages. */
	function keyOf(day: DayJson) {
		return `${day.monitorId} ${day.date}`;
	}

	test("walks every row once across pages, forward and back", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);
		let expected = await seedSixRows(team.id);

		let first = await dispatch(`${DAILY_PATH}?perPage=4`, { key });
		expect(first.status).toBe(200);
		let firstBody = (await first.json()) as DailyBody;
		expect(firstBody.data.days.map(keyOf)).toEqual(expected.slice(0, 4));
		expect(firstBody.meta.pagination.prev).toBeNull();

		let next = parseLink(first.headers.get("Link"));
		if (next === null) return expect.unreachable("the first page links a next page");
		expect(next).toContain("perPage=4");

		let second = await dispatch(next, { key });
		let secondBody = (await second.json()) as DailyBody;
		expect(secondBody.data.days.map(keyOf)).toEqual(expected.slice(4));
		expect(secondBody.meta.pagination.next).toBeNull();
		expect(parseLink(second.headers.get("Link"))).toBeNull();

		let prev = parseLink(second.headers.get("Link"), "prev");
		if (prev === null) return expect.unreachable("the second page links back");
		let back = (await (await dispatch(prev, { key })).json()) as DailyBody;
		expect(back.data.days.map(keyOf)).toEqual(expected.slice(0, 4));
		expect(back.meta.pagination.prev).toBeNull();
	});

	test("keeps its place when an earlier monitor is deleted between pages", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);
		let expected = await seedSixRows(team.id);

		let first = await dispatch(`${DAILY_PATH}?perPage=4`, { key });
		let next = parseLink(first.headers.get("Link"));
		if (next === null) return expect.unreachable("the first page links a next page");
		let api = await db.findOne(monitors, { where: { name: "API" } });
		if (api) await db.delete(monitors, api.id);

		let second = (await (await dispatch(next, { key })).json()) as DailyBody;

		expect(second.data.days.map(keyOf)).toEqual(expected.slice(4));
	});

	test("refuses a cursor it did not mint", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);

		let response = await dispatch(`${DAILY_PATH}?cursor=not-a-cursor`, { key });

		expect(response.status).toBe(400);
		await expectProblem(response, "badRequest");
	});

	test("filters by monitor type and echoes the range", async () => {
		let team = await createTeamRow();
		let key = await createApiKey(team.id);
		let http = await seedMonitor(team.id, "http");
		let cron = await seedMonitor(team.id, "cron");
		await seedDay(http, "2026-08-10");
		await seedDay(cron, "2026-08-10", { total: 1, successful: 0, status: "down" });

		let response = await dispatch(`${DAILY_PATH}?from=2026-08-10&to=2026-08-10&monitor_type=cron`, {
			key,
		});

		let body = (await response.json()) as DailyBody;
		expect(body.data.from).toBe("2026-08-10");
		expect(body.data.days).toEqual([
			expect.objectContaining({
				date: "2026-08-10",
				monitorId: encodeMonitorId("cron", cron.id),
				monitor: "cron monitor",
				type: "cron",
				totalChecks: 1,
				uptimePercent: 0,
				status: "down",
			}),
		]);
	});

	test("downloads the whole range as CSV, unpaginated", async () => {
		let team = await createTeamRow("acme");
		let key = await createApiKey(team.id);
		await seedSixRows(team.id);

		let response = await dispatch(`${DAILY_PATH}?perPage=1`, { key, accept: "text/csv" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-daily-2026-08.csv"',
		);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Link")).toBeNull();

		let [header, ...rows] = await csvRecords(response);
		expect(header).toEqual([
			"date",
			"monitor",
			"type",
			"total_checks",
			"successful_checks",
			"failed_checks",
			"uptime_percent",
			"avg_response_time_ms",
			"max_response_time_ms",
			"status",
			"maintenance_minutes",
		]);
		expect(rows).toHaveLength(6);
		expect(rows[0]).toEqual([
			"2026-08-01",
			"API",
			"http",
			"10",
			"10",
			"0",
			"100",
			"40.5",
			"60",
			"up",
			"0",
		]);
	});
});
