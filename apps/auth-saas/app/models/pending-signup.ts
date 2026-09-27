/**
 * Data model for pending platform signups: the organization name a `/signup`
 * submission claimed, held until its email verifies. Wraps the `pending_signups`
 * D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** One pending signup row as the control plane stores it. */
export type PendingSignupRow = TableRow<typeof PendingSignup.table>;

/**
 * Active-record–style model for pending signups, exposing static query and
 * mutation helpers over the `pending_signups` table.
 *
 * @example
 * let pending = await PendingSignup.create(db, { subjectId, organizationName: "Acme, Inc." });
 */
export default class PendingSignup {
	/** The `pending_signups` D1 table definition, keyed on the subject id its own ticket names. */
	static table = table({
		name: "pending_signups",
		primaryKey: ["subject_id"],
		columns: {
			subject_id: c.text(),
			organization_name: c.text(),
			created_at: c.integer(),
		},
	});

	/**
	 * Writes the row a signup's organization name lives in until its email verifies.
	 *
	 * @param db - Database connection.
	 * @param data - The subject the row is keyed on, and the organization name it claims.
	 * @returns A promise resolving to the newly-created row.
	 */
	static create(
		db: Database,
		data: { subjectId: string; organizationName: string },
	): Promise<PendingSignupRow> {
		return db.create(
			PendingSignup.table,
			{
				subject_id: data.subjectId,
				organization_name: data.organizationName,
				created_at: Date.now(),
			},
			{ returnRow: true },
		);
	}

	/**
	 * Finds a pending signup by the subject id its ticket names — the join
	 * `signup.verify` reads back once `verifyIdentifier` resolves the ticket.
	 *
	 * @param db - Database connection.
	 * @param subjectId - The subject id.
	 * @returns A promise resolving to the row, or null once it has been spent
	 * or never existed.
	 */
	static findBySubjectId(db: Database, subjectId: string): Promise<PendingSignupRow | null> {
		return db.findOne(PendingSignup.table, { where: { subject_id: subjectId } });
	}

	/**
	 * Deletes a pending signup once its tenant has been provisioned, spending
	 * the row exactly once.
	 *
	 * @param db - Database connection.
	 * @param subjectId - The subject id.
	 * @returns A promise resolving to whether a row was deleted.
	 */
	static deleteBySubjectId(db: Database, subjectId: string): Promise<boolean> {
		return db.delete(PendingSignup.table, { subject_id: subjectId });
	}
}
