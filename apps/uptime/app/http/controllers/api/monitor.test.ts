/**
 * Tests the `/api/v1/monitors/:monitorId` item endpoints: get/update/delete, the
 * per-monitor stats rollup, paginated check-result history, and alert-delivery
 * history. Covers happy paths, validation failures, missing/invalid API keys,
 * wrong-scope keys, and that a monitor belonging to another team always 404s rather
 * than leaking data.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { alertEvents, monitorResults, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `app/data/monitor.ts` (imported by `./monitor`) reads `env` from `cloudflare:workers`
 * at module load time, so it has to resolve under `bun test`. These endpoints touch no
 * binding, and the empty strict env proves it: any read would throw by the binding's name
 * instead of quietly answering `undefined`.
 */
mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: monitorController, monitorRoutes } =
	await import("~/app/http/controllers/api/monitor");

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

async function createMonitorResultRow(
	db: Db,
	monitorId: string,
	overrides: Record<string, unknown> = {},
) {
	return await db.create(
		monitorResults,
		{
			id: crypto.randomUUID(),
			monitor_id: monitorId,
			completed_at: Date.now(),
			response_status: 200,
			response_time_ms: 120,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(monitorRoutes, monitorController);

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

describe("GET /api/v1/monitors/:monitorId", () => {
	test("returns the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id, { name: "My site" });

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.show.href({ monitorId: monitor.id }), { key }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitor: { name: string } } };
		expect(body.data.monitor.name).toBe("My site");
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.show.href({ monitorId: monitor.id }), { key }),
		);

		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.show.href({ monitorId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.show.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});

describe("PUT /api/v1/monitors/:monitorId", () => {
	test("updates the monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id, { name: "Old name" });

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.monitors.update.href({ monitorId: monitor.id }), {
				key,
				body: { name: "New name", intervalSeconds: 120 },
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitor: { name: string } } };
		expect(body.data.monitor.name).toBe("New name");

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("New name");
		expect(updated?.interval_seconds).toBe(120);
	});

	test("returns 400 for an invalid field value", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.monitors.update.href({ monitorId: monitor.id }), {
				key,
				body: { url: "not-a-url" },
			}),
		);

		expect(response.status).toBe(400);
		let unchanged = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(unchanged?.url).toBe("https://example.com");
	});

	test("404s when the monitor belongs to another team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, otherTeam.id, { name: "Not yours" });

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.monitors.update.href({ monitorId: monitor.id }), {
				key,
				body: { name: "Hijacked" },
			}),
		);

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(unchanged?.name).toBe("Not yours");
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.monitors.update.href({ monitorId: crypto.randomUUID() }), {
				body: { name: "x" },
			}),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.monitors.update.href({ monitorId: monitor.id }), {
				key,
				body: { name: "x" },
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/monitors/:monitorId", () => {
	test("deletes the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.monitors.destroy.href({ monitorId: monitor.id }), { key }),
		);

		expect(response.status).toBe(200);
		expect(await db.findOne(monitors, { where: { id: monitor.id } })).toBeNull();
	});

	test("404s when the monitor belongs to another team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.monitors.destroy.href({ monitorId: monitor.id }), { key }),
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(monitors, { where: { id: monitor.id } })).not.toBeNull();
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.monitors.destroy.href({ monitorId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.monitors.destroy.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/monitors/:monitorId/stats", () => {
	test("returns aggregate stats for the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);
		await createMonitorResultRow(db, monitor.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.itemStats.href({ monitorId: monitor.id }), { key }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { stats: { total: number } } };
		expect(body.data.stats.total).toBe(1);
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.itemStats.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.itemStats.href({ monitorId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.itemStats.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/monitors/:monitorId/results", () => {
	test("returns paginated check-result history", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);
		await createMonitorResultRow(db, monitor.id, { response_status: 200 });
		await createMonitorResultRow(db, monitor.id, { response_status: 500 });

		let response = await dispatch(
			db,
			request("GET", `${routes.api.v1.monitors.results.href({ monitorId: monitor.id })}?limit=1`, {
				key,
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { results: Array<{ responseStatus: number }>; pagination: { hasMore: boolean } };
		};
		expect(body.data.results).toHaveLength(1);
		expect(body.data.pagination.hasMore).toBe(true);
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.results.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.results.href({ monitorId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.results.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/monitors/:monitorId/alert-events", () => {
	test("returns alert-delivery history for the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let monitor = await createMonitorRow(db, team.id);

		await db.create(
			alertEvents,
			{
				id: crypto.randomUUID(),
				sent_at: Date.now(),
				alert_id: crypto.randomUUID(),
				monitor_id: monitor.id,
				event_type: "down",
				status: "sent",
				error_message: null,
				monitor_type: "http",
				monitor_name: monitor.name,
				snapshot: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.alertEvents.href({ monitorId: monitor.id }), { key }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { events: Array<{ eventType: string }> } };
		expect(body.data.events).toHaveLength(1);
		expect(body.data.events[0]?.eventType).toBe("down");
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.alertEvents.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.alertEvents.href({ monitorId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking alerts:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.alertEvents.href({ monitorId: monitor.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});
