/**
 * Tests the `/api/v1/api-keys` collection endpoints: `GET` lists only the calling
 * team's keys (metadata only, never the hash), and `POST` creates one, returning
 * the plaintext key exactly once and enforcing the per-team key limit. Every
 * action is guarded by `requireApiKey`, so each test authenticates with a real
 * bearer key minted through `ApiKey.create` rather than a fake middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@sdxc/service-container";
import { TypeID } from "@sdxc/typeid";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey, { MAX_API_KEYS_PER_TEAM } from "~/app/data/api-key";
import apiKeysController, { apiKeysRoutes } from "~/app/http/controllers/api/api-keys";
import { createTestDatabase } from "~/app/lib/test/db";
import { apiKeys, teams } from "~/database/schema";

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
	let { key } = await ApiKey.create(db, teamId, { name: "auth key", scopes, expires_at: null });
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(apiKeysRoutes, apiKeysController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function get(key: string | null) {
	return new Request(`https://uptime.test${apiKeysRoutes.apiKeysIndex.href()}`, {
		method: "GET",
		headers: key ? { Authorization: `Bearer ${key}` } : {},
	});
}

function post(key: string | null, body: unknown) {
	return new Request(`https://uptime.test${apiKeysRoutes.apiKeysCreate.href()}`, {
		method: "POST",
		headers: {
			...(key ? { Authorization: `Bearer ${key}` } : {}),
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

describe("GET /api/v1/api-keys", () => {
	test("lists only the calling team's keys, without the key hash", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:read"]);
		await ApiKey.create(db, otherTeam.id, {
			name: "not mine",
			scopes: ["monitors:read"],
			expires_at: null,
		});

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as {
			data: { apiKeys: Array<{ name: string; keyHash?: string }> };
		};
		expect(body.data.apiKeys).toHaveLength(1);
		expect(body.data.apiKeys[0]?.name).toBe("auth key");
		expect(body.data.apiKeys[0]?.keyHash).toBeUndefined();
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, get(null));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the api-keys:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/api-keys", () => {
	test("creates an API key and returns the plaintext key once", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:write", "monitors:read"]);

		let response = await dispatch(db, post(key, { name: "CI key", scopes: ["monitors:read"] }));
		expect(response.status).toBe(201);

		let body = (await response.json()) as {
			data: { apiKey: { id: string; name: string }; key: string };
		};
		expect(body.data.apiKey.name).toBe("CI key");
		expect(body.data.key).toMatch(/^uptime_[0-9a-f]{64}$/);

		let created = await db.findOne(apiKeys, {
			where: { id: TypeID.fromString(body.data.apiKey.id, "key").toUUID() },
		});
		expect(created?.scopes).toEqual(["monitors:read"]);
	});

	test("refuses to grant a scope the calling key does not hold", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:write"]);

		let response = await dispatch(db, post(key, { name: "escalated", scopes: ["monitors:write"] }));
		expect(response.status).toBe(403);

		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("FORBIDDEN");
		expect(body.error.message).toContain("monitors:write");

		expect(await ApiKey.countByTeam(db, team.id)).toBe(1);
	});

	test("names every ungranted scope, not just the first", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:write", "monitors:read"]);

		let response = await dispatch(
			db,
			post(key, { name: "escalated", scopes: ["monitors:read", "ping:trigger", "teams:write"] }),
		);
		expect(response.status).toBe(403);

		let body = (await response.json()) as { error: { message: string } };
		expect(body.error.message).toContain("ping:trigger");
		expect(body.error.message).toContain("teams:write");
		expect(body.error.message).not.toContain("monitors:read");
	});

	test("allows a key to mint a narrower copy of itself", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:write", "monitors:read", "alerts:read"]);

		let response = await dispatch(db, post(key, { name: "narrower", scopes: ["monitors:read"] }));
		expect(response.status).toBe(201);
	});

	test("returns 400 when the payload fails validation (no scopes)", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:write"]);

		let response = await dispatch(db, post(key, { name: "Bad key", scopes: [] }));
		expect(response.status).toBe(400);

		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(await db.count(apiKeys, { where: { team_id: team.id, name: "Bad key" } })).toBe(0);
	});

	test("returns 400 once the team is at the per-team API key limit", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:write"]);

		for (let i = 0; i < MAX_API_KEYS_PER_TEAM - 1; i++) {
			await ApiKey.create(db, team.id, {
				name: `Key ${i}`,
				scopes: ["monitors:read"],
				expires_at: null,
			});
		}

		let response = await dispatch(
			db,
			post(key, { name: "One too many", scopes: ["monitors:read"] }),
		);
		expect(response.status).toBe(400);

		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("LIMIT_EXCEEDED");
		expect(await db.count(apiKeys, { where: { team_id: team.id } })).toBe(MAX_API_KEYS_PER_TEAM);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, post(null, { name: "X", scopes: ["monitors:read"] }));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the api-keys:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["api-keys:read"]);

		let response = await dispatch(db, post(key, { name: "X", scopes: ["monitors:read"] }));
		expect(response.status).toBe(403);
	});
});
