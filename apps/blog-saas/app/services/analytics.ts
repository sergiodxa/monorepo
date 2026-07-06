/**
 * Analytics Engine query helpers for the platform: reads back the per-blog page-view
 * counts written by the worker so the reporting cron can materialize daily usage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { env } from "cloudflare:workers";

/** A per-blog page-view total for one day. */
export interface DailyPageViews {
	blogId: string;
	date: string;
	views: number;
}

/**
 * Queries the Analytics Engine SQL API for per-blog page-view sums on a date.
 * The write shape (see the worker) is `blobs: [blogId, "page_view", host, date]`.
 * @param date - UTC day as `YYYY-MM-DD`.
 * @returns Per-blog totals (empty on query failure; the cron retries next run).
 */
export async function queryDailyPageViews(date: string): Promise<DailyPageViews[]> {
	// The Analytics Engine SQL API takes a raw string, so guard the interpolated
	// `date` to a literal `YYYY-MM-DD` (callers pass `yesterday()`). Anything else
	// is rejected fail-soft rather than risking SQL injection.
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

	let query =
		`SELECT blob1 AS blogId, sum(_sample_interval * double1) AS views ` +
		`FROM 'blog-saas-analytics' WHERE blob4 = '${date}' GROUP BY blob1`;

	let response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
		{ method: "POST", headers: { authorization: `Bearer ${env.CF_API_TOKEN}` }, body: query },
	);
	if (!response.ok) return [];

	let payload = (await response.json()) as { data?: Array<{ blogId: string; views: number }> };
	return (payload.data ?? []).map((row) => ({
		blogId: String(row.blogId),
		date,
		views: Math.round(Number(row.views) || 0),
	}));
}
