/**
 * The `UsageDaily` control-plane model: a daily per-blog page-view rollup
 * materialized from Analytics Engine, with a `reported_at` guard that gives
 * at-most-once ingestion of each blog-day into Polar's metered billing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Daily per-blog page-view rollup materialized from Analytics Engine. */
export default class UsageDaily {
	/** Control-plane `usage_daily` table. */
	static table = table({
		name: "usage_daily",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			blog_id: c.text(),
			date: c.text(),
			page_views: c.integer(),
			reported_at: c.text().nullable(),
			created_at: c.text(),
		},
	});

	/**
	 * Upserts a blog's page-view count for a date, overwriting any existing count for
	 * that blog-day. Safe to re-run, so the reporting cron can recompute a day.
	 *
	 * @param db The control-plane database.
	 * @param blogId The blog the views are attributed to.
	 * @param date The UTC day as `YYYY-MM-DD`.
	 * @param pageViews The page-view total for that blog-day.
	 * @returns A promise resolving once the upsert completes.
	 */
	static async record(
		db: Database,
		blogId: string,
		date: string,
		pageViews: number,
	): Promise<void> {
		let existing = await db.findMany(this.table, { where: { blog_id: blogId, date } });
		let now = new Date().toISOString();
		if (existing[0]) {
			await db.update(this.table, { id: existing[0].id }, { page_views: pageViews });
		} else {
			await db.create(this.table, {
				id: crypto.randomUUID(),
				blog_id: blogId,
				date,
				page_views: pageViews,
				reported_at: null,
				created_at: now,
			});
		}
	}

	/**
	 * Lists usage rows not yet ingested into Polar (those with a null `reported_at`),
	 * i.e. the backlog the reporting cron still needs to bill.
	 *
	 * @param db The control-plane database.
	 * @returns The unreported usage rows.
	 */
	static async findUnreported(db: Database): Promise<UsageRow[]> {
		let rows = await db.findMany(this.table);
		return rows.filter((row) => row.reported_at === null);
	}

	/**
	 * Stamps a usage row as ingested into Polar, the idempotency guard that prevents
	 * double-billing a blog-day on a later cron run.
	 *
	 * @param db The control-plane database.
	 * @param id The usage row id.
	 * @returns A promise resolving once the update completes.
	 */
	static async markReported(db: Database, id: string): Promise<void> {
		await db.update(this.table, { id }, { reported_at: new Date().toISOString() });
	}
}

/** Persisted usage row. */
export type UsageRow = TableRow<typeof UsageDaily.table>;
