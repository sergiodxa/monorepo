/**
 * The `Blog` control-plane model: one row per tenant blog (each backed by a Durable
 * Object addressed by its `id`), tracking slug, region, lifecycle status, and
 * custom-domain flag, with the queries/mutations used across provisioning and CRUD.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
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

	/**
	 * Finds a blog by its primary key.
	 *
	 * @param db The control-plane database.
	 * @param id The blog id.
	 * @returns The matching blog row, or `null` if none exists.
	 */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Finds a blog by its (globally unique) slug.
	 *
	 * @param db The control-plane database.
	 * @param slug The subdomain slug.
	 * @returns The matching blog row, or `null` if none exists.
	 */
	static findBySlug(db: Database, slug: string) {
		return db.findOne(this.table, { where: { slug } });
	}

	/**
	 * Lists an account's blogs, excluding soft-deleted ones (so the dashboard hides
	 * blogs in their retention window).
	 *
	 * @param db The control-plane database.
	 * @param accountId The owning account id.
	 * @returns The account's non-deleted blog rows.
	 */
	static async listByAccount(db: Database, accountId: string): Promise<BlogRow[]> {
		let rows = await db.findMany(this.table, { where: { account_id: accountId } });
		return rows.filter((row) => row.status !== "deleted");
	}

	/**
	 * Creates a blog row in `provisioning` status with a fresh UUID; the provisioner
	 * flips it to `active`/`suspended` once the DO and OIDC client are set up.
	 *
	 * @param db The control-plane database.
	 * @param input The new blog's account, name, slug, and region.
	 * @returns The created blog row.
	 * @throws If the created row cannot be read back.
	 */
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

	/**
	 * Sets the blog's lifecycle status.
	 *
	 * @param db The control-plane database.
	 * @param id The blog id.
	 * @param status The new lifecycle status.
	 * @returns A promise resolving once the update completes.
	 */
	static async setStatus(db: Database, id: string, status: BlogStatus) {
		await db.update(this.table, { id }, { status, updated_at: new Date().toISOString() });
	}

	/**
	 * Marks whether the blog's custom hostname is active. Once active, the subdomain
	 * stops serving public pages and the custom domain becomes canonical.
	 *
	 * @param db The control-plane database.
	 * @param id The blog id.
	 * @param active `true` to activate the custom hostname, `false` to deactivate.
	 * @returns A promise resolving once the update completes.
	 */
	static async setCustomHostnameActive(db: Database, id: string, active: boolean) {
		await db.update(
			this.table,
			{ id },
			{ custom_hostname_active: active ? 1 : 0, updated_at: new Date().toISOString() },
		);
	}

	/**
	 * Soft-deletes a blog: marks it `deleted` and stamps `deleted_at`, starting the
	 * 30-day retention window before the purge job hard-deletes it.
	 *
	 * @param db The control-plane database.
	 * @param id The blog id.
	 * @returns A promise resolving once the update completes.
	 */
	static async softDelete(db: Database, id: string) {
		let now = new Date().toISOString();
		await db.update(this.table, { id }, { status: "deleted", deleted_at: now, updated_at: now });
	}

	/**
	 * Restores a soft-deleted blog by clearing `deleted_at` and setting it back to
	 * `active` (only meaningful within the retention window).
	 *
	 * @param db The control-plane database.
	 * @param id The blog id.
	 * @returns A promise resolving once the update completes.
	 */
	static async restore(db: Database, id: string) {
		await db.update(
			this.table,
			{ id },
			{ status: "active", deleted_at: null, updated_at: new Date().toISOString() },
		);
	}

	/**
	 * Lists blogs that were soft-deleted before a cutoff timestamp, i.e. those past
	 * their retention window and eligible for purge.
	 *
	 * @param db The control-plane database.
	 * @param cutoffIso The ISO timestamp; rows with `deleted_at` before it are returned.
	 * @returns The blog rows eligible for hard deletion.
	 */
	static async findDeletedBefore(db: Database, cutoffIso: string): Promise<BlogRow[]> {
		let rows = await db.findMany(this.table, { where: { status: "deleted" } });
		return rows.filter((row) => row.deleted_at !== null && row.deleted_at < cutoffIso);
	}

	/**
	 * Hard-deletes a blog row. Foreign-key cascades remove the blog's hostnames and
	 * usage rows in SQL.
	 *
	 * @param db The control-plane database.
	 * @param id The blog id.
	 * @returns A promise resolving once the deletion completes.
	 */
	static async destroy(db: Database, id: string) {
		await db.delete(this.table, { id });
	}
}

/** Persisted blog row. */
export type BlogRow = TableRow<typeof Blog.table>;
