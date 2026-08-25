/**
 * Tests the `/api/v1/maintenance` collection endpoints: listing and creating
 * maintenance windows for the authenticated team. Covers happy paths, validation
 * failures (a blank name, `endsAt` before `startsAt`, a `monitorId` scoped to another
 * team), missing/invalid API keys, wrong-scope keys, and that the index returns only
 * the calling team's windows.
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
import { maintenanceWindows, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `app/data/monitor.ts` reads `env` from `cloudflare:workers` at module load time, so it
 * must resolve under the test runner. An empty strict env proves these endpoints touch no
 * binding: any read throws by the binding's name instead of returning `undefined`.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: maintenanceController, maintenanceRoutes } =
	await import("~/app/http/controllers/api/maintenance");

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

async function createMaintenanceWindowRow(
	db: Db,
	teamId: string,
	overrides: Record<string, unknown> = {},
) {
	return await db.create(
		maintenanceWindows,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			monitor_id: null,
			name: "Scheduled maintenance",
			starts_at: Date.now(),
			ends_at: Date.now() + 3_600_000,
			ended_early_at: null,
			suppress_alerts: true,
			show_on_status_page: true,
			is_recurring: false,
			recurring_pattern: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(maintenanceRoutes, maintenanceController);

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

describe("GET /api/v1/maintenance", () => {
	test("lists only the calling team's maintenance windows", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);

		await createMaintenanceWindowRow(db, team.id, { name: "Mine" });
		await createMaintenanceWindowRow(db, otherTeam.id, { name: "Not mine" });

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.index.href(), { key }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { maintenanceWindows: Array<{ name: string }> };
		};
		expect(body.data.maintenanceWindows).toHaveLength(1);
		expect(body.data.maintenanceWindows[0]?.name).toBe("Mine");
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, request("GET", routes.api.v1.maintenance.index.href()));
		expect(response.status).toBe(401);
	});

	test("returns 401 with a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.index.href(), { key: "not-a-real-key" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking maintenance:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.index.href(), { key }),
		);
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/maintenance", () => {
	test("creates a maintenance window for the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "DB upgrade",
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: { maintenanceWindow: { id: string; name: string } };
		};
		expect(body.data.maintenanceWindow.name).toBe("DB upgrade");

		let created = await db.findOne(maintenanceWindows, {
			where: { id: body.data.maintenanceWindow.id },
		});
		expect(created?.team_id).toBe(team.id);
		expect(created?.starts_at).toBe(new Date("2026-08-01T00:00:00.000Z").getTime());
	});

	test("returns 400 for a blank name", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "",
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(400);
		expect(await db.count(maintenanceWindows, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 when endsAt is before startsAt", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "Backwards window",
					startsAt: "2026-08-01T02:00:00.000Z",
					endsAt: "2026-08-01T00:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(400);
		expect(await db.count(maintenanceWindows, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 404 when monitorId doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let otherMonitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "Scoped window",
					monitorId: otherMonitor.id,
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(404);
		expect(await db.count(maintenanceWindows, { where: { team_id: team.id } })).toBe(0);
	});

	/** The only thing a bare `monitorId` has ever meant, so clients sending one are unaffected. */
	test("reads a monitorId sent without a monitorType as an HTTP monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "Scoped window",
					monitorId: monitor.id,
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(201);
		let created = await db.findOne(maintenanceWindows, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("http");
		expect(created?.monitor_id).toBe(monitor.id);
	});

	test("covers a whole monitor type when monitorType is sent alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "Zone freeze",
					monitorType: "dns",
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(201);
		let created = await db.findOne(maintenanceWindows, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBeNull();
	});

	/** An HTTP monitor's id under a DNS type names nothing, so the request 404s. */
	test("returns 404 when the monitorId doesn't exist in the monitorType's own table", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "Wrong table",
					monitorType: "dns",
					monitorId: monitor.id,
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);

		expect(response.status).toBe(404);
		expect(await db.count(maintenanceWindows, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				body: {
					name: "x",
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking maintenance:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.create.href(), {
				key,
				body: {
					name: "x",
					startsAt: "2026-08-01T00:00:00.000Z",
					endsAt: "2026-08-01T02:00:00.000Z",
				},
			}),
		);
		expect(response.status).toBe(403);
	});
});
