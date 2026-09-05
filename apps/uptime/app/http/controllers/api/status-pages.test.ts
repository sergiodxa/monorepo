/**
 * Tests the status-pages collection endpoints: `GET /api/v1/status-pages` lists only
 * the calling team's pages and `POST /api/v1/status-pages` creates one with a
 * globally-unique slug, requiring `status-pages:read`/`status-pages:write` via
 * `requireApiKey`.
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
import { parseLink } from "~/app/lib/test/paging";
import { statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: statusPagesController, statusPagesRoutes } = await import("./status-pages");

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
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(statusPagesRoutes, statusPagesController);

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
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("BAD_REQUEST");
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
		expect(await db.count(statusPages, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns a validation error when the slug is already taken by another team", async () => {
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

		expect(response.status).toBe(400);
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
