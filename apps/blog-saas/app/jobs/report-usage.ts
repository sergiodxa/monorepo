import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Account from "~/app/models/account";
import Blog from "~/app/models/blog";
import UsageDaily from "~/app/models/usage";
import { queryDailyPageViews } from "~/app/services/analytics";

/** Yesterday's UTC date as `YYYY-MM-DD`. */
function yesterday(): string {
	return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Daily reporting cron (01:00 UTC): materializes Analytics Engine page views into
 * `usage_daily`, then ingests unreported blog-days into Polar. The `reported_at`
 * guard gives at-most-once ingestion per blog-day; failures retry next run.
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
		let ok = await polar.ingestPageViews(account.polar_customer_id, usage.page_views, usage.date);
		if (ok) await UsageDaily.markReported(db, usage.id);
	}
}
