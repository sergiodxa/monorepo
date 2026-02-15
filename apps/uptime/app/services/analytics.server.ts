import { env } from "cloudflare:workers";

interface AnalyticsQueryResult<T> {
	data: T[];
	meta: { rows: number };
}

export async function queryAnalytics<T>(sql: string): Promise<T[]> {
	let response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}`,
				"Content-Type": "text/plain",
			},
			body: sql,
		},
	);

	if (!response.ok) {
		throw new Error(`Analytics query failed: ${response.statusText}`);
	}

	let result = (await response.json()) as AnalyticsQueryResult<T>;
	return result.data;
}

export async function queryAnalyticsCached<T>(
	cacheKey: string,
	ttlSeconds: number,
	sql: string,
): Promise<T[]> {
	let cached = await env.KV.get<T[]>(cacheKey, "json");
	if (cached) return cached;

	let data = await queryAnalytics<T>(sql);
	await env.KV.put(cacheKey, JSON.stringify(data), {
		expirationTtl: ttlSeconds,
	});

	return data;
}

export function getCacheTtl(minIntervalSeconds: number): number {
	const MIN_TTL = 60; // 1 minute minimum
	const MAX_TTL = 600; // 10 minutes maximum
	return Math.max(MIN_TTL, Math.min(MAX_TTL, minIntervalSeconds));
}

export function buildCacheKey(teamId: string, segment: string): string {
	return `cache:${teamId}:dashboard:v1:${segment}`;
}

export type PingStatus = "up" | "down" | "degraded" | "timeout";
export type MonitorType = "http" | "tcp";

export function writePingResult(params: {
	monitorId: string;
	monitorType: MonitorType;
	status: PingStatus;
	responseTimeMs: number;
	teamId: string;
	responseStatus?: number; // HTTP status code, 0 for TCP
	expectedStatus?: number; // HTTP expected status, 0 for TCP
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
