/**
 * Tests the `/api/v1/monitors/:monitorId/content-checks` endpoints: list/create
 * content checks for a monitor, and delete a single check. Covers happy paths,
 * validation failures, missing/invalid API keys, wrong-scope keys, and that
 * cross-team scoping is enforced both on the parent monitor and on the content
 * check itself.
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
import { monitorContentChecks, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `app/data/monitor.ts` (imported by `./monitor-content-checks`) reads `env` from
 * `cloudflare:workers` at module load time, so it has to resolve under `bun test`. These
 * endpoints touch no binding, and the empty strict env proves it: any read would throw by
 * the binding's name instead of quietly answering `undefined`.
 */
await mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: monitorContentChecksController, monitorContentChecksRoutes } =
	await import("~/app/http/controllers/api/monitor-content-checks");

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

async function createMonitorRow(db: Db, teamId: string) {
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
		},
		{ touch: true, returnRow: true },
	);
}

async function createContentCheckRow(
	db: Db,
	monitorId: string,
	overrides: Record<string, unknown> = {},
) {
	return await db.create(
		monitorContentChecks,
		{
			id: crypto.randomUUID(),
			monitor_id: monitorId,
			type: "contains",
			value: "OK",
			case_sensitive: false,
			is_enabled: true,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(monitorContentChecksRoutes, monitorContentChecksController);

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

describe("GET /api/v1/monitors/:monitorId/content-checks", () => {
	test("lists the monitor's content checks", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);
		await createContentCheckRow(db, monitor.id, { value: "healthy" });

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.contentChecks.index.href({ monitorId: monitor.id }), {
				key,
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { contentChecks: Array<{ value: string }> } };
		expect(body.data.contentChecks).toHaveLength(1);
		expect(body.data.contentChecks[0]?.value).toBe("healthy");
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.monitors.contentChecks.index.href({ monitorId: monitor.id }), {
				key,
			}),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request(
				"GET",
				routes.api.v1.monitors.contentChecks.index.href({ monitorId: crypto.randomUUID() }),
			),
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
			request("GET", routes.api.v1.monitors.contentChecks.index.href({ monitorId: monitor.id }), {
				key,
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/monitors/:monitorId/content-checks", () => {
	test("creates a content check for the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.contentChecks.create.href({ monitorId: monitor.id }), {
				key,
				body: { type: "contains", value: "ok" },
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as { data: { contentCheck: { id: string; value: string } } };
		expect(body.data.contentCheck.value).toBe("ok");

		let created = await db.findOne(monitorContentChecks, {
			where: { id: body.data.contentCheck.id },
		});
		expect(created?.monitor_id).toBe(monitor.id);
	});

	test("returns 400 for an invalid regex", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.contentChecks.create.href({ monitorId: monitor.id }), {
				key,
				body: { type: "regex", value: "(" },
			}),
		);

		expect(response.status).toBe(400);
		expect(await db.count(monitorContentChecks, { where: { monitor_id: monitor.id } })).toBe(0);
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.monitors.contentChecks.create.href({ monitorId: monitor.id }), {
				key,
				body: { type: "contains", value: "ok" },
			}),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request(
				"POST",
				routes.api.v1.monitors.contentChecks.create.href({ monitorId: crypto.randomUUID() }),
				{ body: { type: "contains", value: "ok" } },
			),
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
			request("POST", routes.api.v1.monitors.contentChecks.create.href({ monitorId: monitor.id }), {
				key,
				body: { type: "contains", value: "ok" },
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/monitors/:monitorId/content-checks/:contentCheckId", () => {
	test("deletes the content check", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id);
		let contentCheck = await createContentCheckRow(db, monitor.id);

		let response = await dispatch(
			db,
			request(
				"DELETE",
				routes.api.v1.monitors.contentChecks.destroy.href({
					monitorId: monitor.id,
					contentCheckId: contentCheck.id,
				}),
				{ key },
			),
		);

		expect(response.status).toBe(200);
		expect(await db.findOne(monitorContentChecks, { where: { id: contentCheck.id } })).toBeNull();
	});

	test("404s when the monitor belongs to another team, without deleting the check", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, otherTeam.id);
		let contentCheck = await createContentCheckRow(db, monitor.id);

		let response = await dispatch(
			db,
			request(
				"DELETE",
				routes.api.v1.monitors.contentChecks.destroy.href({
					monitorId: monitor.id,
					contentCheckId: contentCheck.id,
				}),
				{ key },
			),
		);

		expect(response.status).toBe(404);
		expect(
			await db.findOne(monitorContentChecks, { where: { id: contentCheck.id } }),
		).not.toBeNull();
	});

	test("404s when the content check belongs to a different monitor on the same team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);
		let monitor = await createMonitorRow(db, team.id);
		let otherMonitor = await createMonitorRow(db, team.id);
		let contentCheck = await createContentCheckRow(db, otherMonitor.id);

		let response = await dispatch(
			db,
			request(
				"DELETE",
				routes.api.v1.monitors.contentChecks.destroy.href({
					monitorId: monitor.id,
					contentCheckId: contentCheck.id,
				}),
				{ key },
			),
		);

		expect(response.status).toBe(404);
		expect(
			await db.findOne(monitorContentChecks, { where: { id: contentCheck.id } }),
		).not.toBeNull();
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request(
				"DELETE",
				routes.api.v1.monitors.contentChecks.destroy.href({
					monitorId: crypto.randomUUID(),
					contentCheckId: crypto.randomUUID(),
				}),
			),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking monitors:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createMonitorRow(db, team.id);
		let contentCheck = await createContentCheckRow(db, monitor.id);

		let response = await dispatch(
			db,
			request(
				"DELETE",
				routes.api.v1.monitors.contentChecks.destroy.href({
					monitorId: monitor.id,
					contentCheckId: contentCheck.id,
				}),
				{ key },
			),
		);
		expect(response.status).toBe(403);
	});
});
