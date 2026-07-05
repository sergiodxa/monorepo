import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** DO location-hint region codes (immutable per blog). */
export type Region = "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";

/** Blog lifecycle status. */
export type BlogStatus = "provisioning" | "active" | "suspended" | "deleted";

/** A tenant blog: one Durable Object, addressed by this row's `id`. */
export default class Blog {
	/** Control-plane `blogs` table. */
	static table = table({
		name: "blogs",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			account_id: c.text(),
			name: c.text(),
			slug: c.text(),
			region: c.text(),
			status: c.text(),
			custom_hostname_active: c.integer(),
			deleted_at: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/** Finds a blog by id. */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/** Finds a blog by slug. */
	static findBySlug(db: Database, slug: string) {
		return db.findOne(this.table, { where: { slug } });
	}

	/** Lists a account's non-deleted blogs. */
	static async listByAccount(db: Database, accountId: string): Promise<BlogRow[]> {
		let rows = await db.findMany(this.table, { where: { account_id: accountId } });
		return rows.filter((row) => row.status !== "deleted");
	}

	/** Creates a blog row in `provisioning` status. */
	static async create(
		db: Database,
		input: { accountId: string; name: string; slug: string; region: Region },
	): Promise<BlogRow> {
		let now = new Date().toISOString();
		let id = crypto.randomUUID();
		await db.create(this.table, {
			id,
			account_id: input.accountId,
			name: input.name,
			slug: input.slug,
			region: input.region,
			status: "provisioning",
			custom_hostname_active: 0,
			deleted_at: null,
			created_at: now,
			updated_at: now,
		});
		let created = await this.findById(db, id);
		if (!created) throw new Error("Failed to create blog");
		return created;
	}

	/** Sets the blog status. */
	static async setStatus(db: Database, id: string, status: BlogStatus) {
		await db.update(this.table, { id }, { status, updated_at: new Date().toISOString() });
	}

	/** Marks custom-hostname active/inactive. */
	static async setCustomHostnameActive(db: Database, id: string, active: boolean) {
		await db.update(
			this.table,
			{ id },
			{ custom_hostname_active: active ? 1 : 0, updated_at: new Date().toISOString() },
		);
	}

	/** Soft-deletes a blog (30-day retention window before purge). */
	static async softDelete(db: Database, id: string) {
		let now = new Date().toISOString();
		await db.update(this.table, { id }, { status: "deleted", deleted_at: now, updated_at: now });
	}

	/** Restores a soft-deleted blog. */
	static async restore(db: Database, id: string) {
		await db.update(
			this.table,
			{ id },
			{ status: "active", deleted_at: null, updated_at: new Date().toISOString() },
		);
	}

	/** Lists blogs soft-deleted before a cutoff ISO timestamp (for purge). */
	static async findDeletedBefore(db: Database, cutoffIso: string): Promise<BlogRow[]> {
		let rows = await db.findMany(this.table, { where: { status: "deleted" } });
		return rows.filter((row) => row.deleted_at !== null && row.deleted_at < cutoffIso);
	}

	/** Hard-deletes a blog row (cascades hostnames/usage in SQL). */
	static async destroy(db: Database, id: string) {
		await db.delete(this.table, { id });
	}
}

/** Persisted blog row. */
export type BlogRow = TableRow<typeof Blog.table>;
