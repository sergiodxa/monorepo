/**
 * Tests `DELETE /api/v1/api-keys/:apiKeyId`: revokes an API key belonging to the
 * calling team, 404s (never leaking) for another team's key, and is itself gated by
 * `requireApiKey("api-keys:write")` like every other `/api/v1/*` endpoint.
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
import { apiKeyDestroy } from "~/app/http/controllers/api/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { apiKeys, teams } from "~/database/schema";
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
	let { record, key } = await ApiKey.create(db, teamId, {
		name: "test key",
		scopes,
		expires_at: null,
	});
	return { record, key };
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.v1.apiKeys.destroy, apiKeyDestroy);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function del(apiKeyId: string, key: string | null) {
	return new Request(`https://uptime.test${routes.api.v1.apiKeys.destroy.href({ apiKeyId })}`, {
		method: "DELETE",
		headers: key ? { Authorization: `Bearer ${key}` } : {},
	});
}

describe("DELETE /api/v1/api-keys/:apiKeyId", () => {
	test("deletes an API key belonging to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let { key } = await createApiKey(db, team.id, ["api-keys:write"]);
		let { record: target } = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, del(target.id, key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);
		expect(await db.findOne(apiKeys, { where: { id: target.id } })).toBeNull();
	});

	test("404s when the API key doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let { key } = await createApiKey(db, team.id, ["api-keys:write"]);
		let { record: target } = await createApiKey(db, otherTeam.id, ["monitors:read"]);

		let response = await dispatch(db, del(target.id, key));
		expect(response.status).toBe(404);
		expect(await db.findOne(apiKeys, { where: { id: target.id } })).not.toBeNull();
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let { record: target } = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, del(target.id, null));
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let { record: target } = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, del(target.id, "not-a-real-key"));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the api-keys:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let { key } = await createApiKey(db, team.id, ["api-keys:read"]);
		let { record: target } = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, del(target.id, key));
		expect(response.status).toBe(403);
		expect(await db.findOne(apiKeys, { where: { id: target.id } })).not.toBeNull();
	});
});
