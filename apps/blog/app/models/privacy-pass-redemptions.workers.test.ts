/**
 * Tests the Privacy Pass redemption store against a real KV binding: a challenge answers
 * once, a nonce spends once, and lifetimes under KV's one-minute floor are still accepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { KVRedemptionStore } from "~/app/models/privacy-pass-redemptions";

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
});
