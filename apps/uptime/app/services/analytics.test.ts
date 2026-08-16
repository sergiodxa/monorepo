/**
 * Unit tests for the Analytics Engine service: the raw SQL query helper and its
 * success/failure `Result` mapping, the KV-cached variant's cache-hit vs cache-miss
 * branching, the cache-key/TTL helpers, the ping-result write path, and every derived
 * dashboard query (team summaries' health-derivation rules, sparkline
 * ordering, the weighted 24-hour p99, and the daily aggregate). The Cloudflare bindings are
 * an in-memory KV namespace and a recording Analytics Engine dataset installed through
 * `mock.module("cloudflare:workers", ...)`, so a cache hit is a value the writer really
 * stored; the Analytics Engine SQL HTTP API is stubbed via a mocked global `fetch`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AnalyticsEngineMock } from "@pkg/cloudflare-mocks";

import { createAnalyticsEngine, createEnv, createKVNamespace } from "@pkg/cloudflare-mocks";
import { isFailure } from "@pkg/result";

/**
 * The dashboard cache and the ping dataset. Both live at module scope because the module
 * under test captures `env` on import.
 */
let kv = createKVNamespace();
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/**
 * The cache is spied on as well as stored to: a write's `expirationTtl` and a read that
 * never happened are the two things a stored value cannot express.
 */
let kvGet = spyOn(kv, "get");
let kvPut = spyOn(kv, "put");

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		KV: kv,
		PING_RESULTS: pingResults,
	}),
}));

let {
	buildCacheKey,
	getCacheTtl,
	getHttpDailyAggregate,
	getHttpP99ResponseTime,
	getMonitorSparkline,
	getTeamHttpSparklines,
	getTeamHttpSummaries,
	queryAnalytics,
	queryAnalyticsCached,
	writePingResult,
} = await import("~/app/services/analytics");

