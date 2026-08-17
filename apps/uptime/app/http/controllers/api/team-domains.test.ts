/**
 * Tests the team-domains endpoints: list/add (`team-domains:read`/`team-domains:write`)
 * and remove one by id — `DELETE /api/v1/team-domains` has no id route segment, so the
 * id is read from the JSON body instead (see the controller's own docblock).
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
import { teamDomains, teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: teamDomainsController, teamDomainsRoutes } = await import("./team-domains");

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

async function createTeamDomainRow(db: Db, teamId: string, hostname: string = "example.com") {
	return await db.create(
		teamDomains,
		{ id: crypto.randomUUID(), team_id: teamId, hostname, verified_at: null },
		{ touch: true, returnRow: true },
	);
}

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(teamDomainsRoutes, teamDomainsController);

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

describe("GET /api/v1/team-domains", () => {
	test("lists only the calling team's domains", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:read"]);
		await createTeamDomainRow(db, team.id, "acme.example.com");

		let otherTeam = await createTeamRow(db);
		await createTeamDomainRow(db, otherTeam.id, "other.example.com");

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.teamDomains.index.href(),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { teamDomains: Array<{ hostname: string }> } };
		expect(body.data.teamDomains).toHaveLength(1);
		expect(body.data.teamDomains[0]?.hostname).toBe("acme.example.com");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.teamDomains.index.href(),
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the team-domains:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.teamDomains.index.href(),
			key,
		});
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/team-domains", () => {
	test("adds a pending-verification domain for the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.teamDomains.create.href(),
			key,
			body: { hostname: "acme.example.com" },
		});

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: { teamDomain: { hostname: string; verifiedAt: number | null } };
		};
		expect(body.data.teamDomain.hostname).toBe("acme.example.com");
		expect(body.data.teamDomain.verifiedAt).toBeNull();

		let created = await db.findOne(teamDomains, { where: { team_id: team.id } });
		expect(created?.hostname).toBe("acme.example.com");
	});

	test("returns a validation error for a blank hostname", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.teamDomains.create.href(),
			key,
			body: { hostname: "" },
		});

		expect(response.status).toBe(400);
		expect(await db.count(teamDomains, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.teamDomains.create.href(),
			body: { hostname: "acme.example.com" },
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the team-domains:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:read"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.teamDomains.create.href(),
			key,
			body: { hostname: "acme.example.com" },
		});
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/team-domains", () => {
	test("removes a domain by id given in the JSON body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);
		let domain = await createTeamDomainRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.teamDomains.destroy.href(),
			key,
			body: { id: domain.id },
		});

		expect(response.status).toBe(200);
		expect(await db.findOne(teamDomains, { where: { id: domain.id } })).toBeNull();
	});

	test("404s when the domain doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		let otherTeam = await createTeamRow(db);
		let otherDomain = await createTeamDomainRow(db, otherTeam.id, "other.example.com");

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.teamDomains.destroy.href(),
			key,
			body: { id: otherDomain.id },
		});

		expect(response.status).toBe(404);
		expect(await db.findOne(teamDomains, { where: { id: otherDomain.id } })).not.toBeNull();
	});

	test("returns a validation error when id is missing from the body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);
		let domain = await createTeamDomainRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.teamDomains.destroy.href(),
			key,
			body: {},
		});

		expect(response.status).toBe(400);
		expect(await db.findOne(teamDomains, { where: { id: domain.id } })).not.toBeNull();
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let domain = await createTeamDomainRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.teamDomains.destroy.href(),
			body: { id: domain.id },
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the team-domains:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:read"]);
		let domain = await createTeamDomainRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.teamDomains.destroy.href(),
			key,
			body: { id: domain.id },
		});
		expect(response.status).toBe(403);
	});
});
