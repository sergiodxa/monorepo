/**
 * Tests the `/api/v1/monitors` collection endpoints: listing and creating HTTP
 * monitors for the authenticated team, and the team-wide stats rollup. Covers the
 * happy paths, validation failures, missing/invalid API keys, wrong-scope keys, and
 * that the index never leaks another team's monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `app/data/monitor.ts` (imported by `./monitors`) reads `env` from `cloudflare:workers`
 * at module load time, so it has to resolve under `bun test`. These endpoints touch no
 * binding, and the empty strict env proves it: any read would throw by the binding's name
 * instead of quietly answering `undefined`.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: monitorsController, monitorsRoutes } =
	await import("~/app/http/controllers/api/monitors");

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

async function createMonitorRow(db: Db, teamId: string, overrides: Record<string, unknown> = {}) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			author_id: crypto.randomUUID(),
			name: "Example",
			url: "https://example.com",
			method: "HEAD",
			expected_status: 200,
			interval_seconds: 60,
			degraded_after_ms: 5000,
			timeout_seconds: 10,
			location_hint: "wnam",
			enabled_at: Date.now(),
			ssl_monitoring_enabled: false,
			ssl_expiry_warning_days: 30,
			ssl_expires_at: null,
			ssl_issuer: null,
			ssl_last_checked_at: null,
			ssl_status: "unknown",
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(monitorsRoutes, monitorsController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function request(
	method: string,
	url: string,
	options: { key?: string; body?: unknown } = {},
): Request {
	let headers: Record<string, string> = { "content-type": "application/json" };
	if (options.key) headers.Authorization = `Bearer ${options.key}`;

	return new Request(`https://uptime.test${url}`, {
		method,
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});
}

describe("GET /api/v1/monitors", () => {
	test("lists only the calling team's monitors", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		await createMonitorRow(db, team.id, { name: "Mine" });
		await createMonitorRow(db, otherTeam.id, { name: "Not mine" });

		let response = await dispatch(db, request("GET", routes.api.v1.monitors.index.href(), { key }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitors: Array<{ name: string }> } };
		expect(body.data.monitors).toHaveLength(1);
		expect(body.data.monitors[0]?.name).toBe("Mine");
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, request("GET", routes.api.v1.monitors.index.href()));
		expect(response.status).toBe(401);
	});

	test("returns 401 with a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.index.href(), { key: "not-a-real-key" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(db, request("GET", routes.api.v1.monitors.index.href(), { key }));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/monitors", () => {
	test("creates an HTTP monitor for the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.create.href(), {
				key,
				body: { name: "New monitor", url: "https://example.com/health" },
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as { data: { monitor: { id: string; name: string } } };
		expect(body.data.monitor.name).toBe("New monitor");

		let created = await db.findOne(monitors, { where: { id: body.data.monitor.id } });
		expect(created?.team_id).toBe(team.id);
		expect(created?.url).toBe("https://example.com/health");
	});

	test("returns 400 for an invalid url", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.create.href(), {
				key,
				body: { name: "Bad monitor", url: "not-a-url" },
			}),
		);

		expect(response.status).toBe(400);
		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.create.href(), {
				body: { name: "x", url: "https://example.com" },
			}),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.create.href(), {
				key,
				body: { name: "x", url: "https://example.com" },
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/monitors/stats", () => {
	test("returns aggregate stats for the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, request("GET", routes.api.v1.monitors.stats.href(), { key }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { stats: { total: number; uptime: number | null } };
		};
		expect(body.data.stats.total).toBe(0);
		expect(body.data.stats.uptime).toBeNull();
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, request("GET", routes.api.v1.monitors.stats.href()));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(db, request("GET", routes.api.v1.monitors.stats.href(), { key }));
		expect(response.status).toBe(403);
	});
});
