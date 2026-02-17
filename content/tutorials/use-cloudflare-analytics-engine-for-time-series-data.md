---
title: How to Use Cloudflare Analytics Engine for Time-Series Data
excerpt: Store and query time-series data using Cloudflare Analytics Engine with typed queries.
tech: @cloudflare/workers-types@4.0.0 zod@3.24.0
---

Imagine you're building an uptime monitoring service that needs to track response times, status codes, and availability for thousands of endpoints. Traditional databases struggle with this kind of high-volume, append-only data. You need something designed for time-series workloads: fast writes, efficient aggregations, and automatic data retention.

Cloudflare Analytics Engine solves this problem. It's a time-series database built into Workers that can handle millions of data points with minimal latency. You write data points using a simple API and query them using SQL. The challenge is understanding its data model (blobs, doubles, and indexes) and building a clean abstraction around it.

## Write Data Points to Analytics Engine

Analytics Engine uses a specific structure for data points: `blobs` for string values, `doubles` for numeric values, and `indexes` for values you'll filter by frequently. Here's how to write a ping result:

```ts {% path="app/services/analytics.server.ts" %}
import { env } from "cloudflare:workers";

export type PingStatus = "up" | "down" | "degraded" | "timeout";
export type MonitorType = "http" | "tcp";

export function writePingResult(params: {
	monitorId: string;
	monitorType: MonitorType;
	status: PingStatus;
	responseTimeMs: number;
	teamId: string;
	responseStatus?: number;
	expectedStatus?: number;
}): void {
	env.PING_RESULTS.writeDataPoint({
		blobs: [params.monitorId, params.monitorType, params.status],
		doubles: [
			params.responseTimeMs,
			1, // count (always 1, for sampling-safe aggregations)
			params.responseStatus ?? 0,
			params.expectedStatus ?? 0,
		],
		indexes: [params.teamId],
	});
}
```

The `writeDataPoint` method is synchronous and non-blocking. It queues the data point for ingestion without waiting for confirmation, similar to how [`waitUntil` defers work](/tutorials/use-waituntil-for-non-blocking-cache-writes) to avoid blocking responses. The `indexes` array is crucial: Analytics Engine uses it for efficient filtering, so put your most common filter values there (like `teamId`).

Notice the `1` in the doubles array. Analytics Engine samples data at high volumes, so using a count of 1 per data point lets you sum them later for accurate totals even with sampling.

## Configure the Analytics Engine Binding

Before you can write data points, you need to configure the binding in your `wrangler.jsonc`:

```json {% path="wrangler.jsonc" %}
{
	"analytics_engine_datasets": [
		{
			"binding": "PING_RESULTS",
			"dataset": "uptime_monitor_results"
		}
	]
}
```

The `binding` is how you access it in code (`env.PING_RESULTS`), and the `dataset` is the table name you'll use in SQL queries.

## Query Analytics Engine with SQL

To read data back, you query the Analytics Engine SQL API. Here's a typed query function with proper error handling:

```ts {% path="app/services/analytics.server.ts" %}
import { env } from "cloudflare:workers";
import { z } from "zod";

type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

function success<T>(data: T): Result<T, never> {
	return { ok: true, data };
}

function failure<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

let AnalyticsErrorResponse = z.object({
	errors: z.array(z.object({ code: z.number(), message: z.string() })),
	success: z.boolean().optional(),
});

let AnalyticsQueryResponse = z
	.object({
		data: z.array(z.unknown()),
		meta: z.object({ rows: z.coerce.number().optional() }).passthrough(),
	})
	.passthrough();

export async function queryAnalytics<T>(sql: string): Promise<Result<T[], Error>> {
	let response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,
				"Content-Type": "text/plain",
			},
			body: sql,
		},
	);

	if (!response.ok) {
		let errorDetails = "";
		try {
			let parsedError = AnalyticsErrorResponse.safeParse(await response.json());
			if (parsedError.success && parsedError.data.errors.length > 0) {
				errorDetails = `: ${parsedError.data.errors.map((e) => e.message).join(", ")}`;
			}
		} catch {
			// ignore JSON parse errors
		}
		return failure(new Error(`Analytics query failed: ${response.statusText}${errorDetails}`));
	}

	let rawJson: unknown;
	try {
		rawJson = await response.json();
	} catch {
		return failure(new Error("Analytics query failed: invalid JSON response"));
	}

	let parsed = AnalyticsQueryResponse.safeParse(rawJson);
	if (parsed.success) {
		return success(parsed.data.data as T[]);
	}

	if (rawJson && typeof rawJson === "object" && Array.isArray((rawJson as any).data)) {
		return success((rawJson as any).data as T[]);
	}

	return failure(new Error("Analytics query failed: invalid response shape"));
}
```

