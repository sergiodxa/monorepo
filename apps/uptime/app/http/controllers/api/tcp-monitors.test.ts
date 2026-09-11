/**
 * Tests the TCP-monitors collection endpoints: `GET /api/v1/tcp-monitors` lists only
 * the calling team's TCP monitors and `POST /api/v1/tcp-monitors` creates one,
 * requiring `tcp-monitors:read`/`tcp-monitors:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { parseLink } from "~/app/lib/test/paging";
import { tcpMonitors, teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: tcpMonitorsController, tcpMonitorsRoutes } = await import("./tcp-monitors");

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

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({ middleware: [asyncContext(), database(() => db)] });
	router.map(tcpMonitorsRoutes, tcpMonitorsController);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
	});

	return router.fetch(httpRequest);
}

describe("GET /api/v1/tcp-monitors", () => {
	test("lists only the calling team's TCP monitors", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);
		await createTcpMonitorRow(db, team.id, "Mine");

		let otherTeam = await createTeamRow(db);
		await createTcpMonitorRow(db, otherTeam.id, "Not yours");

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.index.href(),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitors: Array<{ name: string }> } };
		expect(body.data.monitors).toHaveLength(1);
		expect(body.data.monitors[0]?.name).toBe("Mine");
	});

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);
		let older = await createTcpMonitorRow(db, team.id, "Older");
		/**
		 * Force a distinct `created_at` so the walk is deterministic — two creates in the
		 * same millisecond would otherwise tie on the leading sort key.
		 */
		await db.update(
			tcpMonitors,
			older.id,
			{ created_at: older.created_at - 1000 },
			{ touch: false },
		);
		await createTcpMonitorRow(db, team.id, "Newer");

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.tcpMonitors.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitors: Array<{ name: string }> } };
		expect(body.data.monitors).toHaveLength(1);
		expect(body.data.monitors[0]?.name).toBe("Newer");

		// Navigation rides in the headers now, so following the list means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, { method: "GET", path: next as string, key });
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as { data: { monitors: Array<{ name: string }> } };
		expect(secondBody.data.monitors).toHaveLength(1);
		expect(secondBody.data.monitors[0]?.name).toBe("Older");
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.tcpMonitors.index.href()}?cursor=not-a-cursor`,
			key,
		});

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("BAD_REQUEST");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.index.href(),
		});
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.index.href(),
			key: "not-a-real-key",
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the tcp-monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.tcpMonitors.index.href(),
			key,
		});
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/tcp-monitors", () => {
	test("creates a TCP monitor for the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.tcpMonitors.create.href(),
			key,
			body: { name: "Redis", host: "redis.example.com", port: 6379 },
		});

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: { monitor: { name: string; host: string; port: number; timeoutMs: number } };
		};
		expect(body.data.monitor.name).toBe("Redis");
		expect(body.data.monitor.host).toBe("redis.example.com");
		expect(body.data.monitor.port).toBe(6379);
		expect(body.data.monitor.timeoutMs).toBe(5000);

		let created = await db.findOne(tcpMonitors, { where: { team_id: team.id } });
		expect(created?.host).toBe("redis.example.com");
	});

	test("returns a validation error for an out-of-range port", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.tcpMonitors.create.href(),
			key,
			body: { name: "Redis", host: "redis.example.com", port: 999_999 },
		});

		expect(response.status).toBe(400);
		expect(await db.count(tcpMonitors, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.tcpMonitors.create.href(),
			body: { name: "Redis", host: "redis.example.com", port: 6379 },
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the tcp-monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.tcpMonitors.create.href(),
			key,
			body: { name: "Redis", host: "redis.example.com", port: 6379 },
		});
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/tcp-monitors total", () => {
	test("counts every TCP monitor on the team, not just the page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["tcp-monitors:read"]);

		await createTcpMonitorRow(db, team.id, "One");
		await createTcpMonitorRow(db, team.id, "Two");
		await createTcpMonitorRow(db, team.id, "Three");
		// A monitor the key cannot see must not reach the total either.
		await createTcpMonitorRow(db, otherTeam.id, "Theirs");

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.tcpMonitors.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { monitors: unknown[] };
			meta: { pagination: { total: number } };
		};
		expect(body.data.monitors).toHaveLength(1);
		expect(body.meta.pagination.total).toBe(3);
	});
});
