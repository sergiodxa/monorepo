/**
 * Tests the status-page item endpoints: get/update/delete a single status page
 * (`status-pages:read`/`status-pages:write`) and replacing its attached HTTP monitors
 * and cron jobs via `PUT /api/v1/status-pages/:statusPageId/monitors`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { monitors, statusPageMonitors, statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

/** `app/data/monitor.ts` imports `env` from `cloudflare:workers` for `Monitor.ping()`, which this route never calls, but the module-level import still needs a resolvable mock. */
mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { send: mock(async () => {}) } },
	waitUntil: (promise: Promise<unknown>) => promise,
}));

let { default: statusPageController, statusPageRoutes } = await import("./status-page");

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

async function createMonitorRow(db: Db, teamId: string, name: string = "Homepage") {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			author_id: crypto.randomUUID(),
			name,
			url: "https://example.com",
			enabled_at: Date.now(),
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(statusPageRoutes, statusPageController);

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

describe("GET /api/v1/status-pages/:statusPageId", () => {
	test("returns the status page with its attached monitor/cron-job id lists", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.show.href({ statusPageId: statusPage.id }),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { statusPage: { id: string; monitors: string[]; cronJobs: string[] } };
		};
		expect(body.data.statusPage.id).toBe(statusPage.id);
		expect(body.data.statusPage.monitors).toEqual([]);
		expect(body.data.statusPage.cronJobs).toEqual([]);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.show.href({ statusPageId: statusPage.id }),
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key without the status-pages:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.show.href({ statusPageId: statusPage.id }),
			key,
		});
		expect(response.status).toBe(403);
	});

	test("404s when the status page doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);

		let otherTeam = await createTeamRow(db);
		let otherStatusPage = await createStatusPageRow(db, otherTeam.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.show.href({ statusPageId: otherStatusPage.id }),
			key,
		});
		expect(response.status).toBe(404);
	});
});

describe("PUT /api/v1/status-pages/:statusPageId", () => {
	test("updates a status page's own fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.update.href({ statusPageId: statusPage.id }),
			key,
			body: { name: "Renamed Status" },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { statusPage: { name: string } } };
		expect(body.data.statusPage.name).toBe("Renamed Status");

		let updated = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(updated?.name).toBe("Renamed Status");
	});

	test("returns a validation error for a slug already taken by another page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id, { slug: "mine" });
		await createStatusPageRow(db, team.id, { slug: "taken" });

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.update.href({ statusPageId: statusPage.id }),
			key,
			body: { slug: "taken" },
		});

		expect(response.status).toBe(400);
		let unchanged = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(unchanged?.slug).toBe("mine");
	});

	test("404s when the status page doesn't belong to the team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let otherTeam = await createTeamRow(db);
		let otherStatusPage = await createStatusPageRow(db, otherTeam.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.update.href({ statusPageId: otherStatusPage.id }),
			key,
			body: { name: "Hijacked" },
		});

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(statusPages, { where: { id: otherStatusPage.id } });
		expect(unchanged?.name).toBe("Public Status");
	});

	test("returns 403 for a key without the status-pages:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.update.href({ statusPageId: statusPage.id }),
			key,
			body: { name: "Hijacked" },
		});
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/status-pages/:statusPageId", () => {
	test("deletes a status page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.statusPages.destroy.href({ statusPageId: statusPage.id }),
			key,
		});

		expect(response.status).toBe(200);
		expect(await db.findOne(statusPages, { where: { id: statusPage.id } })).toBeNull();
	});

	test("404s when the status page doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let otherTeam = await createTeamRow(db);
		let otherStatusPage = await createStatusPageRow(db, otherTeam.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.statusPages.destroy.href({ statusPageId: otherStatusPage.id }),
			key,
		});

		expect(response.status).toBe(404);
		expect(await db.findOne(statusPages, { where: { id: otherStatusPage.id } })).not.toBeNull();
	});

	test("returns 403 for a key without the status-pages:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.statusPages.destroy.href({ statusPageId: statusPage.id }),
			key,
		});
		expect(response.status).toBe(403);
	});
});

describe("PUT /api/v1/status-pages/:statusPageId/monitors", () => {
	test("associates monitors owned by the team with the status page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.monitors.href({ statusPageId: statusPage.id }),
			key,
			body: { monitorIds: [monitor.id], cronJobIds: [] },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitors: string[] } };
		expect(body.data.monitors).toEqual([monitor.id]);

		let attached = await db.findMany(statusPageMonitors, {
			where: { status_page_id: statusPage.id },
		});
		expect(attached.map((row) => row.monitor_id)).toEqual([monitor.id]);
	});

	test("returns 404 when a monitor id doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let otherTeam = await createTeamRow(db);
		let otherMonitor = await createMonitorRow(db, otherTeam.id, "Not yours");

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.monitors.href({ statusPageId: statusPage.id }),
			key,
			body: { monitorIds: [otherMonitor.id], cronJobIds: [] },
		});

		expect(response.status).toBe(404);
		let attached = await db.findMany(statusPageMonitors, {
			where: { status_page_id: statusPage.id },
		});
		expect(attached).toHaveLength(0);
	});

	test("404s when the status page doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);

		let otherTeam = await createTeamRow(db);
		let otherStatusPage = await createStatusPageRow(db, otherTeam.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.monitors.href({ statusPageId: otherStatusPage.id }),
			key,
			body: { monitorIds: [], cronJobIds: [] },
		});
		expect(response.status).toBe(404);
	});

	test("returns 403 for a key without the status-pages:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.monitors.href({ statusPageId: statusPage.id }),
			key,
			body: { monitorIds: [], cronJobIds: [] },
		});
		expect(response.status).toBe(403);
	});
});
