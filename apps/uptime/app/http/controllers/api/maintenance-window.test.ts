/**
 * Tests the `/api/v1/maintenance/:maintenanceId` item endpoints: get/update/delete
 * and ending a window early. Covers happy paths, validation failures, missing/invalid
 * API keys, wrong-scope keys, and that a window belonging to another team always
 * 404s, leaving its data and state untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
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

let { default: maintenanceWindowController, maintenanceWindowRoutes } =
	await import("~/app/http/controllers/api/maintenance-window");

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
	router.map(maintenanceWindowRoutes, maintenanceWindowController);

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

describe("GET /api/v1/maintenance/:maintenanceId", () => {
	test("returns the maintenance window", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);
		let window = await createMaintenanceWindowRow(db, team.id, { name: "My window" });

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.show.href({ maintenanceId: window.id }), { key }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { maintenanceWindow: { name: string } } };
		expect(body.data.maintenanceWindow.name).toBe("My window");
	});

	test("404s when the window belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);
		let window = await createMaintenanceWindowRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.show.href({ maintenanceId: window.id }), { key }),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.show.href({ maintenanceId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking maintenance:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);
		let window = await createMaintenanceWindowRow(db, team.id);

		let response = await dispatch(
			db,
			request("GET", routes.api.v1.maintenance.show.href({ maintenanceId: window.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});

describe("PUT /api/v1/maintenance/:maintenanceId", () => {
	test("updates the window's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, team.id, { name: "Old name" });

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { name: "New name", suppressAlerts: false },
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { maintenanceWindow: { name: string } } };
		expect(body.data.maintenanceWindow.name).toBe("New name");

		let updated = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(updated?.name).toBe("New name");
		expect(updated?.suppress_alerts).toBeFalsy();
	});

	test("returns 400 when the update would put endsAt before startsAt", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, team.id, {
			starts_at: new Date("2026-08-01T00:00:00.000Z").getTime(),
			ends_at: new Date("2026-08-01T02:00:00.000Z").getTime(),
		});

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { endsAt: "2026-07-31T00:00:00.000Z" },
			}),
		);

		expect(response.status).toBe(400);
		let unchanged = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(unchanged?.ends_at).toBe(new Date("2026-08-01T02:00:00.000Z").getTime());
	});

	test("returns 404 when monitorId doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, team.id);
		let otherMonitor = await createMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { monitorId: otherMonitor.id },
			}),
		);

		expect(response.status).toBe(404);
	});

	/**
	 * The pair moves as a unit: narrowing a window to a whole type clears the monitor id
	 * it used to carry, keeping the scope at the whole type everyone asked for.
	 */
	test("clears the monitor id when only a monitorType is sent", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let monitor = await createMonitorRow(db, team.id);
		let window = await createMaintenanceWindowRow(db, team.id, {
			monitor_type: "http",
			monitor_id: monitor.id,
		});

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { monitorType: "dns" },
			}),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(updated?.monitor_type).toBe("dns");
		expect(updated?.monitor_id).toBeNull();
	});

	test("leaves the scope alone when neither scope field is sent", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let monitor = await createMonitorRow(db, team.id);
		let window = await createMaintenanceWindowRow(db, team.id, {
			monitor_type: "http",
			monitor_id: monitor.id,
		});

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { name: "Renamed" },
			}),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.monitor_type).toBe("http");
		expect(updated?.monitor_id).toBe(monitor.id);
	});

	test("404s when the window belongs to another team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, otherTeam.id, { name: "Not yours" });

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { name: "Hijacked" },
			}),
		);

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(unchanged?.name).toBe("Not yours");
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request(
				"PUT",
				routes.api.v1.maintenance.update.href({ maintenanceId: crypto.randomUUID() }),
				{
					body: { name: "x" },
				},
			),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking maintenance:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);
		let window = await createMaintenanceWindowRow(db, team.id);

		let response = await dispatch(
			db,
			request("PUT", routes.api.v1.maintenance.update.href({ maintenanceId: window.id }), {
				key,
				body: { name: "x" },
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/maintenance/:maintenanceId", () => {
	test("deletes the maintenance window", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, team.id);

		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.maintenance.destroy.href({ maintenanceId: window.id }), {
				key,
			}),
		);

		expect(response.status).toBe(200);
		expect(await db.findOne(maintenanceWindows, { where: { id: window.id } })).toBeNull();
	});

	test("404s when the window belongs to another team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.maintenance.destroy.href({ maintenanceId: window.id }), {
				key,
			}),
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(maintenanceWindows, { where: { id: window.id } })).not.toBeNull();
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request(
				"DELETE",
				routes.api.v1.maintenance.destroy.href({ maintenanceId: crypto.randomUUID() }),
			),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking maintenance:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);
		let window = await createMaintenanceWindowRow(db, team.id);

		let response = await dispatch(
			db,
			request("DELETE", routes.api.v1.maintenance.destroy.href({ maintenanceId: window.id }), {
				key,
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/maintenance/:maintenanceId/end", () => {
	test("ends the maintenance window early", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, team.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.end.href({ maintenanceId: window.id }), { key }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { maintenanceWindow: { endedEarlyAt: number | null } };
		};
		expect(body.data.maintenanceWindow.endedEarlyAt).not.toBeNull();

		let updated = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(updated?.ended_early_at).not.toBeNull();
	});

	test("404s when the window belongs to another team, without ending it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:write"]);
		let window = await createMaintenanceWindowRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.end.href({ maintenanceId: window.id }), { key }),
		);

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(unchanged?.ended_early_at).toBeNull();
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.end.href({ maintenanceId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking maintenance:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["maintenance:read"]);
		let window = await createMaintenanceWindowRow(db, team.id);

		let response = await dispatch(
			db,
			request("POST", routes.api.v1.maintenance.end.href({ maintenanceId: window.id }), { key }),
		);
		expect(response.status).toBe(403);
	});
});
