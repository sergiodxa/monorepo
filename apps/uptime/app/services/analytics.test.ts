/**
 * Unit tests for the Analytics Engine service: the raw SQL query helper and its
 * `Result` mapping, the KV-cached variant's hit/miss branching, the cache-key/TTL
 * helpers, the ping-result write path, and every derived dashboard query. The
 * Cloudflare bindings are an in-memory KV namespace and a recording Analytics Engine
 * dataset; the SQL HTTP API is intercepted with MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@sdxc/cloudflare-mocks";

import { createAnalyticsEngine, createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The dashboard cache and the ping dataset. Both live at module scope because the module
 * under test captures `env` on import.
 */
let kv = createKVNamespace();
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/**
 * The cache is spied on as well as stored to: the spies reveal a write's
 * `expirationTtl` and whether a read ever happened, facts only the call itself carries.
 */
let kvGet = vi.spyOn(kv, "get");
let kvPut = vi.spyOn(kv, "put");

vi.doMock("cloudflare:workers", () => ({
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

/** MSW server intercepting the Analytics Engine SQL API. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One query as it went on the wire, recorded by {@link interceptSql}. */
interface SqlRequest {
	url: string;
	method: string;
	body: string;
	headers: Headers;
}

/**
 * Answers the SQL endpoint with `respond` and records every query that reaches it. The
 * returned array doubles as the call log — its length is how many queries ran, which is the
 * only way a cache hit can prove it queried nothing.
 * @param respond Builds the answer for each query the endpoint receives.
 */
function interceptSql(respond: () => Response): SqlRequest[] {
	let requests: SqlRequest[] = [];

	server.use(
		http.post(SQL_URL, async ({ request }) => {
			requests.push({
				url: request.url,
				method: request.method,
				body: await request.text(),
				headers: request.headers,
			});
			return respond();
		}),
	);

	return requests;
}

beforeEach(async () => {
	/**
	 * The namespace outlives the test that seeded it, so every key goes before the next
	 * one runs — a cache entry inherited from an earlier test would turn a miss into a hit.
	 */
	let { keys } = await kv.list();
	for (let key of keys) await kv.delete(key.name);

	kvGet.mockClear();
	kvPut.mockClear();
	pingResults.reset();
});

describe("queryAnalytics", () => {
	test("POSTs the SQL text with the account id and bearer token from env", async () => {
		let queries = interceptSql(() => HttpResponse.json({ data: [] }));

		await queryAnalytics("SELECT 1");

		expect(queries).toHaveLength(1);
		let [query] = queries;
		expect(query?.url).toBe(SQL_URL);
		expect(query?.method).toBe("POST");
		expect(query?.body).toBe("SELECT 1");
		expect(query?.headers.get("Authorization")).toBe("Bearer token-1");
		expect(query?.headers.get("Content-Type")).toBe("text/plain");
	});

	test("returns the response's data array wrapped in a success Result", async () => {
		interceptSql(() => HttpResponse.json({ data: [{ monitorId: "m1" }] }));

		let result = await queryAnalytics<{ monitorId: string }>("SELECT 1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([{ monitorId: "m1" }]);
	});

	test("returns an empty array when the response body has no `data` field", async () => {
		interceptSql(() => HttpResponse.json({}));

		let result = await queryAnalytics("SELECT 1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([]);
	});

	test("returns a failure Result describing the status when the response isn't ok", async () => {
		interceptSql(
			() => new HttpResponse("nope", { status: 500, statusText: "Internal Server Error" }),
		);

		let result = await queryAnalytics("SELECT 1");
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected failure");
		expect(result.error.message).toBe("Analytics query failed: 500 Internal Server Error");
	});
});

describe("queryAnalyticsCached", () => {
	test("returns the cached value from KV without querying Analytics Engine on a cache hit", async () => {
		await kv.put("cache:key", JSON.stringify([{ cached: true }]));
		let queries = interceptSql(() => {
			throw new Error("a cache hit must not query Analytics Engine");
		});

		let result = await queryAnalyticsCached("cache:key", 60, "SELECT 1");

		expect(queries).toEqual([]);
		if (isFailure(result)) throw new Error("expected success");
		/** The read asks KV to decode the JSON, so this checks the parsed rows it returns. */
		expect(result.data).toEqual([{ cached: true }]);
		expect(kvGet).toHaveBeenCalledWith("cache:key", "json");
	});

	test("queries Analytics Engine and populates the KV cache on a cache miss", async () => {
		interceptSql(() => HttpResponse.json({ data: [{ fresh: true }] }));

		let result = await queryAnalyticsCached("cache:key", 120, "SELECT 1");

		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([{ fresh: true }]);
		expect(await kv.get("cache:key")).toBe(JSON.stringify([{ fresh: true }]));
		/** A key's TTL is only visible via the write call's own options, so this asserts those. */
		expect(kvPut).toHaveBeenCalledWith("cache:key", JSON.stringify([{ fresh: true }]), {
			expirationTtl: 120,
		});
	});

	test("does not populate the KV cache when the underlying query fails", async () => {
		interceptSql(() => new HttpResponse("nope", { status: 500 }));

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
		/**
		 * Zero already means "unknown" for HTTP responses, so a missing status here reads
		 * the same as an unreachable target's, and every query can treat it uniformly.
		 */
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
		interceptSql(() =>
			HttpResponse.json({
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
		);

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
		interceptSql(() =>
			HttpResponse.json({
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
		);

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data[0]?.health).toBe("degraded");
	});

	test("derives 'up' when every check succeeded", async () => {
		interceptSql(() =>
			HttpResponse.json({
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
		);

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data[0]?.health).toBe("up");
	});

	test("derives 'pending' when there are no checks in the 24h window at all", async () => {
		interceptSql(() =>
			HttpResponse.json({
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
		);

		let result = await getTeamHttpSummaries("team-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data[0]?.health).toBe("pending");
	});

	test("scopes the query to the given team and caches the raw rows under a versioned key", async () => {
		let queries = interceptSql(() =>
			HttpResponse.json({
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
		);

		await getTeamHttpSummaries("team-9");

		expect(queries[0]?.body).toContain("index1 = 'team-9'");
		/**
		 * The rows as the query returned them, under the versioned key, with the
		 * dashboard's floor TTL — visible only in the write call's own options.
		 */
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
		let queries = interceptSql(() => {
			throw new Error("a cached rollup must not re-query Analytics Engine");
		});

		let result = await getTeamHttpSummaries("team-1");

		expect(queries).toEqual([]);
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
		interceptSql(() =>
			HttpResponse.json({
				data: [
					{ timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
					{ timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
					{ timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
				],
			}),
		);

		let result = await getMonitorSparkline("team-1", "monitor-1");
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toEqual([
			{ timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
			{ timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
			{ timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
		]);
	});

	test("uses the given limit in the query and defaults to 20", async () => {
		let queries = interceptSql(() => HttpResponse.json({ data: [] }));

		await getMonitorSparkline("team-1", "monitor-1");
		expect(queries[0]?.body).toContain("LIMIT 20");

		await getMonitorSparkline("team-1", "monitor-1", 5);
		expect(queries[1]?.body).toContain("LIMIT 5");
	});
});

describe("getTeamHttpSparklines", () => {
	test("groups rows by monitorId and returns each group oldest-first", async () => {
		interceptSql(() =>
			HttpResponse.json({
				data: [
					{ monitorId: "m1", timestamp: "2026-07-09T00:02:00Z", responseTimeMs: 30 },
					{ monitorId: "m2", timestamp: "2026-07-09T00:01:30Z", responseTimeMs: 99 },
					{ monitorId: "m1", timestamp: "2026-07-09T00:01:00Z", responseTimeMs: 20 },
					{ monitorId: "m1", timestamp: "2026-07-09T00:00:00Z", responseTimeMs: 10 },
				],
			}),
		);

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

		interceptSql(() => HttpResponse.json({ data: rows }));

		let result = await getTeamHttpSparklines("team-1");
		if (isFailure(result)) throw new Error("expected success");
		let points = result.data.get("m1") ?? [];
		expect(points.length).toBe(30);
		/** Oldest-first: the first bucket averages the earliest (lowest) response times. */
		expect(points[0]?.responseTimeMs).toBeLessThan(points[points.length - 1]?.responseTimeMs ?? 0);
	});

	test("scopes the query to the given team, http monitors, and requested limit", async () => {
		let queries = interceptSql(() => HttpResponse.json({ data: [] }));

		await getTeamHttpSparklines("team-9", 250);

		let body = queries[0]?.body ?? "";
		expect(body).toContain("index1 = 'team-9'");
		expect(body).toContain("blob2 = 'http'");
		expect(body).toContain("LIMIT 250");
	});

	test("returns a failure Result when the underlying query fails", async () => {
		interceptSql(() => new HttpResponse("nope", { status: 503 }));

		let result = await getTeamHttpSparklines("team-1");
		expect(isFailure(result)).toBe(true);
	});
});

describe("getHttpDailyAggregate", () => {
	test("returns the raw Analytics Engine rows for the given UTC day", async () => {
		interceptSql(() =>
			HttpResponse.json({
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
		);

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
		let queries = interceptSql(() => HttpResponse.json({ data: [] }));

		await getHttpDailyAggregate("2026-07-08");

		let body = queries[0]?.body ?? "";
		expect(body).toContain("2026-07-08 00:00:00");
		expect(body).toContain("blob2 = 'http'");
	});

	test("returns a failure Result when the query fails, without a success wrapper", async () => {
		interceptSql(() => new HttpResponse("nope", { status: 503 }));

		let result = await getHttpDailyAggregate("2026-07-08");
		expect(isFailure(result)).toBe(true);
	});
});

describe("getHttpP99ResponseTime", () => {
	/** The one-row shape the weighted-quantile query returns. */
	function p99Response(p99ResponseTimeMs: number | null, totalChecks: number | null) {
		return HttpResponse.json({ data: [{ p99ResponseTimeMs, totalChecks }] });
	}

	test("weights the quantile by _sample_interval over a 24-hour window", async () => {
		let queries = interceptSql(() => p99Response(410, 1200));

		let result = await getHttpP99ResponseTime({ teamId: "team-9" });

		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBe(410);
		let body = queries[0]?.body ?? "";
		expect(body).toContain("quantileExactWeighted(0.99)(double1, _sample_interval)");
		expect(body).toContain("SUM(_sample_interval * double2) AS totalChecks");
		expect(body).toContain("timestamp >= NOW() - INTERVAL '24' HOUR");
		expect(body).toContain("blob2 = 'http'");
	});

	test("scopes a team query by index1 and caches it under the team's p99 key", async () => {
		let queries = interceptSql(() => p99Response(250, 10));

		await getHttpP99ResponseTime({ teamId: "team-9" });

		expect(queries[0]?.body).toContain("index1 = 'team-9'");
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
		let queries = interceptSql(() => {
			throw new Error("a cached p99 row must not re-query Analytics Engine");
		});

		let result = await getHttpP99ResponseTime({ teamId: "team-1" });

		expect(queries).toEqual([]);
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBe(99);
	});

	test("scopes a monitor query by blob1 and never touches the cache", async () => {
		let queries = interceptSql(() => p99Response(700, 42));

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });

		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBe(700);
		let body = queries[0]?.body ?? "";
		expect(body).toContain("blob1 = 'monitor-1'");
		expect(body).not.toContain("index1");
		expect(kvGet).not.toHaveBeenCalled();
		expect(kvPut).not.toHaveBeenCalled();
	});

	test("returns null when the window holds no checks, even though the aggregate returns a row", async () => {
		interceptSql(() => p99Response(0, 0));

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBeNull();
	});

	test("returns null when the query comes back with no rows at all", async () => {
		interceptSql(() => HttpResponse.json({ data: [] }));

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });
		if (isFailure(result)) throw new Error("expected success");
		expect(result.data).toBeNull();
	});

	test("returns a failure Result when the query fails", async () => {
		interceptSql(() => new HttpResponse("nope", { status: 503 }));

		let result = await getHttpP99ResponseTime({ monitorId: "monitor-1" });
		expect(isFailure(result)).toBe(true);
	});

	test("degrades to a failure Result instead of throwing when the KV read throws", async () => {
		/**
		 * Cached text that isn't JSON, so the decode this read asks for fails — a KV read
		 * can genuinely throw, and the dashboard needs to survive that.
		 */
		await kv.put("cache:team-1:dashboard:v1:p99", "}not json{");
		let queries = interceptSql(() => {
			throw new Error("a failed cache read must not fall through to Analytics Engine");
		});

		let result = await getHttpP99ResponseTime({ teamId: "team-1" });

		expect(isFailure(result)).toBe(true);
		expect(queries).toEqual([]);
	});
});
