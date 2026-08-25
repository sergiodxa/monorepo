/**
 * Integration tests for `requireApiKey`. They run the real hash lookup
 * (`ApiKey.findByHash` / `Team.findByIdOrSlug`) against an in-memory SQLite database
 * with real migrations applied, to verify a valid key with the right scope reaches
 * the handler with `ctx.apiKey`/`ctx.apiTeam` populated and `last_used_at` touched,
 * and that a missing, unknown, expired, or under-scoped key each resolve to the
 * expected 401/403.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { apiKeys, teams } from "~/database/schema";

type Db = ReturnType<typeof createTestDatabase>["db"];

async function seedTeam(db: Db) {
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

async function seedApiKey(
	db: Db,
	teamId: string,
	scopes: ApiKeyScope[],
	expires_at: number | null = null,
) {
	return await ApiKey.create(db, teamId, { name: "Test key", scopes, expires_at });
}

async function dispatch(db: Db, scope: ApiKeyScope, headers: Record<string, string> = {}) {
	let router = createRouter();

	router.get("/test", {
		middleware: [requireApiKey(scope)],
		handler(ctx) {
			return Response.json({ apiKeyId: ctx.apiKey.id, apiTeamId: ctx.apiTeam.id });
		},
	});

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let request = new Request("https://example.com/test", { headers });
	return container.scope(() => router.fetch(request));
}

describe("requireApiKey", () => {
	test("accepts a valid key with the required scope and exposes ctx.apiKey/ctx.apiTeam", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { record, key } = await seedApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, "monitors:read", { Authorization: `Bearer ${key}` });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ apiKeyId: record.id, apiTeamId: team.id });
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		await seedApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, "monitors:read");

		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage/unknown key", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		await seedApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, "monitors:read", {
			Authorization: "Bearer uptime_does-not-exist",
		});

		expect(response.status).toBe(401);
	});

	test("returns 401 for an expired key", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { key } = await seedApiKey(db, team.id, ["monitors:read"], Date.now() - 1000);

		let response = await dispatch(db, "monitors:read", { Authorization: `Bearer ${key}` });

		expect(response.status).toBe(401);
	});

	test("returns 403 when a valid key is missing the required scope", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { key } = await seedApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, "monitors:write", { Authorization: `Bearer ${key}` });

		expect(response.status).toBe(403);
	});

	test("touches last_used_at on a successful call", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);
		let { record, key } = await seedApiKey(db, team.id, ["monitors:read"]);
		expect(record.last_used_at).toBeNull();

		let response = await dispatch(db, "monitors:read", { Authorization: `Bearer ${key}` });

		expect(response.status).toBe(200);
		let updated = await db.findOne(apiKeys, { where: { id: record.id } });
		expect(updated?.last_used_at).not.toBeNull();
	});
});
