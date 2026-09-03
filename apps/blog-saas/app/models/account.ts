/**
 * The `Account` control-plane model: one row per IdP subject, holding the platform
 * user's profile, plus the queries and mutations that look accounts up and keep them
 * tracking the identity provider on every login.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** Platform account: one per IdP subject, carrying the profile the dashboard reads. */
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
			created_at: c.text(),
			updated_at: c.text(),
		},
	});

	/**
	 * Finds an account by its IdP subject id (the stable identifier from the OIDC
	 * provider).
	 *
	 * @param db The control-plane database.
	 * @param subject The OIDC subject id to match.
	 * @returns The matching account row, or `null` if none exists.
	 */
	static findBySubject(db: Database, subject: string) {
		return db.findOne(this.table, { where: { oidc_subject: subject } });
	}

	/**
	 * Finds an account by its primary key.
	 *
	 * @param db The control-plane database.
	 * @param id The account id.
	 * @returns The matching account row, or `null` if none exists.
	 */
	static findById(db: Database, id: string) {
		return db.findOne(this.table, { where: { id } });
	}

	/**
	 * Upserts the local account for an authenticated IdP profile: refreshes the email
	 * and display name of an existing account, or creates a new one. Called on every
	 * successful login so the local record tracks the IdP.
	 *
	 * @param db The control-plane database.
	 * @param profile The verified IdP profile (subject, email, optional display name).
	 * @returns The up-to-date account row.
	 * @throws If a freshly created account cannot be read back.
	 * @example
	 * let account = await Account.findOrCreateFromProfile(db, {
	 *   subject: profile.subject,
	 *   email: profile.email,
	 *   displayName: profile.displayName,
	 * });
	 */
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
			created_at: now,
			updated_at: now,
		});
		let created = await this.findById(db, id);
		if (!created) throw new Error("Failed to create account");
		return created;
	}
}

/** Persisted account row. */
export type AccountRow = TableRow<typeof Account.table>;