The function uses Zod to validate the response shape and returns a [Result type](/articles/result-objects-in-ts) for explicit error handling. The `Result` type is a discriminated union that forces callers to check for errors before accessing data. You need two environment variables: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_ANALYTICS_TOKEN` (an API token with Analytics read permissions).

## Query the Latest Status for a Monitor

Here's how to query the most recent data point for a specific monitor:

```ts {% path="app/services/analytics.server.ts" %}
export async function getLatestStatusFromAnalytics(params: {
	teamId: string;
	monitorId: string;
	monitorType: MonitorType;
}): Promise<
	Result<
		{
			status: PingStatus | null;
			timestamp: string | null;
			responseTimeMs: number | null;
			responseStatus: number | null;
			expectedStatus: number | null;
		},
		Error
	>
> {
	let sql = `SELECT
		blob3 AS status,
		timestamp,
		double1 AS responseTimeMs,
		double3 AS responseStatus,
		double4 AS expectedStatus
	FROM uptime_monitor_results
	WHERE index1 = '${params.teamId}'
		AND blob1 = '${params.monitorId}'
		AND blob2 = '${params.monitorType}'
	ORDER BY timestamp DESC
	LIMIT 1`;

	let result = await queryAnalytics(sql);
	if (!result.ok) return result;

	let row = result.data[0] as
		| {
				status?: unknown;
				timestamp?: string;
				responseTimeMs?: number;
				responseStatus?: number;
				expectedStatus?: number;
		  }
		| undefined;

	if (!row) {
		return success({
			status: null,
			timestamp: null,
			responseTimeMs: null,
			responseStatus: null,
			expectedStatus: null,
		});
	}

	let parsedStatus = row.status;
	if (
		parsedStatus !== "up" &&
		parsedStatus !== "down" &&
		parsedStatus !== "degraded" &&
		parsedStatus !== "timeout"
	) {
		parsedStatus = null;
	}

	return success({
		status: parsedStatus as PingStatus | null,
		timestamp: row.timestamp ?? null,
		responseTimeMs: row.responseTimeMs ?? null,
		responseStatus: row.responseStatus ?? null,
		expectedStatus: row.expectedStatus ?? null,
	});
}
```

The SQL query references columns by their position: `blob1`, `blob2`, `blob3` for strings and `double1`, `double2`, etc. for numbers. The `index1` column is your first index value. Always filter by index first for best performance.

## Cache Query Results with KV

Analytics queries can be expensive for dashboards that refresh frequently. [Use KV to cache results](/tutorials/cache-analytics-engine-queries-with-kv):

```ts {% path="app/services/analytics.server.ts" %}
export async function queryAnalyticsCached<T>(
	cacheKey: string,
	ttlSeconds: number,
	sql: string,
): Promise<Result<T[], Error>> {
	let cached = await env.KV.get<T[]>(cacheKey, "json");
	if (cached) return success(cached);

	let data = await queryAnalytics<T>(sql);
	if (!data.ok) return data;

	await env.KV.put(cacheKey, JSON.stringify(data.data), {
		expirationTtl: ttlSeconds,
	});

	return data;
}

export function getCacheTtl(minIntervalSeconds: number): number {
	const MIN_TTL = 60;
	const MAX_TTL = 600;
	return Math.max(MIN_TTL, Math.min(MAX_TTL, minIntervalSeconds));
}

export function buildCacheKey(teamId: string, segment: string): string {
	return `cache:${teamId}:dashboard:v1:${segment}`;
}
```

The `getCacheTtl` function calculates an appropriate TTL based on how often the data changes. For uptime monitoring, caching for 1 to 10 minutes is reasonable since you don't need real-time precision for historical charts. You can [build a more robust cache abstraction](/tutorials/build-a-cache-abstraction-for-cloudflare-kv) for more complex caching needs.

## Final Thoughts

Analytics Engine is ideal for high-volume, write-heavy workloads where you need fast aggregations over time. The data model takes some getting used to (blobs, doubles, indexes), but once you understand it, you can build powerful analytics features with minimal infrastructure.

Keep in mind that Analytics Engine has a 90-day retention period by default and samples data at very high volumes. For exact counts, always include a count field (set to 1) that you can sum in your queries. And always filter by your index columns first to keep queries fast.
