/**
 * Tests the status-page item endpoints: get/update/delete a single status page
 * (`status-pages:read`/`status-pages:write`) and replacing its attached HTTP monitors
 * and cron jobs via `PUT /api/v1/status-pages/:statusPageId/monitors`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { checkConformance } from "~/app/lib/test/openapi";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { monitors, statusPageMonitors, statusPages, teams } from "~/database/schema";
import { statusPageRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(statusPageRoutes);

/**
 * `app/data/monitor.ts` imports `env` from `cloudflare:workers` at module
 * scope for `Monitor.ping()`; loading this controller evaluates that import
 * eagerly, so the mock must resolve regardless of which handlers run.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: createQueue() }),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

let { default: models } = await import("~/app/http/middleware/models");
let { default: statusPageController } = await import("./status-page");

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
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(statusPageRoutes, statusPageController);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
	});

	return router.fetch(httpRequest);
}

describe("GET /api/v1/status-pages/:statusPageId", () => {
	test("returns the status page with its attached monitor/cron-job id lists", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:read"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.show.href({ statusPageId: encodeId("sp", statusPage.id) }),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { statusPage: { id: string; monitors: string[]; cronJobs: string[] } };
		};
		expect(body.data.statusPage.id).toBe(encodeId("sp", statusPage.id));
		expect(body.data.statusPage.monitors).toEqual([]);
		expect(body.data.statusPage.cronJobs).toEqual([]);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.statusPages.show.href({ statusPageId: encodeId("sp", statusPage.id) }),
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
			path: routes.api.v1.statusPages.show.href({ statusPageId: encodeId("sp", statusPage.id) }),
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
			path: routes.api.v1.statusPages.show.href({
				statusPageId: encodeId("sp", otherStatusPage.id),
			}),
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
			path: routes.api.v1.statusPages.update.href({ statusPageId: encodeId("sp", statusPage.id) }),
			key,
			body: { name: "Renamed Status" },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { statusPage: { name: string } } };
		expect(body.data.statusPage.name).toBe("Renamed Status");

		let updated = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(updated?.name).toBe("Renamed Status");
	});

	test("clears description, logoUrl and customDomain when sent as null", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);
		await db.update(statusPages, statusPage.id, {
			description: "About",
			logo_url: "https://example.com/logo.png",
			custom_domain: "status.example.com",
		});

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.update.href({ statusPageId: encodeId("sp", statusPage.id) }),
			key,
			body: { description: null, logoUrl: null, customDomain: null },
		});

		expect(response.status).toBe(200);
		let cleared = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(cleared?.description).toBeNull();
		expect(cleared?.logo_url).toBeNull();
		expect(cleared?.custom_domain).toBeNull();
	});

	test("answers 409 conflict for a slug already taken by another page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id, { slug: "mine" });
		await createStatusPageRow(db, team.id, { slug: "taken" });

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.update.href({ statusPageId: encodeId("sp", statusPage.id) }),
			key,
			body: { slug: "taken" },
		});

		await expectProblem(response, "conflict");
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
			path: routes.api.v1.statusPages.update.href({
				statusPageId: encodeId("sp", otherStatusPage.id),
			}),
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
			path: routes.api.v1.statusPages.update.href({ statusPageId: encodeId("sp", statusPage.id) }),
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
			path: routes.api.v1.statusPages.destroy.href({ statusPageId: encodeId("sp", statusPage.id) }),
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
			path: routes.api.v1.statusPages.destroy.href({
				statusPageId: encodeId("sp", otherStatusPage.id),
			}),
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
			path: routes.api.v1.statusPages.destroy.href({ statusPageId: encodeId("sp", statusPage.id) }),
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
			path: routes.api.v1.statusPages.monitors.href({
				statusPageId: encodeId("sp", statusPage.id),
			}),
			key,
			body: { monitorIds: [encodeId("mon", monitor.id)], cronJobIds: [] },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitors: string[] } };
		expect(body.data.monitors).toEqual([encodeId("mon", monitor.id)]);

		let attached = await db.findMany(statusPageMonitors, {
			where: { status_page_id: statusPage.id },
		});
		expect(attached.map((row) => row.monitor_id)).toEqual([monitor.id]);
	});

	test("attaches a monitor listed twice once", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let id = encodeId("mon", monitor.id);

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.statusPages.monitors.href({
				statusPageId: encodeId("sp", statusPage.id),
			}),
			key,
			body: { monitorIds: [id, id], cronJobIds: [] },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { monitors: string[] } };
		expect(body.data.monitors).toEqual([id]);
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
			path: routes.api.v1.statusPages.monitors.href({
				statusPageId: encodeId("sp", statusPage.id),
			}),
			key,
			body: { monitorIds: [encodeId("mon", otherMonitor.id)], cronJobIds: [] },
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
			path: routes.api.v1.statusPages.monitors.href({
				statusPageId: encodeId("sp", otherStatusPage.id),
			}),
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
			path: routes.api.v1.statusPages.monitors.href({
				statusPageId: encodeId("sp", statusPage.id),
			}),
			key,
			body: { monitorIds: [], cronJobIds: [] },
		});
		expect(response.status).toBe(403);
	});
});

describe("every item endpoint", () => {
	test.each([
		["GET", "show"],
		["PATCH", "patch"],
		["PUT", "update"],
		["DELETE", "destroy"],
		["PUT", "monitors"],
	] as const)("%s %s answers 401 without an API key", async (method, leaf) => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method,
			path: routes.api.v1.statusPages[leaf].href({ statusPageId: encodeId("sp", statusPage.id) }),
			body: method === "PUT" ? {} : undefined,
		});

		expect(response.status).toBe(401);
		await expectProblem(response, "unauthorized");
	});

	test.each([
		["GET", "show", "status-pages:read"],
		["PATCH", "patch", "status-pages:write"],
		["PUT", "update", "status-pages:write"],
		["DELETE", "destroy", "status-pages:write"],
		["PUT", "monitors", "status-pages:write"],
	] as const)("%s %s answers validation-error for a raw UUID", async (method, leaf, scope) => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, [scope]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await dispatch(db, {
			method,
			path: routes.api.v1.statusPages[leaf].href({ statusPageId: statusPage.id }),
			key,
			body: method === "PUT" ? {} : undefined,
		});

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
		expect(await db.findOne(statusPages, { where: { id: statusPage.id } })).not.toBeNull();
	});
});

describe("PATCH /api/v1/status-pages/:statusPageId", () => {
	/** A merge patch request, sent as `application/merge-patch+json` unless told otherwise. */
	function mergePatch(
		statusPageId: string,
		body: unknown,
		options: { key?: string; contentType?: string } = {},
	) {
		let headers: Record<string, string> = {
			"content-type": options.contentType ?? "application/merge-patch+json",
		};
		if (options.key) headers.Authorization = `Bearer ${options.key}`;
		let path = routes.api.v1.statusPages.patch.href({ statusPageId: encodeId("sp", statusPageId) });
		return new Request(`https://uptime.test${path}`, {
			method: "PATCH",
			headers,
			body: typeof body === "string" ? body : JSON.stringify(body),
		});
	}

	/** Runs `request` through the item controller behind the conformance check. */
	async function send(db: Db, request: Request) {
		let router = createRouter({
			middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
		});
		router.map(statusPageRoutes, statusPageController);
		return router.fetch(request);
	}

	test("changes only the members the patch names", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);
		await db.update(statusPages, statusPage.id, { description: "About", is_public: false });

		let response = await send(db, mergePatch(statusPage.id, { name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(updated?.name).toBe("Patched");
		expect(updated?.description).toBe("About");
		expect(updated?.is_public).toBe(false);
	});

	test("null clears a nullable member, resets a flag, and sets title back to name", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);
		await db.update(statusPages, statusPage.id, {
			title: "Custom Title",
			logo_url: "https://example.com/logo.png",
			is_public: false,
		});

		let response = await send(
			db,
			mergePatch(statusPage.id, { title: null, logoUrl: null, isPublic: null }, { key }),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(updated?.title).toBe("Public Status");
		expect(updated?.logo_url).toBeNull();
		expect(updated?.is_public).toBe(true);
	});

	test("null on a required member answers validation-error at its pointer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await send(db, mergePatch(statusPage.id, { slug: null }, { key }));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/slug"]);
	});

	test("re-sending the page's own slug skips the uniqueness check", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id, { slug: "mine" });

		let response = await send(db, mergePatch(statusPage.id, { slug: "mine" }, { key }));

		expect(response.status).toBe(200);
	});

	test("answers 409 conflict for a slug another page uses", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id, { slug: "mine" });
		await createStatusPageRow(db, team.id, { slug: "taken" });

		let response = await send(db, mergePatch(statusPage.id, { slug: "taken" }, { key }));

		await expectProblem(response, "conflict");
		let unchanged = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(unchanged?.slug).toBe("mine");
	});

	test("accepts application/json as a merge patch", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await send(
			db,
			mergePatch(
				statusPage.id,
				{ showOverallStatus: false },
				{ key, contentType: "application/json" },
			),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(updated?.show_overall_status).toBe(false);
	});

	test("answers unsupported-media-type with Accept-Patch for any other body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);

		let response = await send(
			db,
			mergePatch(statusPage.id, { name: "x" }, { key, contentType: "text/plain" }),
		);

		expect(response.status).toBe(415);
		expect(response.headers.get("Accept-Patch")).toBe("application/merge-patch+json");
		await expectProblem(response, "unsupportedMediaType");
	});

	test("PUT keeps refusing null on title and the flags, and clearing description", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["status-pages:write"]);
		let statusPage = await createStatusPageRow(db, team.id);
		await db.update(statusPages, statusPage.id, { description: "About" });
		let path = routes.api.v1.statusPages.update.href({
			statusPageId: encodeId("sp", statusPage.id),
		});

		let refused = await Promise.all(
			[{ title: null }, { isPublic: null }, { showOverallStatus: null }].map((body) =>
				dispatch(db, { method: "PUT", path, key, body }),
			),
		);
		let cleared = await dispatch(db, { method: "PUT", path, key, body: { description: null } });

		expect(refused.map((response) => response.status)).toEqual([400, 400, 400]);
		expect(cleared.status).toBe(200);
		let updated = await db.findOne(statusPages, { where: { id: statusPage.id } });
		expect(updated?.description).toBeNull();
		expect(updated?.is_public).toBe(true);
	});

	test("404s for another team's page, 403 without status-pages:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let writer = await createApiKey(db, team.id, ["status-pages:write"]);
		let reader = await createApiKey(db, team.id, ["status-pages:read"]);
		let foreign = await createStatusPageRow(db, otherTeam.id);
		let own = await createStatusPageRow(db, team.id);

		let notFound = await send(db, mergePatch(foreign.id, { name: "x" }, { key: writer }));
		let forbidden = await send(db, mergePatch(own.id, { name: "x" }, { key: reader }));

		expect([notFound.status, forbidden.status]).toEqual([404, 403]);
	});
});