/** The Analytics Engine SQL API endpoint every query POSTs to. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

beforeEach(async () => {
	// The namespace outlives the test that seeded it, so every key goes before the next one
	// runs — a cache entry inherited from an earlier test would turn a miss into a hit.
	let { keys } = await kv.list();
	for (let key of keys) await kv.delete(key.name);

	kvGet.mockClear();
	kvPut.mockClear();
	pingResults.reset();
	globalThis.fetch = mock(
		async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })),
	) as unknown as typeof fetch;
});

describe("queryAnalytics", () => {
	test("POSTs the SQL text with the account id and bearer token from env", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await queryAnalytics("SELECT 1");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		let [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(SQL_URL);
		expect(init.method).toBe("POST");
		expect(init.body).toBe("SELECT 1");
		let headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer token-1");
		expect(headers["Content-Type"]).toBe("text/plain");
	});

	test("returns the response's data array wrapped in a success Result", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: [{ monitorId: "m1" }] })),
		) as unknown as typeof fetch;

		let result = await queryAnalytics<{ monitorId: string }>("SELECT 1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([{ monitorId: "m1" }]);
	});

	test("returns an empty array when the response body has no `data` field", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({})),
		) as unknown as typeof fetch;

		let result = await queryAnalytics("SELECT 1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([]);
	});

	test("returns a failure Result describing the status when the response isn't ok", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response("nope", { status: 500, statusText: "Internal Server Error" }),
		) as unknown as typeof fetch;

		let result = await queryAnalytics("SELECT 1");
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected failure");
		expect(result.error.message).toBe("Analytics query failed: 500 Internal Server Error");
	});
});

describe("queryAnalyticsCached", () => {
	test("returns the cached value from KV without querying Analytics Engine on a cache hit", async () => {
		await kv.put("cache:key", JSON.stringify([{ cached: true }]));
		let fetchMock = mock(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await queryAnalyticsCached("cache:key", 60, "SELECT 1");

		expect(fetchMock).not.toHaveBeenCalled();
		if (isFailure(result)) throw new Error("expected success");
		// Parsed rows rather than the stored text, so the read asked KV to decode the JSON.
		expect(result.data).toEqual([{ cached: true }]);
		expect(kvGet).toHaveBeenCalledWith("cache:key", "json");
	});

	test("queries Analytics Engine and populates the KV cache on a cache miss", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: [{ fresh: true }] })),
		) as unknown as typeof fetch;

		let result = await queryAnalyticsCached("cache:key", 120, "SELECT 1");

		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([{ fresh: true }]);
		expect(await kv.get("cache:key")).toBe(JSON.stringify([{ fresh: true }]));
		// A stored key does not report the TTL it was written with, so the option is asserted.
		expect(kvPut).toHaveBeenCalledWith("cache:key", JSON.stringify([{ fresh: true }]), {
			expirationTtl: 120,
		});
	});

	test("does not populate the KV cache when the underlying query fails", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response("nope", { status: 500 }),
		) as unknown as typeof fetch;

		let result = await queryAnalyticsCached("cache:key", 120, "SELECT 1");

		expect(isFailure(result)).toBe(true);
		expect(kvPut).not.toHaveBeenCalled();
		expect(await kv.get("cache:key")).toBeNull();
	});
});

describe("buildCacheKey", () => {
	test("formats a versioned, segment-scoped dashboard cache key for a team", () => {
		expect(buildCacheKey("team-1", "httpSummaries")).toBe(
			"cache:team-1:dashboard:v1:httpSummaries",
		);
	});
});

describe("getCacheTtl", () => {
	test("clamps below the minimum up to 60 seconds", () => {
		expect(getCacheTtl(10)).toBe(60);
		expect(getCacheTtl(0)).toBe(60);
	});

	test("passes through values already within [60, 600]", () => {
		expect(getCacheTtl(60)).toBe(60);
		expect(getCacheTtl(300)).toBe(300);
		expect(getCacheTtl(600)).toBe(600);
	});

	test("clamps above the maximum down to 600 seconds", () => {
		expect(getCacheTtl(3600)).toBe(600);
	});
});

describe("writePingResult", () => {
	test("writes a data point with the expected blobs/doubles/indexes shape", () => {
		writePingResult({
			monitorId: "monitor-1",
			teamId: "team-1",
			type: "http",
			status: "degraded",
			responseTimeMs: 1234,
			responseStatus: 200,
			expectedStatus: 200,
		});

		expect(pingResults.dataPoints).toEqual([
			{
				blobs: ["monitor-1", "http", "degraded"],
				doubles: [1234, 1, 200, 200],
				indexes: ["team-1"],
			},
		]);
	});

	test("puts a non-http check's type in blob2 and its own status vocabulary in blob3", () => {
		writePingResult({
			monitorId: "monitor-2",
			teamId: "team-2",
			type: "dns",
			status: "changed",
			responseTimeMs: 42,
		});

		expect(pingResults.dataPoints).toEqual([
			{
				blobs: ["monitor-2", "dns", "changed"],
				doubles: [42, 1, 0, 0],
				indexes: ["team-2"],
			},
		]);
	});

	test("defaults the HTTP-only doubles to zero for a type that has no status of its own", () => {
		writePingResult({
			monitorId: "monitor-3",
			teamId: "team-3",
			type: "cron",
			status: "up",
			responseTimeMs: 0,
		});

		let [point] = pingResults.dataPoints;
		// Zero already spells "unknown" for HTTP itself, so a missing status reads the same
		// way as an unreachable target's and no query has to special-case it.
		expect(point?.doubles).toEqual([0, 1, 0, 0]);
	});

	test("tags an ad-hoc ping, which belongs to a team but to no monitor's dashboard", () => {
		writePingResult({
			monitorId: "monitor-4",
			teamId: "team-4",
			type: "adhoc",
			status: "error",
			responseTimeMs: 7,
		});

		let [point] = pingResults.dataPoints;
		expect(point?.blobs).toEqual(["monitor-4", "adhoc", "error"]);
	});
});

describe("getTeamHttpSummaries", () => {
	test("derives 'down' when any check in the window was down, even alongside degraded/up checks", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{
								monitorId: "m1",
								totalChecks: 10,
								upChecks: 5,
								degradedChecks: 2,
								downChecks: 3,
								maxResponseTimeMs: 900,
							},
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([
			{
				monitorId: "m1",
				totalChecks: 10,
				successfulChecks: 7,
				maxResponseTimeMs: 900,
				health: "down",
			},
		]);
	});

	test("derives 'degraded' when there are no down checks but at least one degraded check", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{
								monitorId: "m1",
								totalChecks: 10,
								upChecks: 8,
								degradedChecks: 2,
								downChecks: 0,
								maxResponseTimeMs: 300,
							},
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data[0]?.health).toBe("degraded");
	});

	test("derives 'up' when every check succeeded", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{
								monitorId: "m1",
								totalChecks: 10,
								upChecks: 10,
								degradedChecks: 0,
								downChecks: 0,
								maxResponseTimeMs: 100,
							},
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data[0]?.health).toBe("up");
	});

	test("derives 'pending' when there are no checks in the 24h window at all", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{
								monitorId: "m1",
								totalChecks: 0,
								upChecks: 0,
								degradedChecks: 0,
								downChecks: 0,
								maxResponseTimeMs: 0,
							},
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data[0]?.health).toBe("pending");
	});

	test("scopes the query to the given team and caches the raw rows under a versioned key", async () => {
		let fetchMock = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{
								monitorId: "m1",
								totalChecks: 4,
								upChecks: 4,
								degradedChecks: 0,
								downChecks: 0,
								maxResponseTimeMs: 50,
							},
						],
					}),
				),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await getTeamHttpSummaries("team-9");

		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.body as string).toContain("index1 = 'team-9'");
		// The rows as the query returned them, under the versioned key, with the dashboard's
		// floor TTL — which only the write's options can say.
		expect(await kv.get<unknown[]>("cache:team-9:dashboard:v1:httpSummaries", "json")).toEqual([
			{
				monitorId: "m1",
				totalChecks: 4,
				upChecks: 4,
				degradedChecks: 0,
				downChecks: 0,
				maxResponseTimeMs: 50,
			},
		]);
		expect(kvPut).toHaveBeenCalledWith(
			"cache:team-9:dashboard:v1:httpSummaries",
			expect.any(String),
			{ expirationTtl: 60 },
		);
	});

	test("reuses a cached rollup without re-querying Analytics Engine", async () => {
		await kv.put(
			"cache:team-1:dashboard:v1:httpSummaries",
			JSON.stringify([
				{
					monitorId: "m1",
					totalChecks: 2,
					upChecks: 1,
					degradedChecks: 1,
					downChecks: 0,
					maxResponseTimeMs: 20,
				},
			]),
		);
		let fetchMock = mock(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await getTeamHttpSummaries("team-1");

		expect(fetchMock).not.toHaveBeenCalled();
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([
			{
				monitorId: "m1",
				totalChecks: 2,
				successfulChecks: 2,
				maxResponseTimeMs: 20,
				health: "degraded",
			},
		]);
	});
});

describe("getMonitorSparkline", () => {
	test("returns points oldest-first, reversing the newest-first query order", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{ timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
							{ timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
							{ timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getMonitorSparkline("team-1", "monitor-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([
			{ timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
			{ timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
			{ timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
		]);
	});

	test("uses the given limit in the query and defaults to 20", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await getMonitorSparkline("team-1", "monitor-1");
		let [, defaultInit] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(defaultInit.body as string).toContain("LIMIT 20");

		fetchMock.mockClear();
		await getMonitorSparkline("team-1", "monitor-1", 5);
		let [, customInit] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(customInit.body as string).toContain("LIMIT 5");
	});
});

describe("getTeamHttpSparklines", () => {
	test("groups rows by monitorId and returns each group oldest-first", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{ monitorId: "m1", timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
							{ monitorId: "m2", timestamp: "2026-07-09T00:01:30Z", responseTimeMs: 99 },
							{ monitorId: "m1", timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
							{ monitorId: "m1", timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSparklines("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data.get("m1")).toEqual([
			{ timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
			{ timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
			{ timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
		]);
		expect(result.data.get("m2")).toEqual([
			{ timestamp: "2026-07-09T00:01:30Z", responseTimeMs: 99 },
		]);
	});

	test("downsamples a monitor's points to at most 30 bucket-averaged entries", async () => {
		/** Generated newest-first, matching the query's ORDER BY timestamp DESC. */
		let rows = Array.from({ length: 90 }, (_, index) => ({
			monitorId: "m1",
			timestamp: new Date(index * 60_000).toISOString(),
			responseTimeMs: index,
		})).reverse();

		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: rows })),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSparklines("team-1");
		if (isFailure(result)) throw new Error("expected success");
		let points = result.data.get("m1") ?? [];
		expect(points.length).toBe(30);
		/** Oldest-first: the first bucket averages the earliest (lowest) response times. */
		expect(points[0]?.responseTimeMs).toBeLessThan(points[points.length - 1]?.responseTimeMs ?? 0);
	});

	test("scopes the query to the given team, http monitors, and requested limit", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await getTeamHttpSparklines("team-9", 250);

		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let body = init.body as string;
		expect(body).toContain("index1 = 'team-9'");
		expect(body).toContain("blob2 = 'http'");
		expect(body).toContain("LIMIT 250");
	});

	test("returns a failure Result when the underlying query fails", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response("nope", { status: 503 }),
		) as unknown as typeof fetch;

		let result = await getTeamHttpSparklines("team-1");
		expect(isFailure(result)).toBe(true);
	});
});

