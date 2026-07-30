/**
 * Tests for the Durable Object state mock: storage round-trips through serialization,
 * transactions roll back for real, `storage.sql` executes SQL, and
 * `blockConcurrencyWhile` actually serializes overlapping callers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "bun:test";

import type { DurableObjectStateMock } from "./durable-object-state";

import { createDurableObjectState } from "./durable-object-state";

describe("createDurableObjectState", () => {
	let state: DurableObjectStateMock;

	beforeEach(() => {
		state = createDurableObjectState();
	});

	test("round-trips a stored value", async () => {
		await state.storage.put("count", 3);

		expect(await state.storage.get<number>("count")).toBe(3);
	});

	test("returns undefined for a key that was never written", async () => {
		expect(await state.storage.get("missing")).toBeUndefined();
	});

	test("writes many keys at once", async () => {
		await state.storage.put({ a: 1, b: 2 });

		let found = await state.storage.get<number>(["a", "b", "missing"]);

		expect([...found.entries()]).toEqual([
			["a", 1],
			["b", 2],
		]);
	});

	test("detaches stored values from the caller's object", async () => {
		let value = { nested: { count: 1 } };
		await state.storage.put("value", value);
		value.nested.count = 99;

		let stored = await state.storage.get<{ nested: { count: number } }>("value");

		expect(stored?.nested.count).toBe(1);
	});

	test("lists keys in order, filtered by prefix and bounds", async () => {
		await state.storage.put({ "a:1": 1, "a:2": 2, "b:1": 3 });

		let prefixed = await state.storage.list({ prefix: "a:" });
		expect([...prefixed.keys()]).toEqual(["a:1", "a:2"]);

		let bounded = await state.storage.list({ start: "a:2" });
		expect([...bounded.keys()]).toEqual(["a:2", "b:1"]);

		let after = await state.storage.list({ startAfter: "a:1", end: "b:1" });
		expect([...after.keys()]).toEqual(["a:2"]);
	});

	test("lists in reverse and honours a limit", async () => {
		await state.storage.put({ a: 1, b: 2, c: 3 });

		let reversed = await state.storage.list({ reverse: true, limit: 2 });

		expect([...reversed.keys()]).toEqual(["c", "b"]);
	});

	test("deletes one key and many keys", async () => {
		await state.storage.put({ a: 1, b: 2, c: 3 });

		expect(await state.storage.delete("a")).toBe(true);
		expect(await state.storage.delete("a")).toBe(false);
		expect(await state.storage.delete(["b", "missing"])).toBe(1);
	});

	test("clears every key with deleteAll", async () => {
		await state.storage.put({ a: 1, b: 2 });

		await state.storage.deleteAll();

		expect((await state.storage.list()).size).toBe(0);
	});

	test("commits a transaction that returns normally", async () => {
		await state.storage.transaction(async (txn) => {
			await txn.put("a", 1);
			await txn.put("b", 2);
		});

		expect((await state.storage.list()).size).toBe(2);
	});

	test("discards a transaction's writes when it throws", async () => {
		let boom = new Error("failed");

		let promise = state.storage.transaction(async (txn) => {
			await txn.put("a", 1);
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);
		expect(await state.storage.get("a")).toBeUndefined();
	});

	test("discards a transaction's writes when it rolls back", async () => {
		await state.storage.transaction(async (txn) => {
			await txn.put("a", 1);
			txn.rollback();
		});

		expect(await state.storage.get("a")).toBeUndefined();
	});

	test("reads a transaction's own writes inside the transaction", async () => {
		let seen = await state.storage.transaction(async (txn) => {
			await txn.put("a", 1);
			return txn.get<number>("a");
		});

		expect(seen).toBe(1);
	});

	test("executes SQL through storage.sql", () => {
		state.storage.sql.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");
		state.storage.sql.exec("INSERT INTO counters (name, value) VALUES (?, ?)", "hits", 1);

		let row = state.storage.sql.exec("SELECT value FROM counters WHERE name = ?", "hits").one();

		expect(row.value).toBe(1);
	});

	test("rolls back both SQL and storage in transactionSync", () => {
		state.storage.sql.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");

		expect(() =>
			state.storage.transactionSync(() => {
				state.storage.sql.exec("INSERT INTO counters (name, value) VALUES ('hits', 1)");
				state.storage.kv.put("a", 1);
				throw new Error("failed");
			}),
		).toThrow(/failed/);

		expect(state.storage.sql.exec("SELECT COUNT(*) AS total FROM counters").one().total).toBe(0);
		expect(state.storage.kv.get("a")).toBeUndefined();
	});

	test("commits transactionSync when the closure returns", () => {
		state.storage.sql.exec("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER)");

		let result = state.storage.transactionSync(() => {
			state.storage.sql.exec("INSERT INTO counters (name, value) VALUES ('hits', 1)");
			return "ok";
		});

		expect(result).toBe("ok");
		expect(state.storage.sql.exec("SELECT COUNT(*) AS total FROM counters").one().total).toBe(1);
	});

	test("shares one store between the async and sync key-value APIs", async () => {
		state.storage.kv.put("a", 1);

		expect(await state.storage.get<number>("a")).toBe(1);
		expect(state.storage.kv.get<number>("a")).toBe(1);
		expect(state.storage.kv.delete("a")).toBe(true);
		expect(await state.storage.get("a")).toBeUndefined();
	});

	test("lists synchronously through storage.kv", () => {
		state.storage.kv.put("a:1", 1);
		state.storage.kv.put("b:1", 2);

		expect([...state.storage.kv.list({ prefix: "a:" })]).toEqual([["a:1", 1]]);
	});

	test("stores and clears an alarm", async () => {
		expect(await state.storage.getAlarm()).toBeNull();

		await state.storage.setAlarm(new Date(1_000));
		expect(await state.storage.getAlarm()).toBe(1_000);

		await state.storage.deleteAlarm();
		expect(await state.storage.getAlarm()).toBeNull();
	});

	test("restores the alarm when a transaction rolls back", async () => {
		await state.storage.setAlarm(1_000);

		await state.storage.transaction(async (txn) => {
			await txn.setAlarm(2_000);
			txn.rollback();
		});

		expect(await state.storage.getAlarm()).toBe(1_000);
	});

	test("serializes overlapping blockConcurrencyWhile callers", async () => {
		let order: string[] = [];

		let first = state.blockConcurrencyWhile(async () => {
			order.push("first:start");
			await Promise.resolve();
			order.push("first:end");
		});

		let second = state.blockConcurrencyWhile(async () => {
			order.push("second:start");
			order.push("second:end");
		});

		await Promise.all([first, second]);

		expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
	});

	test("keeps serializing after a blocked callback fails", async () => {
		let failing = state.blockConcurrencyWhile(async () => {
			throw new Error("failed");
		});
		await expect(failing).rejects.toThrow(/failed/);

		let value = await state.blockConcurrencyWhile(async () => "ok");

		expect(value).toBe("ok");
	});

	test("returns the blocked callback's value", async () => {
		expect(await state.blockConcurrencyWhile(async () => 42)).toBe(42);
	});

	test("records deferred work and awaits it", async () => {
		let written: string[] = [];
		state.waitUntil(Promise.resolve().then(() => void written.push("done")));

		expect(state.waitUntilPromises).toHaveLength(1);
		await state.settled();

		expect(written).toEqual(["done"]);
	});

	test("records an abort reason", () => {
		expect(state.abortReason).toBeUndefined();

		state.abort("test over");

		expect(state.abortReason).toBe("test over");
	});

	test("reports the id it was created with", () => {
		let named = createDurableObjectState({ name: "tenant-1", id: "a".repeat(64) });

		expect(named.id.name).toBe("tenant-1");
		expect(named.id.toString()).toBe("a".repeat(64));
		expect(named.id.equals(named.id)).toBe(true);
	});

	test("exposes the props it was given", () => {
		let withProps = createDurableObjectState<{ tenant: string }>({ props: { tenant: "acme" } });

		expect(withProps.props).toEqual({ tenant: "acme" });
	});

	test("tracks accepted WebSockets and their tags", () => {
		let socket = { close() {} } as unknown as WebSocket;
		let other = { close() {} } as unknown as WebSocket;

		state.acceptWebSocket(socket, ["room-1"]);
		state.acceptWebSocket(other, ["room-2"]);

		expect(state.getWebSockets()).toHaveLength(2);
		expect(state.getWebSockets("room-1")).toEqual([socket]);
		expect(state.getTags(socket)).toEqual(["room-1"]);
		expect(state.getWebSocketAutoResponseTimestamp(socket)).toBeNull();
	});

	test("stores the hibernation auto-response and timeout", () => {
		expect(state.getWebSocketAutoResponse()).toBeNull();
		expect(state.getHibernatableWebSocketEventTimeout()).toBeNull();

		state.setHibernatableWebSocketEventTimeout(5_000);

		expect(state.getHibernatableWebSocketEventTimeout()).toBe(5_000);
	});

	test("returns bookmarks for the session APIs", async () => {
		expect(await state.storage.getCurrentBookmark()).toBeString();
		expect(await state.storage.getBookmarkForTime(1_000)).toContain("1000");
		expect(await state.storage.onNextSessionRestoreBookmark("mark")).toBe("mark");
		await state.storage.sync();
	});

	test("fails loudly when unimplemented platform surfaces are read", () => {
		expect(() => state.exports).toThrow(/not implemented/);
		expect(() => state.facets).toThrow(/not implemented/);
	});

	test("gives every state its own isolated storage", async () => {
		let other = createDurableObjectState();
		await state.storage.put("a", 1);

		expect(await other.storage.get("a")).toBeUndefined();
	});
});
