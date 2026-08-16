/**
 * Covers the SQL-backed session store's server-side expiry: a fresh session round
 * trips its data, while a session presented at/after its stored `expires_at` (or
 * with an unparseable expiry) is treated as invalid, purged, and yields an empty
 * session — so a leaked-but-stale cookie can never re-authenticate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { Database } from "remix/data-table";
import { createSession } from "remix/session";

import { createTestDatabase } from "../shared/test/db";

import { sessions } from "./schema";
import { SqlSessionStorage } from "./session-storage";

describe("SqlSessionStorage expiry", () => {
	let db: Database;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("a freshly saved session round-trips its data", async () => {
		let storage = new SqlSessionStorage(db);
		let session = createSession();
		session.set("userId", "user_1");

		let cookie = await storage.save(session);
		expect(cookie).toBeString();

		let restored = await storage.read(cookie);
		expect(restored.get("userId")).toBe("user_1");
	});

	test("an expired session is not returned and is deleted from the table", async () => {
		// A negative TTL makes the persisted `expires_at` land in the past.
		let expiredStorage = new SqlSessionStorage(db, { ttlSeconds: -60 });
		let session = createSession();
		session.set("userId", "user_2");
		let cookie = await expiredStorage.save(session);
		expect(cookie).toBeString();

		// A normal reader must reject the stale id and start a clean session.
		let reader = new SqlSessionStorage(db);
		let restored = await reader.read(cookie);
		expect(restored.get("userId")).toBeUndefined();

		// The invalid row is purged as a side effect of the failed read.
		let row = await db.findOne(sessions, { where: { id: cookie! } });
		expect(row).toBeNull();
	});

	test("a session with an unparseable expiry is treated as invalid", async () => {
		let storage = new SqlSessionStorage(db);
		let session = createSession();
		session.set("userId", "user_3");
		let cookie = await storage.save(session);

		// Corrupt the stored expiry so Date.parse yields NaN.
		await db.update(
			sessions,
			{ id: cookie! },
			{ expires_at: "not-a-date", updated_at: new Date().toISOString() },
		);

		let restored = await storage.read(cookie);
		expect(restored.get("userId")).toBeUndefined();
		expect(await db.findOne(sessions, { where: { id: cookie! } })).toBeNull();
	});

	test("reading with no cookie returns an empty session without touching the table", async () => {
		let storage = new SqlSessionStorage(db);
		let restored = await storage.read(null);
		expect(restored.get("userId")).toBeUndefined();
		expect(await db.findMany(sessions)).toHaveLength(0);
	});

	test("an unknown cookie id yields an empty session bound to that id", async () => {
		let storage = new SqlSessionStorage(db);
		let restored = await storage.read("session-that-was-never-saved");
		expect(restored.get("userId")).toBeUndefined();
	});

	test("destroying a session removes it and blanks the cookie", async () => {
		let storage = new SqlSessionStorage(db);
		let session = createSession();
		session.set("userId", "user_4");
		let cookie = await storage.save(session);

		let restored = await storage.read(cookie);
		restored.destroy();
		let result = await storage.save(restored);

		expect(result).toBe("");
		expect(await db.findOne(sessions, { where: { id: cookie! } })).toBeNull();
	});
});
