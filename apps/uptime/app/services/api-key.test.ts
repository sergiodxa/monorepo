/**
 * Unit tests for API key generation/hashing — format and hash stability matter
 * because the format must stay byte-identical to what already generated production
 * keys, for those keys to keep verifying at cutover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { generateApiKey, hashApiKey } from "~/app/services/api-key";

describe("generateApiKey", () => {
	test("produces a key matching the uptime_<64 hex chars> format", async () => {
		let { key } = await generateApiKey();
		expect(key).toMatch(/^uptime_[0-9a-f]{64}$/);
	});

	test("derives the prefix from the key's first 15 characters", async () => {
		let { key, keyPrefix } = await generateApiKey();
		expect(keyPrefix).toBe(key.slice(0, 15));
		expect(keyPrefix.length).toBe(15);
	});

	test("hashes the key with SHA-256 and matches a standalone hash of the same key", async () => {
		let { key, keyHash } = await generateApiKey();
		expect(keyHash).toBe(await hashApiKey(key));
		expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
	});

	test("generates a different key and hash each time", async () => {
		let first = await generateApiKey();
		let second = await generateApiKey();
		expect(first.key).not.toBe(second.key);
		expect(first.keyHash).not.toBe(second.keyHash);
	});
});

describe("hashApiKey", () => {
	test("is deterministic for the same input", async () => {
		expect(await hashApiKey("uptime_abc")).toBe(await hashApiKey("uptime_abc"));
	});
});
