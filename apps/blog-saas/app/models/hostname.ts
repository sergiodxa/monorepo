/**
 * The `Hostname` control-plane model: one row per blog's custom hostname (Cloudflare
 * for SaaS), tracking validation and SSL status plus the DNS TXT records the owner
 * must add, with the queries the domain form and the polling cron rely on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database, TableRow } from "remix/data-table";

import { column as c, isNull, ne, or, table } from "remix/data-table";

/** Custom-hostname (Cloudflare for SaaS) record; one per blog. */
export default class Hostname {
	/** Control-plane `hostnames` table. */
	static table = table({
		name: "hostnames",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			blog_id: c.text(),
			hostname: c.text(),
			status: c.text(),
			ssl_status: c.text().nullable(),
			validation_txt_name: c.text().nullable(),
			validation_txt_value: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Finds the custom-hostname record belonging to a blog (at most one per blog).
	 *
	 * @param db The control-plane database.
	 * @param blogId The owning blog id.
	 * @returns The hostname row, or `null` if the blog has no custom domain.
	 */
	static findByBlog(db: Database, blogId: string) {
		return db.findOne(this.table, { where: { blog_id: blogId } });
	}

	/**
	 * Finds a hostname record by its (globally unique) hostname string.
	 *
	 * @param db The control-plane database.
	 * @param hostname The hostname to match.
	 * @returns The hostname row, or `null` if none is registered.
	 */
	static findByHostname(db: Database, hostname: string) {
		return db.findOne(this.table, { where: { hostname } });
	}

	/**
	 * Lists hostnames still progressing toward active, for the polling cron to
	 * refresh. Any status or SSL status other than `active` (including a null
	 * SSL) counts as incomplete, keeping every intermediate status polled to live.
	 *
	 * @param db The control-plane database.
	 * @returns The incomplete hostname rows (status or SSL still short of active).
	 */
	static findIncomplete(db: Database) {
		return db.findMany(this.table, {
			where: or(ne("status", "active"), isNull("ssl_status"), ne("ssl_status", "active")),
		});
	}

	/**
	 * Creates a hostname record in `pending_validation` status, storing the DNS TXT
	 * validation challenge returned by Cloudflare (if any).
	 *
	 * @param db The control-plane database.
	 * @param input The hostname id, owning blog id, hostname, and optional TXT
	 *   validation name/value.
	 * @returns The created hostname row.
	 * @throws If the created row cannot be read back.
	 */
	static async create(
		db: Database,
		input: {
			id: string;
			blogId: string;
			hostname: string;
			validationTxtName?: string | null;
			validationTxtValue?: string | null;
		},
	): Promise<HostnameRow> {
		let now = new Date().toISOString();
		await db.create(this.table, {
			id: input.id,
			blog_id: input.blogId,
			hostname: input.hostname,
			status: "pending_validation",
			ssl_status: null,
			validation_txt_name: input.validationTxtName ?? null,
			validation_txt_value: input.validationTxtValue ?? null,
			created_at: now,
			updated_at: now,
		});
		let created = await this.findByBlog(db, input.blogId);
		if (!created) throw new Error("Failed to create hostname");
		return created;
	}

	/**
	 * Updates a hostname's validation and SSL status, typically from the polling cron
	 * as Cloudflare progresses the hostname toward active.
	 *
	 * @param db The control-plane database.
	 * @param id The hostname id.
	 * @param status The new validation status.
	 * @param sslStatus The new SSL status, or `null`/omitted to clear it.
	 * @returns A promise resolving once the update completes.
	 */
	static async setStatus(db: Database, id: string, status: string, sslStatus?: string | null) {
		await db.update(
			this.table,
			{ id },
			{ status, ssl_status: sslStatus ?? null, updated_at: new Date().toISOString() },
		);
	}

	/**
	 * Deletes a hostname record. Rolls back a failed registration, keeping
	 * Cloudflare free of orphaned hostnames.
	 *
	 * @param db The control-plane database.
	 * @param id The hostname id.
	 * @returns A promise resolving once the deletion completes.
	 */
	static async destroy(db: Database, id: string) {
		await db.delete(this.table, { id });
	}
}

/** Persisted hostname row. */
export type HostnameRow = TableRow<typeof Hostname.table>;
