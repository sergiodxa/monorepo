import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Platform account: one per IdP subject, carrying billing identity + profile. */
export default class Account {
	/** Control-plane `accounts` table. */
	static table = table({
		name: "accounts",
		primaryKey: ["id"],
		timestamps: true,
		columns: {
			id: c.text(),
			oidc_subject: c.text(),
			email: c.text(),
			display_name: c.text().nullable(),
			polar_customer_id: c.text().nullable(),
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/** Finds an account by IdP subject id. */
	static findBySubject(db: Database, subject: string) {
		return db.findOne(this.table, { where: { oidc_subject: subject } });
	}

	/** Finds an account by id. */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/** Upserts the local account for an authenticated IdP profile. */
	static async findOrCreateFromProfile(
		db: Database,
		profile: { subject: string; email: string; displayName?: string | null },
	): Promise<AccountRow> {
		let existing = await this.findBySubject(db, profile.subject);
		let now = new Date().toISOString();
		if (existing) {
			await db.update(
				this.table,
				{ id: existing.id },
				{
					email: profile.email,
					display_name: profile.displayName ?? existing.display_name,
					updated_at: now,
				},
			);
			return (await this.findById(db, existing.id)) ?? existing;
		}
		let id = crypto.randomUUID();
		await db.create(this.table, {
			id,
			oidc_subject: profile.subject,
			email: profile.email,
			display_name: profile.displayName ?? null,
			polar_customer_id: null,
			created_at: now,
			updated_at: now,
		});
		let created = await this.findById(db, id);
		if (!created) throw new Error("Failed to create account");
		return created;
	}

	/** Sets (or clears) the Polar customer id. */
	static async setPolarCustomerId(db: Database, id: string, customerId: string | null) {
		await db.update(
			this.table,
			{ id },
			{ polar_customer_id: customerId, updated_at: new Date().toISOString() },
		);
	}
}

/** Persisted account row. */
export type AccountRow = TableRow<typeof Account.table>;
