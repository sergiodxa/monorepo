/**
 * Tests the `/api/v1/memberships` endpoint: lists the authenticated team's
 * memberships. Covers the happy path, that only the calling team's memberships come
 * back (never another team's), missing/invalid API keys, and a key lacking
 * `teams:read`.
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
import { membershipsIndex } from "~/app/http/controllers/api/memberships";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

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

async function createMembershipRow(db: Db, teamId: string, role: "member" | "admin" = "member") {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: crypto.randomUUID(), role },
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.v1.memberships, membershipsIndex);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function request(method: string, url: string, options: { key?: string } = {}): Request {
	let headers: Record<string, string> = { "content-type": "application/json" };
	if (options.key) headers.Authorization = `Bearer ${options.key}`;

	return new Request(`https://uptime.test${url}`, { method, headers });
}

describe("GET /api/v1/memberships", () => {
	test("lists the team's memberships", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);
		let membership = await createMembershipRow(db, team.id, "admin");

		let response = await dispatch(db, request("GET", routes.api.v1.memberships.href(), { key }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { memberships: Array<{ id: string; role: string }> };
		};
		expect(body.data.memberships).toHaveLength(1);
		expect(body.data.memberships[0]?.id).toBe(membership.id);
		expect(body.data.memberships[0]?.role).toBe("admin");
	});

	test("only returns the calling team's memberships, never another team's", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		await createMembershipRow(db, team.id);
		await createMembershipRow(db, otherTeam.id);

		let response = await dispatch(db, request("GET", routes.api.v1.memberships.href(), { key }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { memberships: Array<{ teamId: string }> } };
		expect(body.data.memberships).toHaveLength(1);
		expect(body.data.memberships[0]?.teamId).toBe(team.id);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, request("GET", routes.api.v1.memberships.href()));
		expect(response.status).toBe(401);
	});

	test("returns 401 with a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			request("GET", routes.api.v1.memberships.href(), { key: "not-a-real-key" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking teams:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, request("GET", routes.api.v1.memberships.href(), { key }));
		expect(response.status).toBe(403);
	});
});
