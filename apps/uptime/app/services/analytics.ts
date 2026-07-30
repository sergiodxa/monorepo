/**
 * Analytics Engine service for HTTP ping results. Writes ping data points to the
 * `PING_RESULTS` binding and reads them back through Cloudflare's Analytics Engine SQL
 * HTTP API (the binding itself only supports writes), with a KV-cached variant so the
 * dashboard doesn't re-query on every load. Every query is a single-table SELECT with
 * GROUP BY/ORDER BY/LIMIT only — Analytics Engine's SQL API does not support joins or
 * subqueries, so a monitor's current status is derived from its 24h success ratio
 * (100% = up, 0% = down, otherwise degraded) rather than a joined "latest row" lookup.
 * See `docs/adr/uptime/ADR-001-analytics-engine-migration.md` for the dataset schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";
import { env } from "cloudflare:workers";

/** Minimum KV cache TTL, in seconds. */
const MIN_CACHE_TTL_SECONDS = 60;
/** Maximum KV cache TTL, in seconds. */
const MAX_CACHE_TTL_SECONDS = 600;

/** A ping's outcome, matching the `blob3` dimension in the Analytics Engine dataset. */
export type PingStatus = "up" | "down" | "degraded" | "timeout";

/** A monitor's derived 24h status, shown as its dashboard/list badge. */
export type MonitorHealth = "up" | "degraded" | "down" | "pending";

/** Per-monitor 24h rollup (see {@link getTeamHttpSummaries}). */
export interface HttpMonitorSummary {
	monitorId: string;
	totalChecks: number;
	successfulChecks: number;
	maxResponseTimeMs: number;
	health: MonitorHealth;
}

/** A monitor's single most recent check (see {@link getLatestHttpResult}). */
export interface LatestHttpResult {
	status: PingStatus;
	responseTimeMs: number;
	responseStatus: number;
	timestamp: string;
}

/** A monitor's status as derived from its single most recent HTTP result (see {@link calculateMonitorStatus}). */
export type MonitorStatus = "up" | "degraded" | "down" | "unknown";

/**
 * Derives a monitor's status from its latest result: `unknown` with no result yet (or
 * a null response status), `down` when the response status doesn't match what's
 * expected, `degraded` once the response time reaches the configured threshold, `up`
 * otherwise.
 */
export function calculateMonitorStatus(
	latestResult: LatestHttpResult | null,
	expectedStatus: number,
	degradedAfterMs: number,
): MonitorStatus {
	if (!latestResult || latestResult.responseStatus == null) return "unknown";
	if (latestResult.responseStatus !== expectedStatus) return "down";
	if (latestResult.responseTimeMs >= degradedAfterMs) return "degraded";
	return "up";
}

/** One point in a monitor's recent latency sparkline (see {@link getMonitorSparkline}). */
export interface SparklinePoint {
	timestamp: string;
	responseTimeMs: number;
}

/**
 * Runs a raw SQL query against the Analytics Engine HTTP API.
 *
 * Wrapped in a try/catch: this call can throw (network hiccup, DNS blip, an
 * unexpectedly non-JSON body) rather than merely returning a non-ok response, and
 * every caller here composes several of these behind a `Promise.all` — one
 * transient failure must degrade to `failure(...)` for that one query, not crash
 * the whole page with an uncaught exception.
 *
 * @param sql SQL query text (the account's Analytics Engine SQL dialect).
 */
export async function queryAnalytics<T>(sql: string): Promise<Result<T[], Error>> {
	try {
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
			return failure(
				new Error(`Analytics query failed: ${response.status} ${response.statusText}`),
			);
		}

		let body = (await response.json()) as { data?: T[] };
		return success(body.data ?? []);
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}
}

/** {@link queryAnalytics}, cached in KV under `cacheKey` for `ttlSeconds`. */
export async function queryAnalyticsCached<T>(
	cacheKey: string,
	ttlSeconds: number,
	sql: string,
): Promise<Result<T[], Error>> {
	let cached = await env.KV.get<T[]>(cacheKey, "json");
	if (cached) return success(cached);

	let result = await queryAnalytics<T>(sql);
	if (!isFailure(result)) {
		await env.KV.put(cacheKey, JSON.stringify(result.data), { expirationTtl: ttlSeconds });
	}
	return result;
}

/** Builds the dashboard KV cache key for a team and data segment. */
export function buildCacheKey(teamId: string, segment: string): string {
	return `cache:${teamId}:dashboard:v1:${segment}`;
}

/** Clamps a team's minimum monitor interval into a sane KV cache TTL. */
export function getCacheTtl(minIntervalSeconds: number): number {
	return Math.max(MIN_CACHE_TTL_SECONDS, Math.min(MAX_CACHE_TTL_SECONDS, minIntervalSeconds));
}