describe("getHttpDailyAggregate", () => {
	test("returns the raw Analytics Engine rows for the given UTC day", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
						data: [
							{
								monitorId: "m1",
								totalChecks: 100,
								successfulChecks: 98,
								avgResponseTimeMs: 120.5,
								maxResponseTimeMs: 900,
							},
						],
					}),
				),
		) as unknown as typeof fetch;

		let result = await getHttpDailyAggregate("2026-07-08");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([
			{
				monitorId: "m1",
				totalChecks: 100,
				successfulChecks: 98,
				avgResponseTimeMs: 120.5,
				maxResponseTimeMs: 900,
			},
		]);
	});

	test("scopes the query to the requested date's 24-hour UTC window", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await getHttpDailyAggregate("2026-07-08");

		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let body = init.body as string;
		expect(body).toContain("2026-07-08 00:00:00");
		expect(body).toContain("blob2 = 'http'");
	});

	test("returns a failure Result when the query fails, without a success wrapper", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response("nope", { status: 503 }),
		) as unknown as typeof fetch;

		let result = await getHttpDailyAggregate("2026-07-08");
		expect(isFailure(result)).toBe(true);
	});
});

describe("getHttpP99ResponseTime", () => {
	/** The one-row shape the weighted-quantile query returns. */
	function p99Response(p99ResponseTimeMs: number | null, totalChecks: number | null) {
		return new Response(JSON.stringify({ data: [{ p99ResponseTimeMs, totalChecks }] }));
	}

	test("weights the quantile by _sample_interval over a 24-hour window", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => p99Response(410, 1200));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ teamId: "team-9" });

		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBe(410);
		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let body = init.body as string;
		expect(body).toContain("quantileExactWeighted(0.99)(double1, _sample_interval)");
		expect(body).toContain("SUM(_sample_interval * double2) AS totalChecks");
		expect(body).toContain("timestamp >= NOW() - INTERVAL '24' HOUR");
		expect(body).toContain("blob2 = 'http'");
	});

	test("scopes a team query by index1 and caches it under the team's p99 key", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => p99Response(250, 10));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		await getHttpP99ResponseTime({ teamId: "team-9" });

		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.body as string).toContain("index1 = 'team-9'");
		expect(kvGet).toHaveBeenCalledWith("cache:team-9:dashboard:v1:p99", "json");
		expect(await kv.get<unknown[]>("cache:team-9:dashboard:v1:p99", "json")).toEqual([
			{ p99ResponseTimeMs: 250, totalChecks: 10 },
		]);
		expect(kvPut).toHaveBeenCalledWith("cache:team-9:dashboard:v1:p99", expect.any(String), {
			expirationTtl: 60,
		});
	});

	test("reuses the cached row without re-querying Analytics Engine", async () => {
		await kv.put(
			"cache:team-1:dashboard:v1:p99",
			JSON.stringify([{ p99ResponseTimeMs: 99, totalChecks: 5 }]),
		);
		let fetchMock = mock(async (..._args: unknown[]) => p99Response(1, 1));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ teamId: "team-1" });

		expect(fetchMock).not.toHaveBeenCalled();
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBe(99);
	});

	test("scopes a monitor query by blob1 and never touches the cache", async () => {
		let fetchMock = mock(async (..._args: unknown[]) => p99Response(700, 42));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });

		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBe(700);
		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let body = init.body as string;
		expect(body).toContain("blob1 = 'monitor-1'");
		expect(body).not.toContain("index1");
		expect(kvGet).not.toHaveBeenCalled();
		expect(kvPut).not.toHaveBeenCalled();
	});

	test("returns null when the window holds no checks, even though the aggregate returns a row", async () => {
		globalThis.fetch = mock(async (..._args: unknown[]) =>
			p99Response(0, 0),
		) as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBeNull();
	});

	test("returns null when the query comes back with no rows at all", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })),
		) as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBeNull();
	});

	test("returns a failure Result when the query fails", async () => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response("nope", { status: 503 }),
		) as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });
		expect(isFailure(result)).toBe(true);
	});

	test("degrades to a failure Result instead of throwing when the KV read throws", async () => {
		// Cached text that is not JSON, so the decode the read asks for is what fails. A KV
		// read really can throw, and a dashboard must not go down with it.
		await kv.put("cache:team-1:dashboard:v1:p99", "}not json{");
		let fetchMock = mock(async (..._args: unknown[]) => p99Response(1, 1));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let result = await getHttpP99ResponseTime({ teamId: "team-1" });

		expect(isFailure(result)).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
