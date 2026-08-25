/**
 * Tests for the Workers KV replay store.
 *
 * The store is only correct if a remembered id reads back as seen, if keys stay
 * namespaced so two senders cannot collide, and if the TTL handed to the binding
 * is one it will actually accept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { ReplayKVNamespace } from "./replay-store";

import { KVReplayStore } from "./replay-store";

/** Delivery id used across the cases. */
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";

/** A `ReplayKVNamespace` backed by a map, recording the TTL each write asked for. */
class FakeNamespace implements ReplayKVNamespace {
	entries = new Map<string, { value: string; expirationTtl?: number }>();

	async get(key: string): Promise<string | null> {
		return this.entries.get(key)?.value ?? null;
	}

	async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
		this.entries.set(key, { value, expirationTtl: options?.expirationTtl });
	}
}

describe("KVReplayStore", () => {
	test("reports an unknown id as unseen", async () => {
		let store = new KVReplayStore(new FakeNamespace());

		expect(await store.seen(ID)).toBe(false);
	});

	test("reports a remembered id as seen", async () => {
		let store = new KVReplayStore(new FakeNamespace());

		await store.remember(ID, "10 minutes");

		expect(await store.seen(ID)).toBe(true);
	});

	test("namespaces keys with the default prefix", async () => {
		let kv = new FakeNamespace();
		let store = new KVReplayStore(kv);

		await store.remember(ID, "10 minutes");

		expect([...kv.entries.keys()]).toEqual([`webhook-replay:${ID}`]);
	});

	test("keeps two senders apart when they share a namespace", async () => {
		let kv = new FakeNamespace();
		let billing = new KVReplayStore(kv, { prefix: "billing:" });
		let alerts = new KVReplayStore(kv, { prefix: "alerts:" });

		await billing.remember(ID, "10 minutes");

		expect(await billing.seen(ID)).toBe(true);
		expect(await alerts.seen(ID)).toBe(false);
	});

	test("converts the ttl to whole seconds for the binding", async () => {
		let kv = new FakeNamespace();

		await new KVReplayStore(kv).remember(ID, "10 minutes");

		expect(kv.entries.get(`webhook-replay:${ID}`)?.expirationTtl).toBe(600);
	});

	test("raises a ttl below the binding's minimum", async () => {
		let kv = new FakeNamespace();

		await new KVReplayStore(kv).remember(ID, "5s");

		expect(kv.entries.get(`webhook-replay:${ID}`)?.expirationTtl).toBe(60);
	});

	test("falls back to the minimum when the ttl type is bypassed", async () => {
		let kv = new FakeNamespace();

		// @ts-expect-error - only reachable through a cast, and a write still has to be valid
		await new KVReplayStore(kv).remember(ID, "not a duration");

		expect(kv.entries.get(`webhook-replay:${ID}`)?.expirationTtl).toBe(60);
	});

	test("treats an expired key as unseen", async () => {
		let kv = new FakeNamespace();
		let store = new KVReplayStore(kv);

		await store.remember(ID, "10 minutes");
		kv.entries.delete(`webhook-replay:${ID}`);

		expect(await store.seen(ID)).toBe(false);
	});
});
