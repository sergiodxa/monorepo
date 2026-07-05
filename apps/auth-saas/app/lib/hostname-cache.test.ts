/**
 * Behavioural tests for the hostname → tenant KV cache helpers: the key format, the
 * short TTL that lets a missed invalidation self-heal, and `invalidateHostnameCache`
 * which must delete exactly the cached key. The KV namespace is the recording stub
 * from `test/setup.ts`; no real Cloudflare KV is touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { kvOperations, resetKv } from "../../test/setup";

import { HOSTNAME_CACHE_TTL, hostnameCacheKey, invalidateHostnameCache } from "./hostname-cache";

beforeEach(() => {
	resetKv();
});

describe("hostnameCacheKey", () => {
	test("prefixes the hostname with host:", () => {
		expect(hostnameCacheKey("app.example.com")).toBe("host:app.example.com");
	});

	test("derives distinct keys for distinct hostnames", () => {
		expect(hostnameCacheKey("a.example.com")).not.toBe(hostnameCacheKey("b.example.com"));
	});

	test("handles an empty hostname", () => {
		expect(hostnameCacheKey("")).toBe("host:");
	});
});

describe("HOSTNAME_CACHE_TTL", () => {
	test("is a short 5-minute TTL", () => {
		expect(HOSTNAME_CACHE_TTL).toBe(300);
	});
});

describe("invalidateHostnameCache", () => {
	test("deletes exactly the cached key for the hostname", async () => {
		await invalidateHostnameCache("app.example.com");
		expect(kvOperations).toEqual([{ op: "delete", key: "host:app.example.com" }]);
	});

	test("issues one delete per invalidation call", async () => {
		await invalidateHostnameCache("one.example.com");
		await invalidateHostnameCache("two.example.com");
		expect(kvOperations).toEqual([
			{ op: "delete", key: "host:one.example.com" },
			{ op: "delete", key: "host:two.example.com" },
		]);
	});
});
