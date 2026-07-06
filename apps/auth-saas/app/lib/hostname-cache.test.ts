/**
 * Behavioural tests for the hostname → tenant KV cache helpers: the key format, the
 * short TTL that lets a missed invalidation self-heal, and `invalidateHostnameCache`
 * which must delete exactly the cached key. `cloudflare:workers` is mocked with a
 * recording `HOSTNAMES_KV` stub before the module under test is imported, so the
 * helper binds to it regardless of what other suites mock in the same process; no
 * real Cloudflare KV is touched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";

/** Records every `HOSTNAMES_KV` operation so specs can assert cache invalidation. */
let kvOperations: Array<{ op: "get" | "put" | "delete"; key: string }> = [];

let hostnamesKv = {
	async get(key: string): Promise<string | null> {
		kvOperations.push({ op: "get", key });
		return null;
	},
	async put(key: string): Promise<void> {
		kvOperations.push({ op: "put", key });
	},
	async delete(key: string): Promise<void> {
		kvOperations.push({ op: "delete", key });
	},
};

mock.module("cloudflare:workers", () => ({ env: { HOSTNAMES_KV: hostnamesKv } }));

let { HOSTNAME_CACHE_TTL, hostnameCacheKey, invalidateHostnameCache } =
	await import("./hostname-cache");

beforeEach(() => {
	kvOperations = [];
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
