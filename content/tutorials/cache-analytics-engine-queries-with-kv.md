---
title: How to Cache Analytics Engine Queries with KV
excerpt: Reduce API calls and improve response times by caching Analytics Engine queries in Cloudflare KV.
tech: @cloudflare/workers-types@4.0.0
---

When building dashboards or monitoring applications on Cloudflare Workers, you'll often [query Analytics Engine](/tutorials/use-cloudflare-analytics-engine-for-time-series-data) for metrics like response times, status codes, or event counts. The problem is that Analytics Engine queries can be slow and have rate limits, making them unsuitable for high traffic pages where multiple users might request the same data.

By [caching query results in Cloudflare KV](/tutorials/build-a-cache-abstraction-for-cloudflare-kv) with a time to live (TTL), you can serve repeated requests instantly while keeping the data fresh enough for your use case. This pattern works well for dashboards where data doesn't need to be real time, such as uptime monitors, usage statistics, or aggregated metrics.

## Query Analytics Engine Directly

Start with a function that queries the Analytics Engine SQL API. This function handles the HTTP request, parses the response, and returns a typed result.

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

	return failure(new Error("Analytics query failed: invalid response shape"));
}
```

This function uses Zod to validate both error and success responses from the API. It returns a [Result type](/articles/result-objects-in-ts) that makes error handling explicit: callers must check for failure before accessing the data. The `Result` type is a discriminated union where `ok: true` means success and `ok: false` means failure.

## Add a Caching Layer with KV

Now wrap the query function with a caching layer that checks KV first and stores results with a TTL.

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
```

The function first attempts to retrieve cached data from KV using the `json` type parameter, which automatically parses the stored JSON. If a cache hit occurs, it returns immediately without querying Analytics Engine. On a cache miss, it executes the query, stores the result with the specified TTL, and returns the data. For better performance, you can [use `waitUntil` for non-blocking cache writes](/tutorials/use-waituntil-for-non-blocking-cache-writes) so the response doesn't wait for the KV write to complete.

## Build Consistent Cache Keys

Create a helper function to generate consistent cache keys across your application.

```ts {% path="app/services/analytics.server.ts" %}
export function buildCacheKey(teamId: string, segment: string): string {
	return `cache:${teamId}:dashboard:v1:${segment}`;
}
```

The key structure includes a version number (`v1`) so you can invalidate all cached data by incrementing it when your query format changes. The `teamId` ensures each team's data is cached separately.

## Calculate TTL Based on Data Freshness

For monitoring applications, the cache TTL should match how often you collect data. If you ping a service every 60 seconds, caching for longer than that wastes API calls without improving data freshness.

```ts {% path="app/services/analytics.server.ts" %}
export function getCacheTtl(minIntervalSeconds: number): number {
	const MIN_TTL = 60; // 1 minute minimum
	const MAX_TTL = 600; // 10 minutes maximum
	return Math.max(MIN_TTL, Math.min(MAX_TTL, minIntervalSeconds));
}
```

This function clamps the TTL between reasonable bounds. A minimum of 60 seconds prevents cache thrashing, while a maximum of 10 minutes ensures data stays reasonably fresh even for infrequently updated metrics.

## Use the Cached Query in a Route

Now you can use the cached query function in your route loaders.

```ts {% path="app/routes/dashboard.tsx" %}
import type { Route } from "./+types/dashboard";
import { queryAnalyticsCached, buildCacheKey, getCacheTtl } from "~/services/analytics.server";

export async function loader({ context }: Route.LoaderArgs) {
	let teamId = "team_123";
	let cacheKey = buildCacheKey(teamId, "response-times");
	let ttl = getCacheTtl(60); // Data collected every 60 seconds

	let sql = `SELECT
    blob1 AS monitorId,
    AVG(double1) AS avgResponseTime
  FROM uptime_monitor_results
  WHERE index1 = '${teamId}'
    AND timestamp > NOW() - INTERVAL '24' HOUR
  GROUP BY blob1`;

	let result = await queryAnalyticsCached<{
		monitorId: string;
		avgResponseTime: number;
	}>(cacheKey, ttl, sql);

	if (!result.ok) {
		throw new Error("Failed to load dashboard data");
	}

	return { metrics: result.data };
}
```

The loader builds a cache key specific to the team and data segment, calculates an appropriate TTL, and executes the cached query. Subsequent requests within the TTL window will receive cached data instantly.

## When to Use This Pattern

This caching pattern works best for read heavy dashboards where multiple users view the same data. The trade off is eventual consistency: users might see data that's up to TTL seconds old. For real time requirements, consider using WebSockets or server sent events instead.

The pattern also helps you stay within Analytics Engine's rate limits by reducing the number of API calls. If your dashboard receives 1000 requests per minute but your TTL is 60 seconds, you'll make at most one API call per minute instead of 1000. For a deeper look at caching strategies, see [HTTP vs Server-Side Cache](/articles/http-vs-server-side-cache-in-remix).
