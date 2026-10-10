/**
 * Unit tests for the API keys model: generation (returning the plaintext
 * key once), team-scoped listing/lookup for the UI, and the hash-based lookup
 * `requireApiKey` middleware uses to authenticate requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";
import type { ApiKeyScope } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { MAX_API_KEYS_PER_TEAM } from "~/app/models/api-keys";
import { hashApiKey } from "~/app/services/api-key";
import { apiKeys } from "~/database/schema";

let db: Database;
let models: UptimeModels;

let scopes: ApiKeyScope[] = ["monitors:read", "alerts:write"];

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db, recordJobs().jobs);
});

describe("apiKeys.issue", () => {
	test("generates and stores a new key, returning the plaintext key once", async () => {
		let { record, key } = unwrap(
			await models.apiKeys.issue("team-1", {
				name: "CI key",
				scopes,
				expires_at: null,
			}),
		);

		expect(key).toMatch(/^uptime_[0-9a-f]{64}$/);
		expect(record.id).toBeTruthy();
		expect(record.team_id).toBe("team-1");
		expect(record.name).toBe("CI key");
		expect(record.scopes).toEqual(scopes);
		expect(record.expires_at).toBeNull();
		expect(record.last_used_at).toBeNull();
		expect(record.key_hash).toBe(await hashApiKey(key));
		expect(key.startsWith(record.key_prefix)).toBe(true);
	});

	test("stores an expiration timestamp when given one", async () => {
		let expiresAt = Date.now() + 86_400_000;
		let { record } = unwrap(
			await models.apiKeys.issue("team-1", {
				name: "Expiring key",
				scopes,
				expires_at: expiresAt,
			}),
		);

		expect(record.expires_at).toBe(expiresAt);
	});
});

describe("apiKeys.inTeam", () => {
	test("lists only the team's keys, newest first", async () => {
		let { record: first } = unwrap(
			await models.apiKeys.issue("team-1", {
				name: "First",
				scopes,
				expires_at: null,
			}),
		);
		let { record: second } = unwrap(
			await models.apiKeys.issue("team-1", {
				name: "Second",
				scopes,
				expires_at: null,
			}),
		);
		unwrap(await models.apiKeys.issue("team-2", { name: "Other team", scopes, expires_at: null }));

		await db.update(apiKeys, first.id, { created_at: Date.now() - 60_000 }, { touch: false });

		let keys = await models.apiKeys.inTeam("team-1").orderBy("created_at", "desc").all();
		expect(keys.map((key) => key.id)).toEqual([second.id, first.id]);
	});

	test("returns an empty array for a team with no keys", async () => {
		expect(await models.apiKeys.inTeam("team-1").orderBy("created_at", "desc").all()).toEqual([]);
	});
});

describe("apiKeys.inTeam, by id", () => {
	test("finds a key scoped to its team", async () => {
		let { record } = unwrap(
			await models.apiKeys.issue("team-1", { name: "A", scopes, expires_at: null }),
		);

		expect(await models.apiKeys.inTeam("team-1").where({ id: record.id }).first()).toEqual(record);
	});

	test("returns null when the key belongs to a different team", async () => {
		let { record } = unwrap(
			await models.apiKeys.issue("team-1", { name: "A", scopes, expires_at: null }),
		);

		expect(await models.apiKeys.inTeam("team-2").where({ id: record.id }).first()).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await models.apiKeys.inTeam("team-1").where({ id: "missing" }).first()).toBeNull();
	});
});

describe("apiKeys.findBy key_hash", () => {
	test("finds a key by its stored hash", async () => {
		let { record, key } = unwrap(
			await models.apiKeys.issue("team-1", {
				name: "A",
				scopes,
				expires_at: null,
			}),
		);

		let found = await models.apiKeys.findBy({ key_hash: await hashApiKey(key) });
		expect(found).toEqual(record);
	});

	test("returns null for a hash that doesn't match any key", async () => {
		expect(await models.apiKeys.findBy({ key_hash: "not-a-real-hash" })).toBeNull();
	});
});

describe("apiKeys.inTeam count", () => {
	test("counts a team's keys, scoped by team", async () => {
		unwrap(await models.apiKeys.issue("team-1", { name: "A", scopes, expires_at: null }));
		unwrap(await models.apiKeys.issue("team-1", { name: "B", scopes, expires_at: null }));
		unwrap(await models.apiKeys.issue("team-2", { name: "C", scopes, expires_at: null }));

		expect(await models.apiKeys.inTeam("team-1").count()).toBe(2);
		expect(await models.apiKeys.inTeam("team-2").count()).toBe(1);
		expect(MAX_API_KEYS_PER_TEAM).toBe(10);
	});
});

describe("apiKeys.markUsed", () => {
	test("records that a key was just used", async () => {
		let { record } = unwrap(
			await models.apiKeys.issue("team-1", { name: "A", scopes, expires_at: null }),
		);
		expect(record.last_used_at).toBeNull();

		await models.apiKeys.markUsed(record.id);

		let found = await models.apiKeys.inTeam("team-1").where({ id: record.id }).first();
		expect(typeof found?.last_used_at).toBe("number");
	});
});

describe("apiKeys.delete", () => {
	test("deletes an API key", async () => {
		let { record } = unwrap(
			await models.apiKeys.issue("team-1", { name: "A", scopes, expires_at: null }),
		);

		unwrap(await models.apiKeys.delete(record.id));

		expect(await models.apiKeys.inTeam("team-1").where({ id: record.id }).first()).toBeNull();
	});
});