/** Writes one HTTP ping result as an Analytics Engine data point. */
export function writeHttpPingResult(params: {
	monitorId: string;
	teamId: string;
	status: PingStatus;
	responseTimeMs: number;
	responseStatus: number;
	expectedStatus: number;
}): void {
	env.PING_RESULTS.writeDataPoint({
		blobs: [params.monitorId, "http", params.status],
		doubles: [params.responseTimeMs, 1, params.responseStatus, params.expectedStatus],
		indexes: [params.teamId],
	});
}

/** Derives a monitor's health badge: worst-case wins (any down > any degraded > up). */
function deriveHealth(
	totalChecks: number,
	downChecks: number,
	degradedChecks: number,
): MonitorHealth {
	if (totalChecks === 0) return "pending";
	if (downChecks > 0) return "down";
	if (degradedChecks > 0) return "degraded";
	return "up";
}

/**
 * Summarizes every HTTP monitor's last 24 hours for a team in one query: total checks
 * plus a per-status breakdown, from which a health badge and an uptime percentage
 * (up + degraded, since both mean the endpoint was reachable and correct) are derived.
 * Cached in KV.
 */
export async function getTeamHttpSummaries(
	teamId: string,
): Promise<Result<HttpMonitorSummary[], Error>> {
	/**
	 * Analytics Engine's SQL API rejects `COUNT(*)` ("COUNT() function must have 0
	 * arguments"), so totals are summed from `double2` (always 1 per row, see
	 * writeHttpPingResult) instead — matching how the same dataset is queried elsewhere.
	 */
	let sql = `
		SELECT
			blob1 AS monitorId,
			SUM(double2) AS totalChecks,
			SUMIf(double2, blob3 = 'up') AS upChecks,
			SUMIf(double2, blob3 = 'degraded') AS degradedChecks,
			SUMIf(double2, blob3 = 'down') AS downChecks,
			MAX(double1) AS maxResponseTimeMs
		FROM uptime_monitor_results
		WHERE index1 = '${teamId}' AND blob2 = 'http' AND timestamp >= NOW() - INTERVAL '24' HOUR
		GROUP BY blob1
	`;

	let result = await queryAnalyticsCached<{
		monitorId: string;
		totalChecks: number;
		upChecks: number;
		degradedChecks: number;
		downChecks: number;
		maxResponseTimeMs: number;
	}>(buildCacheKey(teamId, "httpSummaries"), getCacheTtl(60), sql);
	if (isFailure(result)) return result;

	return success(
		result.data.map((row) => ({
			monitorId: row.monitorId,
			totalChecks: row.totalChecks,
			successfulChecks: row.upChecks + row.degradedChecks,
			maxResponseTimeMs: row.maxResponseTimeMs,
			health: deriveHealth(row.totalChecks, row.downChecks, row.degradedChecks),
		})),
	);
}

/** A monitor's single most recent HTTP check, or `null` when it has none in range. */
export async function getLatestHttpResult(
	teamId: string,
	monitorId: string,
): Promise<Result<LatestHttpResult | null, Error>> {
	let sql = `
		SELECT blob3 AS status, double1 AS responseTimeMs, double3 AS responseStatus, timestamp
		FROM uptime_monitor_results
		WHERE index1 = '${teamId}' AND blob1 = '${monitorId}' AND blob2 = 'http'
		ORDER BY timestamp DESC
		LIMIT 1
	`;

	let result = await queryAnalytics<LatestHttpResult>(sql);
	if (isFailure(result)) return result;
	return success(result.data[0] ?? null);
}

/** One monitor's slowest response time over the last 24 hours, in milliseconds, or `null` when it has no checks in range. */
export async function getSlowestResultForMonitor(
	teamId: string,
	monitorId: string,
): Promise<Result<number | null, Error>> {
	let sql = `
		SELECT MAX(double1) AS maxResponseTimeMs
		FROM uptime_monitor_results
		WHERE index1 = '${teamId}' AND blob1 = '${monitorId}' AND blob2 = 'http' AND timestamp >= NOW() - INTERVAL '24' HOUR
	`;

	let result = await queryAnalytics<{ maxResponseTimeMs: number | null }>(sql);
	if (isFailure(result)) return result;
	return success(result.data[0]?.maxResponseTimeMs ?? null);
}

/** The last `limit` HTTP ping response times for one monitor, oldest first. */
export async function getMonitorSparkline(
	teamId: string,
	monitorId: string,
	limit = 20,
): Promise<Result<SparklinePoint[], Error>> {
	let sql = `
		SELECT timestamp, double1 AS responseTimeMs
		FROM uptime_monitor_results
		WHERE index1 = '${teamId}' AND blob1 = '${monitorId}' AND blob2 = 'http'
		ORDER BY timestamp DESC
		LIMIT ${limit}
	`;

	let result = await queryAnalytics<SparklinePoint>(sql);
	if (isFailure(result)) return result;
	return success([...result.data].reverse());
}

