/**
 * The usage-reporting cron job: materializes the previous day's Analytics Engine
 * page views into the `usage_daily` rollup, then ingests any unreported blog-days
 * into Polar's metered billing with at-most-once semantics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Account from "~/app/models/account";
import Blog from "~/app/models/blog";
import UsageDaily from "~/app/models/usage";
import { queryDailyPageViews } from "~/app/services/analytics";

/**
 * Computes yesterday's UTC date, the day the reporting run rolls up.
 *
 * @returns Yesterday's date as `YYYY-MM-DD` in UTC.
 */
function yesterday(): string {
	return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Builds the deterministic Polar deduplication id for a blog-day usage event. Because
 * it depends only on the blog and date, re-sending the same blog-day always carries
 * the same `external_id`, so Polar discards the duplicate — the guard that keeps
 * reporting idempotent when a prior run ingested the event but failed to persist
 * `reported_at`.
 *
 * @param blogId The blog the usage belongs to.
 * @param date The reported day as `YYYY-MM-DD`.
 * @returns The stable external id, e.g. `page_views:blog-1:2026-07-04`.
 */
function usageEventId(blogId: string, date: string): string {
	return `page_views:${blogId}:${date}`;
}

/**
 * Daily reporting cron (01:00 UTC): materializes Analytics Engine page views into
 * `usage_daily`, then ingests unreported blog-days into Polar. Each event carries a
 * deterministic `(blog_id, date)` deduplication id, so if a run ingests an event but
 * fails to stamp `reported_at`, the next run re-sends the same id and Polar discards
 * the duplicate — giving true at-most-once billing per blog-day across partial
 * failure. Failures retry next run.
 *
 * @returns A promise resolving once the day is rolled up and reported.
 */
export async function reportUsage(): Promise<void> {
	let db = getServiceContainer().get(Database);
	let date = yesterday();

	for (let row of await queryDailyPageViews(date)) {
		await UsageDaily.record(db, row.blogId, date, row.views);
	}

	let polar = getServiceContainer().get(PolarClient);
	for (let usage of await UsageDaily.findUnreported(db)) {
		let blog = await Blog.findById(db, usage.blog_id);
		if (!blog) continue;
		let account = await Account.findById(db, blog.account_id);
		if (!account?.polar_customer_id) continue;
		let ok = await polar.ingestPageViews(
			account.polar_customer_id,
			usage.page_views,
			usage.date,
			usageEventId(usage.blog_id, usage.date),
		);
		if (ok) await UsageDaily.markReported(db, usage.id);
	}
}
