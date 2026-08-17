/**
 * Tests the authenticated team's own profile endpoints: `GET /api/v1/team` reads it
 * (`teams:read`) and `PUT /api/v1/team` updates its name and/or logo (`teams:write`).
 * There's no id param and thus no cross-team-ownership case — the team is always
 * whichever one the bearer key resolves to via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: teamController, teamRoutes } = await import("./team");

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

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(teamRoutes, teamController);

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

describe("GET /api/v1/team", () => {
	test("returns the authenticated team's profile", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(db, { method: "GET", path: routes.api.v1.teamShow.href(), key });

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { team: { id: string; name: string } } };
		expect(body.data.team.id).toBe(team.id);
		expect(body.data.team.name).toBe("Acme");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, { method: "GET", path: routes.api.v1.teamShow.href() });
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.teamShow.href(),
			key: "not-a-real-key",
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the teams:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await dispatch(db, { method: "GET", path: routes.api.v1.teamShow.href(), key });
		expect(response.status).toBe(403);
	});
});

describe("PUT /api/v1/team", () => {
	test("updates the team's name", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.teamUpdate.href(),
			key,
			body: { name: "Renamed Team" },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { team: { name: string } } };
		expect(body.data.team.name).toBe("Renamed Team");

		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.name).toBe("Renamed Team");
	});

	test("updates the team's logo", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.teamUpdate.href(),
			key,
			body: { logoUrl: "https://example.com/logo.png" },
		});

		expect(response.status).toBe(200);
		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.logo).toBe("https://example.com/logo.png");
	});

	test("returns a validation error when neither name nor logoUrl is provided", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.teamUpdate.href(),
			key,
			body: {},
		});

		expect(response.status).toBe(400);
		let unchanged = await db.findOne(teams, { where: { id: team.id } });
		expect(unchanged?.name).toBe("Acme");
	});

	test("returns a validation error for an invalid logo URL", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.teamUpdate.href(),
			key,
			body: { logoUrl: "not-a-url" },
		});

		expect(response.status).toBe(400);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.teamUpdate.href(),
			body: { name: "Renamed Team" },
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the teams:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.teamUpdate.href(),
			key,
			body: { name: "Renamed Team" },
		});
		expect(response.status).toBe(403);
	});
});
