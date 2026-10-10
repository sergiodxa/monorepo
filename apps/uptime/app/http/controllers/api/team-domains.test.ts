/**
 * Tests the team-domains endpoints: list/add (`team-domains:read`/`team-domains:write`)
 * and remove one by id — `DELETE /api/v1/team-domains` reads the id from the JSON body
 * (see the controller's own docblock).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { markInFlight } from "~/app/lib/test/idempotency";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { teamDomains, teams } from "~/database/schema";
import { teamDomainsRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(teamDomainsRoutes);

/**
 * The queue a new domain's verification lands on. Module scope because the queue module
 * captures `env` on import, so `beforeEach` empties it rather than re-creating it.
 */
let queue: QueueMock = createQueue();

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let { default: models } = await import("~/app/http/middleware/models");
let { default: teamDomainsController } = await import("./team-domains");

beforeEach(() => {
	queue.reset();
});

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
	request: {
		method: string;
		path: string;
		key?: string;
		body?: Record<string, unknown>;
		headers?: Record<string, string>;
	},
) {
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(teamDomainsRoutes, teamDomainsController);

	let headers: Record<string, string> = {
		"content-type": "application/json",
		...request.headers,
	};
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
	});

	return router.fetch(httpRequest);
}

describe("GET /api/v1/team-domains total", () => {
	test("counts every domain on the team, not just the page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:read"]);
		await createTeamDomainRow(db, team.id, "one.example.com");
		await createTeamDomainRow(db, team.id, "two.example.com");
		await createTeamDomainRow(db, team.id, "three.example.com");
		// A domain the key cannot see must not reach the total either.
		await createTeamDomainRow(db, otherTeam.id, "other.example.com");

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.teamDomains.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { teamDomains: unknown[] };
			meta: { pagination: { total: number; perPage: number } };
		};
		expect(body.data.teamDomains).toHaveLength(1);
		expect(body.meta.pagination.total).toBe(3);
	});
});

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

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:read"]);
		await createTeamDomainRow(db, team.id, "first.example.com");
		await createTeamDomainRow(db, team.id, "second.example.com");

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.teamDomains.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { teamDomains: Array<{ hostname: string }> } };
		expect(body.data.teamDomains).toHaveLength(1);

		// Navigation rides in the headers, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, { method: "GET", path: next as string, key });
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as {
			data: { teamDomains: Array<{ hostname: string }> };
		};
		expect(secondBody.data.teamDomains).toHaveLength(1);
		expect(secondBody.data.teamDomains[0]?.hostname).not.toBe(body.data.teamDomains[0]?.hostname);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:read"]);

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.teamDomains.index.href()}?cursor=not-a-cursor`,
			key,
		});

		expect(response.status).toBe(400);
		await expectProblem(response, "badRequest");
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
		expect(queue.sent.map((message) => message.body)).toEqual([
			{ job: "verifyDomainOwnership", body: { teamDomainId: created?.id } },
		]);
	});

	test("answers 409 conflict for a hostname the team already added", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);
		let request = {
			method: "POST",
			path: routes.api.v1.teamDomains.create.href(),
			key,
			body: { hostname: "acme.example.com" },
		};

		expect((await dispatch(db, request)).status).toBe(201);
		await expectProblem(await dispatch(db, request), "conflict");
		expect(await db.count(teamDomains, { where: { team_id: team.id } })).toBe(1);
	});

	test("adds a hostname another team already added", async () => {
		let { db } = createTestDatabase();
		let otherTeam = await createTeamRow(db);
		let otherKey = await createApiKey(db, otherTeam.id, ["team-domains:write"]);
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);
		let body = { hostname: "shared.example.com" };
		let path = routes.api.v1.teamDomains.create.href();

		expect((await dispatch(db, { method: "POST", path, key: otherKey, body })).status).toBe(201);
		expect((await dispatch(db, { method: "POST", path, key, body })).status).toBe(201);
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
			body: { id: encodeId("dom", domain.id) },
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
			body: { id: encodeId("dom", otherDomain.id) },
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
			body: { id: encodeId("dom", domain.id) },
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
			body: { id: encodeId("dom", domain.id) },
		});
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/team-domains with an Idempotency-Key", () => {
	/** A create carrying `idempotencyKey`, so a test can send the same one twice. */
	function idempotentCreate(key: string, idempotencyKey: string, hostname: string) {
		return {
			method: "POST",
			path: routes.api.v1.teamDomains.create.href(),
			key,
			body: { hostname },
			headers: { "Idempotency-Key": idempotencyKey },
		};
	}

	test("a retry with the same key replays the first response and adds one domain", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		let first = await dispatch(db, idempotentCreate(key, '"retry-1"', "status.example.com"));
		let second = await dispatch(db, idempotentCreate(key, '"retry-1"', "status.example.com"));

		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
		expect(await second.json()).toEqual(await first.json());
		expect(await db.count(teamDomains, { where: { team_id: team.id } })).toBe(1);
	});

	test("a retry while the first request runs answers idempotency-key-in-use", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		await dispatch(db, idempotentCreate(key, '"in-flight"', "status.example.com"));
		await markInFlight(db);
		let response = await dispatch(db, idempotentCreate(key, '"in-flight"', "status.example.com"));

		expect(response.status).toBe(409);
		expect(response.headers.get("Retry-After")).toBe("1");
		await expectProblem(response, "idempotencyKeyInUse");
		expect(await db.count(teamDomains, { where: { team_id: team.id } })).toBe(1);
	});

	test("reusing a key for a different body answers idempotency-key-reused", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		await dispatch(db, idempotentCreate(key, '"reuse-1"', "a.example.com"));
		let response = await dispatch(db, idempotentCreate(key, '"reuse-1"', "b.example.com"));

		expect(response.status).toBe(422);
		await expectProblem(response, "idempotencyKeyReused");
		expect(await db.count(teamDomains, { where: { team_id: team.id } })).toBe(1);
	});

	test("an unquoted key answers idempotency-key-invalid and adds nothing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["team-domains:write"]);

		let response = await dispatch(db, idempotentCreate(key, "unquoted", "status.example.com"));

		expect(response.status).toBe(400);
		await expectProblem(response, "idempotencyKeyInvalid");
		expect(await db.count(teamDomains, { where: { team_id: team.id } })).toBe(0);
	});
});
