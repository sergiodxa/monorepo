/**
 * Behavioural tests for the hostname → tenant KV cache: the `host:v1:` key format, the
 * `{ tenantId, region, issuer }` positive shape with its 300s TTL, the `{ miss: true }`
 * negative shape with its 60s TTL, and `invalidateHostnameCache` deleting exactly the
 * cached key (positive or negative) for a hostname. `cloudflare:workers` is mocked with
 * an in-memory `HOSTNAMES_KV` namespace before the module under test is imported,
 * because that module captures `env` at load time, so the suite runs entirely in memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
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

let {
	HOSTNAME_CACHE_TTL,
	HOSTNAME_MISS_CACHE_TTL,
	hostnameCacheKey,
	invalidateHostnameCache,
	readHostnameCache,
	writeHostnameCache,
	writeHostnameCacheMiss,
} = await import("./hostname-cache");

let RESOLUTION = { tenantId: "ten_1", region: "wnam", issuer: "https://acme.auth.example.com" };

beforeEach(async () => {
	hostnamesKv.reset();

	for (let hostname of ["app.example.com", "one.example.com", "two.example.com"]) {
		await hostnamesKv.put(hostnameCacheKey(hostname), JSON.stringify(RESOLUTION));
	}
});

describe("hostnameCacheKey", () => {
	test("prefixes the hostname with host:v1:", () => {
		expect(hostnameCacheKey("app.example.com")).toBe("host:v1:app.example.com");
	});

	test("derives distinct keys for distinct hostnames", () => {
		expect(hostnameCacheKey("a.example.com")).not.toBe(hostnameCacheKey("b.example.com"));
	});

	test("handles an empty hostname", () => {
		expect(hostnameCacheKey("")).toBe("host:v1:");
	});
});

describe("HOSTNAME_CACHE_TTL", () => {
	test("is a short 5-minute TTL", () => {
		expect(HOSTNAME_CACHE_TTL).toBe(300);
	});
});

describe("HOSTNAME_MISS_CACHE_TTL", () => {
	test("is a shorter 1-minute TTL", () => {
		expect(HOSTNAME_MISS_CACHE_TTL).toBe(60);
	});
});

describe("readHostnameCache", () => {
	test("reads back the tenantId, region and issuer of a cached resolution", async () => {
		expect(await readHostnameCache("app.example.com")).toEqual(RESOLUTION);
	});

	test("answers null for a hostname with no cache entry", async () => {
		expect(await readHostnameCache("absent.example.com")).toBeNull();
	});

	test('answers "miss" for a hostname cached as matching no tenant', async () => {
		await writeHostnameCacheMiss("scanner.example.com");
		expect(await readHostnameCache("scanner.example.com")).toBe("miss");
	});
});

describe("writeHostnameCache", () => {
	test("writes a resolution with the positive TTL", async () => {
		await writeHostnameCache("new.example.com", RESOLUTION);

		expect(await readHostnameCache("new.example.com")).toEqual(RESOLUTION);

		let key = (await hostnamesKv.list()).keys.find((k) => k.name === "host:v1:new.example.com");
		expect(key?.expiration).toBeDefined();
	});
});

describe("writeHostnameCacheMiss", () => {
	test("caches the hostname as a miss", async () => {
		await writeHostnameCacheMiss("scanner.example.com");
		expect(await hostnamesKv.get("host:v1:scanner.example.com")).toBe(
			JSON.stringify({ miss: true }),
		);
	});
});

describe("invalidateHostnameCache", () => {
	test("deletes exactly the cached key for the hostname", async () => {
		await invalidateHostnameCache("app.example.com");

		expect(await hostnamesKv.get("host:v1:app.example.com")).toBeNull();
		expect((await hostnamesKv.list()).keys.map((key) => key.name)).toEqual([
			"host:v1:one.example.com",
			"host:v1:two.example.com",
		]);
	});

	test("evicts each hostname it is called for, and only those", async () => {
		await invalidateHostnameCache("one.example.com");
		await invalidateHostnameCache("two.example.com");

		expect((await hostnamesKv.list()).keys.map((key) => key.name)).toEqual([
			"host:v1:app.example.com",
		]);
	});

	test("is a no-op for a hostname that was never cached", async () => {
		await invalidateHostnameCache("absent.example.com");

		expect((await hostnamesKv.list()).keys).toHaveLength(3);
	});

	test("clears a negative-cache tombstone under the same key a positive entry would use", async () => {
		await writeHostnameCacheMiss("scanner.example.com");

		await invalidateHostnameCache("scanner.example.com");

		expect(await readHostnameCache("scanner.example.com")).toBeNull();
	});
});
