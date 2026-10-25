/**
 * Tests for the in-memory double-spend store: a challenge answers once, a nonce spends
 * once, and both are forgotten when their time to live passes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, describe, expect, test, vi } from "vitest";

import { MemoryRedemptionStore } from "./store.js";

afterEach(() => vi.useRealTimers());

describe("MemoryRedemptionStore", () => {
	test("takes a saved challenge once", async () => {
		let store = new MemoryRedemptionStore();
		await store.saveChallenge("aa", 60);

		expect(await store.takeChallenge("aa")).toBe(true);
		expect(await store.takeChallenge("aa")).toBe(false);
		expect(await store.takeChallenge("bb")).toBe(false);
	});

	test("spends a nonce once", async () => {
		let store = new MemoryRedemptionStore();

		expect(await store.spendNonce("aa", 60)).toBe(true);
		expect(await store.spendNonce("aa", 60)).toBe(false);
	});

	test("forgets entries after their time to live", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		let store = new MemoryRedemptionStore();
		await store.saveChallenge("aa", 60);
		await store.spendNonce("bb", 60);

		vi.advanceTimersByTime(60_000);

		expect(await store.takeChallenge("aa")).toBe(false);
		expect(await store.spendNonce("bb", 60)).toBe(true);
	});
});
