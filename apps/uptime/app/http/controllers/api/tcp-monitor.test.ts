/**
 * Tests the TCP-monitor item endpoints: get/update/delete
 * (`tcp-monitors:read`/`tcp-monitors:write`) and paginated check-result history
 * (`tcp-monitors:read`), each scoped to a monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { tcpMonitorResults, tcpMonitors, teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: tcpMonitorController, tcpMonitorRoutes } = await import("./tcp-monitor");

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

async function createTcpMonitorRow(db: Db, teamId: string, name: string = "Redis") {
	return await db.create(
		tcpMonitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name,
			host: "redis.example.com",
			port: 6379,
		},
		{ touch: true, returnRow: true },
	);
}

async function createTcpMonitorResultRow(
	db: Db,
	tcpMonitorId: string,
	checkedAt: number = Date.now(),
) {
	return await db.create(
		tcpMonitorResults,
		{
			id: crypto.randomUUID(),
			tcp_monitor_id: tcpMonitorId,
			status: "up",
			response_time_ms: 12,
			error_message: null,
			checked_at: checkedAt,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(tcpMonitorRoutes, tcpMonitorController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
	});

	return container.scope(() => router.fetch(httpRequest));
}

describe("GET /api/v1/tcp-monitors/:tcpMonitorId", () => {
	test("returns a single TCP monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.show.href({ tcpMonitorId: monitor.id }),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitor: { id: string; host: string } } };
		expect(body.data.monitor.id).toBe(monitor.id);
		expect(body.data.monitor.host).toBe("redis.example.com");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.show.href({ tcpMonitorId: monitor.id }),
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the tcp-monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.show.href({ tcpMonitorId: monitor.id }),
			key,
		});
		expect(response.status).toBe(403);
	});

	test("404s when the TCP monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);

		let otherTeam = await createTeamRow(db);
		let otherMonitor = await createTcpMonitorRow(db, otherTeam.id, "Not yours");

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.show.href({ tcpMonitorId: otherMonitor.id }),
			key,
		});
		expect(response.status).toBe(404);
	});
});

describe("PUT /api/v1/tcp-monitors/:tcpMonitorId", () => {
	test("updates a TCP monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.tcpMonitors.update.href({ tcpMonitorId: monitor.id }),
			key,
			body: { name: "Renamed", port: 6380 },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitor: { name: string; port: number } } };
		expect(body.data.monitor.name).toBe("Renamed");
		expect(body.data.monitor.port).toBe(6380);

		let updated = await db.findOne(tcpMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.port).toBe(6380);
	});

	test("returns a validation error for an out-of-range timeout", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.tcpMonitors.update.href({ tcpMonitorId: monitor.id }),
			key,
			body: { timeoutMs: 999_999 },
		});

		expect(response.status).toBe(400);
		let unchanged = await db.findOne(tcpMonitors, { where: { id: monitor.id } });
		expect(unchanged?.timeout_ms).toBe(5000);
	});

	test("404s when the TCP monitor doesn't belong to the team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);

		let otherTeam = await createTeamRow(db);
		let otherMonitor = await createTcpMonitorRow(db, otherTeam.id, "Not yours");

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.tcpMonitors.update.href({ tcpMonitorId: otherMonitor.id }),
			key,
			body: { name: "Hijacked" },
		});

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(tcpMonitors, { where: { id: otherMonitor.id } });
		expect(unchanged?.name).toBe("Not yours");
	});

	test("returns 403 for a key without the tcp-monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.tcpMonitors.update.href({ tcpMonitorId: monitor.id }),
			key,
			body: { name: "Hijacked" },
		});
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/tcp-monitors/:tcpMonitorId", () => {
	test("deletes a TCP monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.tcpMonitors.destroy.href({ tcpMonitorId: monitor.id }),
			key,
		});

		expect(response.status).toBe(200);
		expect(await db.findOne(tcpMonitors, { where: { id: monitor.id } })).toBeNull();
	});

	test("404s when the TCP monitor doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);

		let otherTeam = await createTeamRow(db);
		let otherMonitor = await createTcpMonitorRow(db, otherTeam.id, "Not yours");

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.tcpMonitors.destroy.href({ tcpMonitorId: otherMonitor.id }),
			key,
		});

		expect(response.status).toBe(404);
		expect(await db.findOne(tcpMonitors, { where: { id: otherMonitor.id } })).not.toBeNull();
	});

	test("returns 403 for a key without the tcp-monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.tcpMonitors.destroy.href({ tcpMonitorId: monitor.id }),
			key,
		});
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/tcp-monitors/:tcpMonitorId/results", () => {
	test("returns paginated check-result history", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);
		let monitor = await createTcpMonitorRow(db, team.id);
		await createTcpMonitorResultRow(db, monitor.id, 1000);
		await createTcpMonitorResultRow(db, monitor.id, 2000);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.results.href({ tcpMonitorId: monitor.id }),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { results: Array<{ checkedAt: number }>; pagination: { hasMore: boolean } };
		};
		expect(body.data.results).toHaveLength(2);
		expect(body.data.results[0]?.checkedAt).toBe(2000);
		expect(body.data.pagination.hasMore).toBe(false);
	});

	test("404s when the TCP monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);

		let otherTeam = await createTeamRow(db);
		let otherMonitor = await createTcpMonitorRow(db, otherTeam.id, "Not yours");

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.results.href({ tcpMonitorId: otherMonitor.id }),
			key,
		});
		expect(response.status).toBe(404);
	});

	test("returns 403 for a key without the tcp-monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);
		let monitor = await createTcpMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.results.href({ tcpMonitorId: monitor.id }),
			key,
		});
		expect(response.status).toBe(403);
	});
});
