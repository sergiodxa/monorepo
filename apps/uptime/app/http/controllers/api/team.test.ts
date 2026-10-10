/**
 * Tests the authenticated team's own profile endpoints: `GET /api/v1/team` reads it
 * (`teams:read`) and `PUT /api/v1/team` updates its name and/or logo (`teams:write`).
 * The team is always whichever one the bearer key resolves to via `requireApiKey`.
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
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { checkConformance } from "~/app/lib/test/openapi";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { teams } from "~/database/schema";
import { teamRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(teamRoutes);

let { default: teamController } = await import("./team");

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
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(teamRoutes, teamController);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
	});

	return router.fetch(httpRequest);
}

describe("GET /api/v1/team", () => {
	test("returns the authenticated team's profile", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:read"]);

		let response = await dispatch(db, { method: "GET", path: routes.api.v1.teamShow.href(), key });

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { team: { id: string; name: string } } };
		expect(body.data.team.id).toBe(encodeId("team", team.id));
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

	test.each(["http://example.com/logo.png", "ftp://example.com/logo.png", "javascript:alert(1)"])(
		"answers validation-error at /logoUrl for the non-https logo %j",
		async (logoUrl) => {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let key = await createApiKey(db, team.id, ["teams:write"]);

			let response = await dispatch(db, {
				method: "PUT",
				path: routes.api.v1.teamUpdate.href(),
				key,
				body: { logoUrl },
			});

			let problem = await expectProblem(response, "validationError");
			expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/logoUrl"]);
			let unchanged = await db.findOne(teams, { where: { id: team.id } });
			expect(unchanged?.logo).toBeNull();
		},
	);

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

describe("PATCH /api/v1/team", () => {
	/** A merge patch request, sent as `application/merge-patch+json` unless told otherwise. */
	function mergePatch(body: unknown, options: { key?: string; contentType?: string } = {}) {
		let headers: Record<string, string> = {
			"content-type": options.contentType ?? "application/merge-patch+json",
		};
		if (options.key) headers.Authorization = `Bearer ${options.key}`;
		return new Request(`https://uptime.test${routes.api.v1.teamPatch.href()}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(body),
		});
	}

	/** Sends `request` through the team controller, bypassing the JSON-body `dispatch`. */
	async function send(db: Db, request: Request) {
		let router = createRouter({
			middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
		});
		router.map(teamRoutes, teamController);
		return router.fetch(request);
	}

	/** A team whose stored logo is `logo`. */
	async function createTeamWithLogo(db: Db, logo: string) {
		let team = await createTeamRow(db);
		await db.update(teams, team.id, { logo });
		return team;
	}

	test("changes only the members the patch names", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamWithLogo(db, "https://example.com/logo.png");
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(db, mergePatch({ name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.name).toBe("Patched");
		expect(updated?.logo).toBe("https://example.com/logo.png");
	});

	test("null on logoUrl clears the logo", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamWithLogo(db, "https://example.com/logo.png");
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(db, mergePatch({ logoUrl: null }, { key }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { team: { logo: string | null } } };
		expect(body.data.team.logo).toBeNull();
		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.logo).toBeNull();
	});

	test("a stored logo that is not a URL survives a patch that leaves logoUrl alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamWithLogo(db, "not a url");
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(db, mergePatch({ name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.name).toBe("Patched");
		expect(updated?.logo).toBe("not a url");
	});

	test.each(["http://example.com/logo.png", "ftp://example.com/logo.png", "javascript:alert(1)"])(
		"answers validation-error at /logoUrl for the non-https logo %j",
		async (logoUrl) => {
			let { db } = createTestDatabase();
			let team = await createTeamWithLogo(db, "https://example.com/logo.png");
			let key = await createApiKey(db, team.id, ["teams:write"]);

			let response = await send(db, mergePatch({ logoUrl }, { key }));

			let problem = await expectProblem(response, "validationError");
			expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/logoUrl"]);
			let unchanged = await db.findOne(teams, { where: { id: team.id } });
			expect(unchanged?.logo).toBe("https://example.com/logo.png");
		},
	);

	test("a stored legacy http logo survives a patch that leaves logoUrl alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamWithLogo(db, "http://example.com/logo.png");
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(db, mergePatch({ name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.name).toBe("Patched");
		expect(updated?.logo).toBe("http://example.com/logo.png");
	});

	test("null on name answers validation-error at its pointer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(db, mergePatch({ name: null }, { key }));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/name"]);
		let unchanged = await db.findOne(teams, { where: { id: team.id } });
		expect(unchanged?.name).toBe("Acme");
	});

	test("accepts application/json as a merge patch", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(
			db,
			mergePatch(
				{ logoUrl: "https://example.com/new.png" },
				{ key, contentType: "application/json" },
			),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.logo).toBe("https://example.com/new.png");
	});

	test("answers unsupported-media-type with Accept-Patch for any other body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["teams:write"]);

		let response = await send(db, mergePatch({ name: "x" }, { key, contentType: "text/plain" }));

		expect(response.status).toBe(415);
		expect(response.headers.get("Accept-Patch")).toBe("application/merge-patch+json");
		await expectProblem(response, "unsupportedMediaType");
	});

	test("PUT keeps refusing a null logoUrl and an empty body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamWithLogo(db, "https://example.com/logo.png");
		let key = await createApiKey(db, team.id, ["teams:write"]);
		let path = routes.api.v1.teamUpdate.href();

		let nullLogo = await dispatch(db, { method: "PUT", path, key, body: { logoUrl: null } });
		let empty = await dispatch(db, { method: "PUT", path, key, body: {} });

		expect([nullLogo.status, empty.status]).toEqual([400, 400]);
		let unchanged = await db.findOne(teams, { where: { id: team.id } });
		expect(unchanged?.logo).toBe("https://example.com/logo.png");
	});

	test("401 without a key, 403 without teams:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let reader = await createApiKey(db, team.id, ["teams:read"]);

		let unauthorized = await send(db, mergePatch({ name: "x" }));
		let forbidden = await send(db, mergePatch({ name: "x" }, { key: reader }));

		expect([unauthorized.status, forbidden.status]).toEqual([401, 403]);
	});
});
