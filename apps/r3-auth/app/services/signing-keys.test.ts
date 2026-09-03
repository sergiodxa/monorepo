/**
 * Unit tests for the signing key cache: requests arriving together share one bucket
 * read, a later request reuses what the isolate already holds, and a read that fails
 * leaves nothing behind for the next one to inherit.
 *
 * Listings are counted rather than timed, since sharing a read is the whole point of
 * the cache and it is the only observable difference between one request and several.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { R2BucketMock } from "@sdxc/cloudflare-mocks";

import { createR2Bucket } from "@sdxc/cloudflare-mocks";
import { JWK } from "@sdxc/jwt";
import { beforeEach, describe, expect, test, vi } from "vitest";

let bucket: R2BucketMock;
let listCalls = 0;
let failNextList = false;

/**
 * Stands in for the binding, counting listings so a test can tell one read from
 * several, and failing on demand so the failure path is reachable.
 */
let countingBucket = {
	get: (...args: Parameters<R2BucketMock["get"]>) => bucket.get(...args),
	put: (...args: Parameters<R2BucketMock["put"]>) => bucket.put(...args),
	list: (...args: Parameters<R2BucketMock["list"]>) => {
		listCalls++;
		if (failNextList) {
			failNextList = false;
			throw new Error("R2 unreachable");
		}
		return bucket.list(...args);
	},
};

vi.doMock("cloudflare:workers", () => ({ env: { R2: countingBucket } }));

/**
 * The subject, imported below the mock so it resolves the counting bucket: the replacement
 * only reaches imports that run after it is registered.
 */
let { getSigningKey, invalidateSigningKeys } = await import("~/app/services/signing-keys");

/**
 * Writes one key into the bucket, so a read finds one already there and costs
 * a single listing, the count other tests assert on. An empty bucket instead
 * mints a key and reads again, costing two, covered separately below.
 */
async function seedKey(): Promise<void> {
	let serialized = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	let file = new File([JSON.stringify(serialized)], "jwks.json", { type: "application/json" });
	await bucket.put(`signing:key:${serialized.id}`, await file.arrayBuffer());
}

beforeEach(() => {
	bucket = createR2Bucket();
	listCalls = 0;
	failNextList = false;
	invalidateSigningKeys();
});

describe("getSigningKey", () => {
	test("reads the bucket once for requests that arrive together", async () => {
		await seedKey();
		listCalls = 0;

		let [first, second, third] = await Promise.all([
			getSigningKey(),
			getSigningKey(),
			getSigningKey(),
		]);

		expect(listCalls).toBe(1);
		expect(first).toBe(second);
		expect(second).toBe(third);
	});

	test("reuses the keys the isolate already holds", async () => {
		await seedKey();
		listCalls = 0;

		let first = await getSigningKey();
		let second = await getSigningKey();

		expect(listCalls).toBe(1);
		expect(second).toBe(first);
	});

	test("reads again after the held keys are dropped", async () => {
		await seedKey();
		listCalls = 0;

		await getSigningKey();
		invalidateSigningKeys();
		await getSigningKey();

		expect(listCalls).toBe(2);
	});

	test("holds nothing after a failed read, so the next request tries again", async () => {
		await seedKey();
		listCalls = 0;
		failNextList = true;

		await expect(getSigningKey()).rejects.toThrow("R2 unreachable");

		let keys = await getSigningKey();

		expect(keys).toHaveLength(1);
		expect(listCalls).toBe(2);
	});

	/**
	 * Minting reads again afterward so the result matches what the next isolate
	 * will see, which is the second listing; both concurrent requests share that
	 * one mint.
	 */
	test("mints one key on an empty bucket, however many requests arrive at once", async () => {
		let [first, second] = await Promise.all([getSigningKey(), getSigningKey()]);

		expect(listCalls).toBe(2);
		expect(first).toHaveLength(1);
		expect(second).toBe(first);
	});
});
