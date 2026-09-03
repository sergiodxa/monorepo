/**
 * Tests the KV-backed fixed window against a Map double: the entry key that makes
 * a rollover free, the TTL that expires it, the counting up to the limit, and the
 * failures a namespace outage produces on both the read and the write path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { RateLimitKVNamespace } from "./kv";

import { KVAdapter } from "./kv";
import { RateLimitError } from "./rate-limit-error";

/** An instant aligned to a 10 second window, so a case starts at a boundary. */
const WINDOW_START = 1_700_000_000_000;

/** One recorded write, so a case can assert the TTL the adapter asked for. */
interface RecordedPut {
	key: string;
	value: string;
	/** Seconds the adapter asked KV to keep the entry. */
	expirationTtl: number | undefined;
}

/** A KV double backed by a Map, recording writes and deletes. */
function createKV() {
	let entries = new Map<string, string>();
	let puts: RecordedPut[] = [];
	let deletes: string[] = [];

	let kv: RateLimitKVNamespace = {
		async get(key) {
			return entries.get(key) ?? null;
		},
		async put(key, value, options) {
			entries.set(key, value);
			puts.push({ key, value, expirationTtl: options?.expirationTtl });
		},
		async delete(key) {
			entries.delete(key);
			deletes.push(key);
		},
	};

	return { kv, entries, puts, deletes };
}

/** A KV double whose every operation rejects, standing in for a namespace outage. */
function createFailingKV(failing: keyof RateLimitKVNamespace): RateLimitKVNamespace {
	let entries = new Map<string, string>();
	return {
		async get(key) {
			if (failing === "get") throw new Error("kv unavailable");
			return entries.get(key) ?? null;
		},
		async put(key, value) {
			if (failing === "put") throw new Error("kv unavailable");
			entries.set(key, value);
		},
		async delete(key) {
			if (failing === "delete") throw new Error("kv unavailable");
			entries.delete(key);
		},
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe("KVAdapter", () => {
	test("allows up to the limit and denies the next attempt", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv } = createKV();
		let adapter = new KVAdapter(kv, { limit: 2, window: "10 seconds" });

		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);

		let denied = unwrap(await adapter.consume("ip"));
		expect(denied.allowed).toBe(false);
		expect(denied.remaining).toBe(0);
	});

	test("keys the counter by prefix, key, and window start", async () => {
		vi.setSystemTime(new Date(WINDOW_START + 2000));
		let { kv, entries } = createKV();
		let adapter = new KVAdapter(kv, { limit: 5, window: "10 seconds", prefix: "login" });

		await adapter.consume("1.2.3.4");

		expect([...entries.keys()]).toEqual([`login:1.2.3.4:${WINDOW_START}`]);
	});

	test("defaults the prefix so unrelated limiters can share a namespace", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv, entries } = createKV();
		let adapter = new KVAdapter(kv, { limit: 5, window: "10 seconds" });

		await adapter.consume("ip");

		expect(adapter.prefix).toBe("rate-limit");
		expect([...entries.keys()]).toEqual([`rate-limit:ip:${WINDOW_START}`]);
	});

	test("starts a fresh budget in a new window, under a new entry key", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv, entries } = createKV();
		let adapter = new KVAdapter(kv, { limit: 1, window: "10 seconds", prefix: "login" });

		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("ip")).allowed).toBe(false);

		vi.setSystemTime(new Date(WINDOW_START + 10_000));
		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);
		expect([...entries.keys()]).toEqual([
			`login:ip:${WINDOW_START}`,
			`login:ip:${WINDOW_START + 10_000}`,
		]);
	});

	test("writes a TTL of the window, raised to KV's own minimum", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let short = createKV();
		let long = createKV();

		await new KVAdapter(short.kv, { limit: 5, window: "10 seconds" }).consume("ip");
		await new KVAdapter(long.kv, { limit: 5, window: "1 hour" }).consume("ip");

		expect(short.puts[0]?.expirationTtl).toBe(60);
		expect(long.puts[0]?.expirationTtl).toBe(3600);
	});

	test("does not write on a denied attempt", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv, puts } = createKV();
		let adapter = new KVAdapter(kv, { limit: 1, window: "10 seconds" });

		await adapter.consume("ip");
		await adapter.consume("ip");
		await adapter.consume("ip");

		expect(puts).toHaveLength(1);
	});

	test("spends the requested cost in one write", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv, puts } = createKV();
		let adapter = new KVAdapter(kv, { limit: 10, window: "10 seconds" });

		expect(unwrap(await adapter.consume("ip", 4)).remaining).toBe(6);
		expect(puts[0]?.value).toBe("4");
	});

	test("treats a corrupt entry as an empty counter", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv, entries } = createKV();
		entries.set(`rate-limit:ip:${WINDOW_START}`, "not a number");
		let adapter = new KVAdapter(kv, { limit: 2, window: "10 seconds" });

		expect(unwrap(await adapter.consume("ip")).remaining).toBe(1);
	});

	test("reset removes the entry for the window in progress", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let { kv, deletes } = createKV();
		let adapter = new KVAdapter(kv, { limit: 1, window: "10 seconds", prefix: "login" });

		await adapter.consume("ip");
		expect(isSuccess(await adapter.reset("ip"))).toBe(true);

		expect(deletes).toEqual([`login:ip:${WINDOW_START}`]);
		expect(unwrap(await adapter.consume("ip")).allowed).toBe(true);
	});

	test("reports a failure when the read fails", async () => {
		let adapter = new KVAdapter(createFailingKV("get"), { limit: 5, window: "10 seconds" });

		let result = await adapter.consume("ip");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(RateLimitError);
		expect(result.error.backend).toBe("kv");
		expect(result.error.message).toContain("read");
	});

	test("reports a failure when the write fails", async () => {
		let adapter = new KVAdapter(createFailingKV("put"), { limit: 5, window: "10 seconds" });

		let result = await adapter.consume("ip");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toContain("write");
	});

	test("reports a failure when the delete fails", async () => {
		let adapter = new KVAdapter(createFailingKV("delete"), { limit: 5, window: "10 seconds" });

		let result = await adapter.reset("ip");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.message).toContain("delete");
	});
});
