/**
 * Tests `GET /api/v1/status`: derives each monitor's up/down/unknown state from its
 * latest `monitor_results` row and rolls that up into operational/partial_outage/
 * major_outage/unknown, requires `monitors:read` via `requireApiKey`, and only counts
 * the calling team's own monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { monitorResults, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/** `app/data/monitor.ts` imports `env` from `cloudflare:workers` for `Monitor.ping()`, which this route never calls, but the module-level import still needs a resolvable mock. */
await mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: createQueue() }),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

let { statusShow } = await import("./status");

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]) {
	let { key } = await ApiKey.create(db, teamId, { name: "test", scopes, expires_at: null });
	return key;
}

async function createMonitorRow(
	db: Db,
	teamId: string,
	overrides: { name?: string; enabled_at?: number | null; expected_status?: number } = {},
) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			author_id: crypto.randomUUID(),
			name: overrides.name ?? "Homepage",
			url: "https://example.com",
			enabled_at: "enabled_at" in overrides ? (overrides.enabled_at ?? null) : Date.now(),
			expected_status: overrides.expected_status ?? 200,
		},
		{ touch: true, returnRow: true },
	);
}

async function createMonitorResultRow(
	db: Db,
	monitorId: string,
	responseStatus: number | null,
	completedAt: number = Date.now(),
) {
	return await db.create(
		monitorResults,
		{
			id: crypto.randomUUID(),
			monitor_id: monitorId,
			completed_at: completedAt,
			response_status: responseStatus,
			response_time_ms: 42,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, key?: string) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.v1.status, statusShow);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let headers: Record<string, string> = {};
	if (key !== undefined) headers.Authorization = `Bearer ${key}`;

	let request = new Request(`https://uptime.test${routes.api.v1.status.href()}`, {
		method: "GET",
		headers,
	});

	return container.scope(() => router.fetch(request));
}

describe("GET /api/v1/status", () => {
	test("reports operational when every enabled monitor is up", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);
		await createMonitorResultRow(db, monitor.id, 200);

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { status: Record<string, unknown> } };
		expect(body.data.status.overall).toBe("operational");
		expect(body.data.status.summary).toEqual({ total: 1, up: 1, down: 0, degraded: 0, unknown: 0 });
	});

	test("reports partial_outage when some but not all enabled monitors are down", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let up = await createMonitorRow(db, team.id, { name: "Up" });
		let down = await createMonitorRow(db, team.id, { name: "Down" });
		await createMonitorResultRow(db, up.id, 200);
		await createMonitorResultRow(db, down.id, 500);

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { status: Record<string, unknown> } };
		expect(body.data.status.overall).toBe("partial_outage");
		expect(body.data.status.summary).toEqual({ total: 2, up: 1, down: 1, degraded: 0, unknown: 0 });
	});

	test("reports major_outage when every enabled monitor is down", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);
		await createMonitorResultRow(db, monitor.id, 500);

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { status: Record<string, unknown> } };
		expect(body.data.status.overall).toBe("major_outage");
		expect(body.data.status.summary).toEqual({ total: 1, up: 0, down: 1, degraded: 0, unknown: 0 });
	});

	test("marks a monitor unknown (but overall operational) when it has no completed result yet", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		await createMonitorRow(db, team.id);

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { status: Record<string, unknown> } };
		/** An `unknown`-status monitor is never counted as down, so the overall rollup stays `operational`. */
		expect(body.data.status.overall).toBe("operational");
		expect(body.data.status.summary).toEqual({ total: 1, up: 0, down: 0, degraded: 0, unknown: 1 });
	});

	test("reports unknown overall when the team's only monitor is disabled", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		await createMonitorRow(db, team.id, { enabled_at: null });

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { status: Record<string, unknown> } };
		expect(body.data.status.overall).toBe("unknown");
		expect(body.data.status.summary).toEqual({ total: 1, up: 0, down: 0, degraded: 0, unknown: 1 });
	});

	test("reports unknown when the team has no monitors at all", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { status: Record<string, unknown> } };
		expect(body.data.status.overall).toBe("unknown");
		expect(body.data.status.summary).toEqual({ total: 0, up: 0, down: 0, degraded: 0, unknown: 0 });
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db);
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, "not-a-real-key");
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(db, key);
		expect(response.status).toBe(403);
	});

	test("only counts the calling team's own monitors", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let otherTeam = await createTeamRow(db);
		let otherMonitor = await createMonitorRow(db, otherTeam.id, { name: "Not yours" });
		await createMonitorResultRow(db, otherMonitor.id, 200);

		let response = await dispatch(db, key);
		expect(response.status).toBe(200);

		let body = (await response.json()) as {
			data: { status: { monitors: Array<{ name: string }>; summary: { total: number } } };
		};
		expect(body.data.status.monitors).toEqual([]);
		expect(body.data.status.summary.total).toBe(0);
	});
});
