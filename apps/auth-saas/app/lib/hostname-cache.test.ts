/**
 * Behavioural tests for the hostname → tenant KV cache helpers: the key format, the
 * short TTL that lets a missed invalidation self-heal, and `invalidateHostnameCache`
 * which must delete exactly the cached key. `cloudflare:workers` is mocked with an
 * in-memory `HOSTNAMES_KV` namespace before the module under test is imported, because
 * that module captures `env` at load time, so the suite runs entirely in memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createEnv, createKVNamespace } from "@pkg/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The namespace the helpers read and evict from. One instance serves the whole file, and
 * each test empties and re-seeds it in place, because the `env` published below is the one
 * the module under test holds for good.
 */
let hostnamesKv = createKVNamespace();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ HOSTNAMES_KV: hostnamesKv }),
}));

let { HOSTNAME_CACHE_TTL, hostnameCacheKey, invalidateHostnameCache } =
	await import("./hostname-cache");

beforeEach(async () => {
	hostnamesKv.reset();

	for (let hostname of ["app.example.com", "one.example.com", "two.example.com"]) {
		await hostnamesKv.put(hostnameCacheKey(hostname), "tenant-1");
	}
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

		expect(await hostnamesKv.get("host:app.example.com")).toBeNull();
		expect((await hostnamesKv.list()).keys.map((key) => key.name)).toEqual([
			"host:one.example.com",
			"host:two.example.com",
		]);
	});

	test("evicts each hostname it is called for, and only those", async () => {
		await invalidateHostnameCache("one.example.com");
		await invalidateHostnameCache("two.example.com");

		expect((await hostnamesKv.list()).keys.map((key) => key.name)).toEqual([
			"host:app.example.com",
		]);
	});

	test("is a no-op for a hostname that was never cached", async () => {
		await invalidateHostnameCache("absent.example.com");

		expect((await hostnamesKv.list()).keys).toHaveLength(3);
	});
});
