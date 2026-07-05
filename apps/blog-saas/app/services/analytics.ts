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
