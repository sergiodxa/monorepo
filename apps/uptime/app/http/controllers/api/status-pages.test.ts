/**
 * Tests the status-pages collection endpoints: `GET /api/v1/status-pages` lists only
 * the calling team's pages and `POST /api/v1/status-pages` creates one with a
 * globally-unique slug, requiring `status-pages:read`/`status-pages:write` via
 * `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { markInFlight } from "~/app/lib/test/idempotency";
import { bindModels } from "~/app/lib/test/models";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem } from "~/app/lib/test/problem";
import { statusPages, teams } from "~/database/schema";
import { statusPagesRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(statusPagesRoutes);

let { default: statusPagesController } = await import("./status-pages");

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
	let { key } = unwrap(
		await bindModels(db).apiKeys.issue(teamId, { name: "test", scopes, expires_at: null }),
	);
	return key;
}

async function createStatusPageRow(db: Db, teamId: string, overrides: { slug?: string } = {}) {
	let slug = overrides.slug ?? `status-${crypto.randomUUID()}`;
	return await db.create(
		statusPages,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: "Public Status",
			slug,
			title: "Public Status",
			description: null,
			logo_url: null,
			custom_domain: null,
			is_public: true,
			show_overall_status: true,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(statusPagesRoutes, statusPagesController);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
	});

	return router.fetch(httpRequest);
}

describe("GET /api/v1/status-pages total", () => {
	test("counts every status page on the team, not just the page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		await createStatusPageRow(db, team.id);
		await createStatusPageRow(db, team.id);
		await createStatusPageRow(db, team.id);
		// A status page the key cannot see must not reach the total either.
		await createStatusPageRow(db, otherTeam.id);

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.statusPages.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { statusPages: unknown[] };
			meta: { pagination: { total: number; perPage: number } };
		};
		expect(body.data.statusPages).toHaveLength(1);
		expect(body.meta.pagination.total).toBe(3);
	});
});

describe("GET /api/v1/status-pages", () => {
	test("lists only the calling team's status pages", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		await createStatusPageRow(db, team.id, { slug: "acme-status" });

		let otherTeam = await createTeamRow(db);
		await createStatusPageRow(db, otherTeam.id, { slug: "other-status" });

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.index.href(),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { statusPages: Array<{ slug: string }> } };
		expect(body.data.statusPages).toHaveLength(1);
		expect(body.data.statusPages[0]?.slug).toBe("acme-status");
	});

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		await createStatusPageRow(db, team.id, { slug: "first-status" });
		await createStatusPageRow(db, team.id, { slug: "second-status" });

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.statusPages.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { statusPages: Array<{ slug: string }> } };
		expect(body.data.statusPages).toHaveLength(1);

		// Navigation rides in the headers, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, { method: "GET", path: next as string, key });
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as { data: { statusPages: Array<{ slug: string }> } };
		expect(secondBody.data.statusPages).toHaveLength(1);
		expect(secondBody.data.statusPages[0]?.slug).not.toBe(body.data.statusPages[0]?.slug);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.statusPages.index.href()}?cursor=not-a-cursor`,
			key,
		});

		expect(response.status).toBe(400);
		await expectProblem(response, "badRequest");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.index.href(),
		});
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.index.href(),
			key: "not-a-real-key",
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the status-pages:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.index.href(),
			key,
		});
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/status-pages", () => {
	test("creates a status page for the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.statusPages.create.href(),
			key,
			body: { name: "Acme Status", slug: "acme-status-page" },
		});

		expect(response.status).toBe(201);
		let body = (await response.json()) as { data: { statusPage: { slug: string; name: string } } };
		expect(body.data.statusPage.slug).toBe("acme-status-page");
		expect(body.data.statusPage.name).toBe("Acme Status");

		let created = await db.findOne(statusPages, { where: { team_id: team.id } });
		expect(created?.slug).toBe("acme-status-page");
	});

	test("returns a validation error for an invalid slug", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.statusPages.create.href(),
			key,
			body: { name: "Acme Status", slug: "Not A Valid Slug!" },
		});

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(0);
	});

	test("answers 409 conflict when the slug is already taken by another team", async () => {
		let { db } = createTestDatabase();
		let otherTeam = await createTeamRow(db);
		await createStatusPageRow(db, otherTeam.id, { slug: "taken-slug" });

		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.statusPages.create.href(),
			key,
			body: { name: "Acme Status", slug: "taken-slug" },
		});

		await expectProblem(response, "conflict");
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.statusPages.create.href(),
			body: { name: "Acme Status", slug: "acme-status-page" },
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the status-pages:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.statusPages.create.href(),
			key,
			body: { name: "Acme Status", slug: "acme-status-page" },
		});
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/status-pages with an Idempotency-Key", () => {
	/** A create carrying `idempotencyKey`, so a test can send the same one twice. */
	function idempotentCreate(key: string, idempotencyKey: string, body: unknown) {
		return new Request(`https://uptime.test${routes.api.v1.statusPages.create.href()}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"content-type": "application/json",
				"Idempotency-Key": idempotencyKey,
			},
			body: JSON.stringify(body),
		});
	}

	/** Runs `request` through the collection controller behind the conformance check. */
	async function send(db: Db, request: Request) {
		let router = createRouter({
			middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
		});
		router.map(statusPagesRoutes, statusPagesController);
		return router.fetch(request);
	}

	test("a retry with the same key replays the first response and creates one page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let body = { name: "Retried", slug: "retried-status" };

		let first = await send(db, idempotentCreate(key, '"retry-1"', body));
		let second = await send(db, idempotentCreate(key, '"retry-1"', body));

		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
		expect(await second.json()).toEqual(await first.json());
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(1);
	});

	test("a retry while the first request runs answers idempotency-key-in-use", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let body = { name: "Slow", slug: "slow-status" };

		await send(db, idempotentCreate(key, '"in-flight"', body));
		await markInFlight(db);
		let response = await send(db, idempotentCreate(key, '"in-flight"', body));

		expect(response.status).toBe(409);
		await expectProblem(response, "idempotencyKeyInUse");
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(1);
	});

	test("reusing a key for a different body answers idempotency-key-reused", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		await send(db, idempotentCreate(key, '"reuse-1"', { name: "A", slug: "a-status" }));
		let response = await send(
			db,
			idempotentCreate(key, '"reuse-1"', { name: "B", slug: "b-status" }),
		);

		expect(response.status).toBe(422);
		await expectProblem(response, "idempotencyKeyReused");
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(1);
	});

	test("an unquoted key answers idempotency-key-invalid and creates nothing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let response = await send(
			db,
			idempotentCreate(key, "unquoted", { name: "A", slug: "a-status" }),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "idempotencyKeyInvalid");
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(0);
	});
});
