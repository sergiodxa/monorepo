/**
 * Unit tests for the `ApiKey` data-access model: generation (returning the plaintext
 * key once), team-scoped listing/lookup for the UI, and the hash-based lookup
 * `requireApiKey` middleware uses to authenticate requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type {
	Database,
	DataManipulationOperation,
	DataManipulationResult,
	DatabaseDriver,
} from "remix/data-table";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey, { MAX_API_KEYS_PER_TEAM } from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { hashApiKey } from "~/app/services/api-key";
import { apiKeys } from "~/database/schema";

/**
 * Patches a test database's driver so writes to the given JSON-typed columns are
 * `JSON.stringify`-d before binding and `JSON.parse`-d back on read. The bun:sqlite
 * test adapter binds column values as-is with no column-type awareness, so passing a
 * plain array into a `c.json()` column (here, `scopes`) throws at the SQLite binding
 * layer. This codec is required to exercise `create()` against the real database
 * instead of mocking the model away.
 */
function patchJsonColumns(adapter: DatabaseDriver, columns: string[]): void {
	let originalExecute = adapter.execute.bind(adapter);

	adapter.execute = async (request) => {
		let operation = encodeJsonColumns(request.operation, columns);
		let result = await originalExecute({ ...request, operation });
		return decodeJsonColumns(result, columns);
	};
}

function encodeRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
	let output = { ...row };
	for (let column of columns) {
		if (column in output && output[column] !== null && typeof output[column] !== "string") {
			output[column] = JSON.stringify(output[column]);
		}
	}
	return output;
}

function encodeJsonColumns(
	operation: DataManipulationOperation,
	columns: string[],
): DataManipulationOperation {
	if (operation.kind === "insert") {
		return { ...operation, values: encodeRow(operation.values, columns) };
	}
	if (operation.kind === "update") {
		return { ...operation, changes: encodeRow(operation.changes, columns) };
	}
	return operation;
}

function decodeJsonColumns(
	result: DataManipulationResult,
	columns: string[],
): DataManipulationResult {
	if (!result.rows) return result;

	return {
		...result,
		rows: result.rows.map((row) => {
			let output = { ...row };
			for (let column of columns) {
				if (column in output && typeof output[column] === "string") {
					try {
						output[column] = JSON.parse(output[column] as string);
					} catch {
						// Not JSON — leave the raw string as-is.
					}
				}
			}
			return output;
		}),
	};
}

let db: Database;

let scopes: ApiKeyScope[] = ["monitors:read", "alerts:write"];

beforeEach(() => {
	let database = createTestDatabase();
	db = database.db;
	patchJsonColumns(database.adapter, ["scopes"]);
});

describe("ApiKey.create", () => {
	test("generates and stores a new key, returning the plaintext key once", async () => {
		let { record, key } = await ApiKey.create(db, "team-1", {
			name: "CI key",
			scopes,
			expires_at: null,
		});

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
		let { record } = await ApiKey.create(db, "team-1", {
			name: "Expiring key",
			scopes,
			expires_at: expiresAt,
		});

		expect(record.expires_at).toBe(expiresAt);
	});
});

describe("ApiKey.listByTeam", () => {
	test("lists only the team's keys, newest first", async () => {
		let { record: first } = await ApiKey.create(db, "team-1", {
			name: "First",
			scopes,
			expires_at: null,
		});
		let { record: second } = await ApiKey.create(db, "team-1", {
			name: "Second",
			scopes,
			expires_at: null,
		});
		await ApiKey.create(db, "team-2", { name: "Other team", scopes, expires_at: null });

		await db.update(apiKeys, first.id, { created_at: Date.now() - 60_000 }, { touch: false });

		let keys = await ApiKey.listByTeam(db, "team-1");
		expect(keys.map((key) => key.id)).toEqual([second.id, first.id]);
	});

	test("returns an empty array for a team with no keys", async () => {
		expect(await ApiKey.listByTeam(db, "team-1")).toEqual([]);
	});
});

describe("ApiKey.findByIdForTeam", () => {
	test("finds a key scoped to its team", async () => {
		let { record } = await ApiKey.create(db, "team-1", { name: "A", scopes, expires_at: null });

		expect(await ApiKey.findByIdForTeam(db, "team-1", record.id)).toEqual(record);
	});

	test("returns null when the key belongs to a different team", async () => {
		let { record } = await ApiKey.create(db, "team-1", { name: "A", scopes, expires_at: null });

		expect(await ApiKey.findByIdForTeam(db, "team-2", record.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await ApiKey.findByIdForTeam(db, "team-1", "missing")).toBeNull();
	});
});

describe("ApiKey.findByHash", () => {
	test("finds a key by its stored hash", async () => {
		let { record, key } = await ApiKey.create(db, "team-1", {
			name: "A",
			scopes,
			expires_at: null,
		});

		let found = await ApiKey.findByHash(db, await hashApiKey(key));
		expect(found).toEqual(record);
	});

	test("returns null for a hash that doesn't match any key", async () => {
		expect(await ApiKey.findByHash(db, "not-a-real-hash")).toBeNull();
	});
});

describe("ApiKey.countByTeam", () => {
	test("counts a team's keys, scoped by team", async () => {
		await ApiKey.create(db, "team-1", { name: "A", scopes, expires_at: null });
		await ApiKey.create(db, "team-1", { name: "B", scopes, expires_at: null });
		await ApiKey.create(db, "team-2", { name: "C", scopes, expires_at: null });

		expect(await ApiKey.countByTeam(db, "team-1")).toBe(2);
		expect(await ApiKey.countByTeam(db, "team-2")).toBe(1);
		expect(MAX_API_KEYS_PER_TEAM).toBe(10);
	});
});

describe("ApiKey.touchLastUsedAt", () => {
	test("records that a key was just used", async () => {
		let { record } = await ApiKey.create(db, "team-1", { name: "A", scopes, expires_at: null });
		expect(record.last_used_at).toBeNull();

		await ApiKey.touchLastUsedAt(db, record.id);

		let found = await ApiKey.findByIdForTeam(db, "team-1", record.id);
		expect(typeof found?.last_used_at).toBe("number");
	});
});

describe("ApiKey.deleteById", () => {
	test("deletes an API key", async () => {
		let { record } = await ApiKey.create(db, "team-1", { name: "A", scopes, expires_at: null });

		await ApiKey.deleteById(db, record.id);

		expect(await ApiKey.findByIdForTeam(db, "team-1", record.id)).toBeNull();
	});
});
