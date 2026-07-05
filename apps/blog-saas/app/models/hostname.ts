import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

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

	/** Finds the hostname record for a blog. */
	static findByBlog(db: Database, blogId: string) {
		return db.findOne(this.table, { where: { blog_id: blogId } });
	}

	/** Finds a hostname record by hostname string. */
	static findByHostname(db: Database, hostname: string) {
		return db.findOne(this.table, { where: { hostname } });
	}

	/** Lists hostnames still pending validation (for the polling cron). */
	static findPending(db: Database) {
		return db.findMany(this.table, { where: { status: "pending_validation" } });
	}

	/** Creates a pending hostname record. */
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

	/** Updates a hostname's validation/ssl status. */
	static async setStatus(db: Database, id: string, status: string, sslStatus?: string | null) {
		await db.update(
			this.table,
			{ id },
			{ status, ssl_status: sslStatus ?? null, updated_at: new Date().toISOString() },
		);
	}

	/** Deletes a hostname record. */
	static async destroy(db: Database, id: string) {
		await db.delete(this.table, { id });
	}
}

/** Persisted hostname row. */
export type HostnameRow = TableRow<typeof Hostname.table>;
