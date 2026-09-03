/**
 * The usage-reporting job: materializes the previous day's Analytics Engine page views
 * into the `usage_daily` rollup, then reports every unreported blog-day to the billing
 * platform's meter with at-most-once semantics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UsageEvent } from "@pkg/billing";

import { createJobHandler } from "@pkg/jobs";
import { isFailure } from "@pkg/result";

import jobs from "~/app/jobs";
import { PAGE_VIEWS_METER, polar } from "~/app/lib/billing";
import BillingCustomer from "~/app/models/billing-customer";
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
 * Builds the deduplication id for a blog-day usage event, so re-sending the same
 * blog-day always carries the same key and the platform counts it once if a prior
 * run reported it but failed to persist `reported_at`.
 *
 * @param blogId The blog the usage belongs to.
 * @param date The reported day as `YYYY-MM-DD`.
 * @returns The stable external id, e.g. `page_views:blog-1:2026-07-04`.
 */
function usageEventId(blogId: string, date: string): string {
	return `page_views:${blogId}:${date}`;
}

/**
 * Materializes yesterday's page views into `usage_daily`, then reports the unreported
 * blog-days in one batch. A rejected batch leaves every row unreported and logs the
 * reason, so the next run sends the same keys and the platform still counts them once.
 */
export default createJobHandler(jobs.reportUsage, async (ctx) => {
	let date = yesterday();

	for (let row of await queryDailyPageViews(date)) {
		await UsageDaily.record(ctx.database, row.blogId, date, row.views);
	}

	let events: UsageEvent[] = [];
	let pending: string[] = [];

	for (let usage of await UsageDaily.findUnreported(ctx.database)) {
		if (ctx.signal.aborted) ctx.ack("The next run reports the blog-days left.");

		let blog = await Blog.findById(ctx.database, usage.blog_id);
		if (!blog) continue;
		let customer = await BillingCustomer.findDefault(ctx.database, blog.account_id);
		if (!customer) continue;

		events.push({
			name: PAGE_VIEWS_METER,
			customer: { id: customer.provider_customer_id },
			externalId: usageEventId(usage.blog_id, usage.date),
			metadata: { views: usage.page_views, day: usage.date },
		});
		pending.push(usage.id);
	}

	if (events.length === 0) return ctx.logger.info("usage.reported", { date, count: 0 });

	let ingested = await polar.usage.ingest(events);

	if (isFailure(ingested)) {
		return ctx.logger.error("usage.ingest_failed", {
			date,
			count: events.length,
			code: ingested.error.code,
			providerCode: ingested.error.providerCode,
		});
	}

	for (let id of pending) await UsageDaily.markReported(ctx.database, id);

	ctx.logger.info("usage.reported", {
		date,
		count: pending.length,
		accepted: ingested.data.accepted,
	});
});
