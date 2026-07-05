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

	/** Upserts a blog's page-view count for a date (safe to re-run). */
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

	/** Lists usage rows not yet reported to Polar. */
	static async findUnreported(db: Database): Promise<UsageRow[]> {
		let rows = await db.findMany(this.table);
		return rows.filter((row) => row.reported_at === null);
	}

	/** Marks a usage row as ingested into Polar (idempotency guard). */
	static async markReported(db: Database, id: string): Promise<void> {
		await db.update(this.table, { id }, { reported_at: new Date().toISOString() });
	}
}

/** Persisted usage row. */
export type UsageRow = TableRow<typeof UsageDaily.table>;
