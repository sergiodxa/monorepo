/**
 * Tests the KV redemption store against a real KV binding inside workerd: a challenge answers
 * once, a nonce spends once, lifetimes under KV's one-minute floor are accepted, and the
 * prefix keeps entries apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { KVRedemptionStore } from "./kv.js";

describe("KVRedemptionStore", () => {
	test("takes a saved challenge once", async () => {
		let store = new KVRedemptionStore(env.CACHE);
		await store.saveChallenge("aa01", 300);

		expect(await store.takeChallenge("aa01")).toBe(true);
		expect(await store.takeChallenge("aa01")).toBe(false);
	});

	test("refuses a challenge it never saved", async () => {
		let store = new KVRedemptionStore(env.CACHE);

		expect(await store.takeChallenge("bb02")).toBe(false);
	});

	test("spends a nonce once, even with a lifetime under a minute", async () => {
		let store = new KVRedemptionStore(env.CACHE);

		expect(await store.spendNonce("cc03", 5)).toBe(true);
		expect(await store.spendNonce("cc03", 5)).toBe(false);
	});

	test("writes under the default prefix", async () => {
		let store = new KVRedemptionStore(env.CACHE);
		await store.saveChallenge("dd04", 300);

		expect(await env.CACHE.get("privacy-pass:challenge:dd04")).toBe("1");
	});

	test("keeps stores with different prefixes apart", async () => {
		let first = new KVRedemptionStore(env.CACHE, { prefix: "first:" });
		let second = new KVRedemptionStore(env.CACHE, { prefix: "second:" });

		expect(await first.spendNonce("ee05", 300)).toBe(true);
		expect(await second.spendNonce("ee05", 300)).toBe(true);
		expect(await env.CACHE.get("first:nonce:ee05")).toBe("1");
	});
});