/** Maximum points kept per monitor after downsampling in {@link getTeamHttpSparklines}. */
const SPARKLINE_MAX_POINTS = 30;

/**
 * Buckets `points` (already oldest-first) down to at most `maxPoints` entries by
 * averaging each bucket's response time — a simple mean-per-bucket downsample.
 */
function downsampleSparklinePoints(
	points: SparklinePoint[],
	maxPoints = SPARKLINE_MAX_POINTS,
): SparklinePoint[] {
	if (points.length <= maxPoints) return points;

	let step = points.length / maxPoints;
	let result: SparklinePoint[] = [];
	for (let i = 0; i < maxPoints; i++) {
		let chunk = points.slice(Math.floor(i * step), Math.floor((i + 1) * step));
		if (chunk.length === 0) continue;
		let avgResponseTimeMs =
			chunk.reduce((sum, point) => sum + point.responseTimeMs, 0) / chunk.length;
		result.push({
			timestamp: chunk[chunk.length - 1]!.timestamp,
			responseTimeMs: avgResponseTimeMs,
		});
	}
	return result;
}

/**
 * Every HTTP monitor's recent latency sparkline for a team in one query — unlike
 * {@link getMonitorSparkline}, which queries a single monitor, this fetches the team's
 * last `limit` HTTP results across every monitor, groups them by monitor in memory, and
 * downsamples each group to a chart-friendly point count. Avoids an N+1 query per
 * monitor on the dashboard table. Cached in KV.
 */
export async function getTeamHttpSparklines(
	teamId: string,
	limit = 500,
): Promise<Result<Map<string, SparklinePoint[]>, Error>> {
	let sql = `
		SELECT blob1 AS monitorId, timestamp, double1 AS responseTimeMs
		FROM uptime_monitor_results
		WHERE index1 = '${teamId}' AND blob2 = 'http'
		ORDER BY timestamp DESC
		LIMIT ${limit}
	`;

	let result = await queryAnalyticsCached<{
		monitorId: string;
		timestamp: string;
		responseTimeMs: number;
	}>(buildCacheKey(teamId, "httpSparklines"), getCacheTtl(60), sql);
	if (isFailure(result)) return result;

	let pointsByMonitor = new Map<string, SparklinePoint[]>();
	for (let row of result.data) {
		let points = pointsByMonitor.get(row.monitorId);
		if (!points) pointsByMonitor.set(row.monitorId, (points = []));
		points.push({ timestamp: row.timestamp, responseTimeMs: row.responseTimeMs });
	}

	let sparklines = new Map<string, SparklinePoint[]>();
	for (let [monitorId, points] of pointsByMonitor) {
		/**
		 * Rows come back newest-first; reverse to oldest-first before downsampling so
		 * bucket order (and therefore the rendered sparkline's left-to-right direction)
		 * matches getMonitorSparkline's single-monitor result.
		 */
		sparklines.set(monitorId, downsampleSparklinePoints([...points].reverse()));
	}

	return success(sparklines);
}

/** One HTTP monitor's totals for a single UTC day (see {@link getHttpDailyAggregate}). */
export interface HttpDailyAggregate {
	monitorId: string;
	totalChecks: number;
	successfulChecks: number;
	avgResponseTimeMs: number | null;
	maxResponseTimeMs: number | null;
}

/**
 * Every HTTP monitor's totals for one UTC calendar day, across every team — the source
 * `AggregateDailyStatsJob` rolls into `monitor_daily_stats`. `_sample_interval` weights
 * each row by how many real events it represents, since Analytics Engine statistically
 * samples at scale; a plain `COUNT(*)` would undercount under sampling.
 */
export async function getHttpDailyAggregate(
	date: string,
): Promise<Result<HttpDailyAggregate[], Error>> {
	let sql = `
		SELECT
			blob1 AS monitorId,
			SUM(_sample_interval * double2) AS totalChecks,
			SUMIf(_sample_interval * double2, blob3 = 'up') AS successfulChecks,
			AVG(double1) AS avgResponseTimeMs,
			MAX(double1) AS maxResponseTimeMs
		FROM uptime_monitor_results
		WHERE blob2 = 'http'
			AND timestamp >= toDateTime('${date} 00:00:00')
			AND timestamp < toDateTime('${date} 00:00:00') + INTERVAL '1' DAY
		GROUP BY blob1
	`;

	return await queryAnalytics<HttpDailyAggregate>(sql);
}
