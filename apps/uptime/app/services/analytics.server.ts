import { failure, isFailure, success, type Result } from "@pkg/result";
import { env } from "cloudflare:workers";
import { z } from "zod";

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

	// Fallback: if response is an object with array data, accept it
	if (rawJson && typeof rawJson === "object" && Array.isArray((rawJson as any).data)) {
		return success((rawJson as any).data as T[]);
	}

	return failure(new Error("Analytics query failed: invalid response shape"));
}

export async function queryAnalyticsCached<T>(
	cacheKey: string,
	ttlSeconds: number,
	sql: string,
): Promise<Result<T[], Error>> {
	let cached = await env.KV.get<T[]>(cacheKey, "json");
	if (cached) return success(cached);

	let data = await queryAnalytics<T>(sql);
	if (isFailure(data)) return data;

	await env.KV.put(cacheKey, JSON.stringify(data.data), {
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
	if (isFailure(result)) return result;

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
		timestamp: (row as any).timestamp ?? null,
		responseTimeMs: (row as any).responseTimeMs ?? null,
		responseStatus: (row as any).responseStatus ?? null,
		expectedStatus: (row as any).expectedStatus ?? null,
	});
}
