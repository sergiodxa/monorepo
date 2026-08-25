/**
 * Data-access model for `account_deletions`: the queue of accounts waiting to be erased.
 *
 * A row means "still owed" and its absence means "nothing to do"; those two states are the
 * whole state machine, which is why one removal serves both a cancellation and a finished
 * erasure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { getTableName } from "remix/data-table";

import type { SelectAccountDeletion } from "~/database/schema";

import { accountDeletions } from "~/database/schema";

/** Every column, so the upsert's `RETURNING` hands back a whole row. */
const COLUMNS = ["id", "created_at", "subject_id", "email", "requested_at"] as const;

export default class AccountDeletion {
	/**
	 * Records a subject's deletion request, or returns the one they already have. One upsert
	 * keyed on `subject_id` keeps a double-submitted form to a single row; a repeat takes the
	 * fresher `email` the confirmation mail needs and keeps the original `requested_at`.
	 *
	 * @throws When the upsert yields no row; every path through it writes one.
	 */
	static async enqueue(
		db: Database,
		subjectId: string,
		email: string,
		requestedAt: number = Date.now(),
	): Promise<SelectAccountDeletion> {
		let table = getTableName(accountDeletions);

		let result = await db.exec(
			`INSERT INTO ${table} (id, created_at, subject_id, email, requested_at)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT (subject_id) DO UPDATE SET email = excluded.email
			RETURNING ${COLUMNS.join(", ")}`,
			[generateUUID(), requestedAt, subjectId, email, requestedAt],
		);

		let [row] = (result.rows ?? []) as unknown as SelectAccountDeletion[];
		if (!row) throw new Error(`Failed to enqueue account deletion for ${subjectId}`);
		return row;
	}

	/** The pending request for a subject, or `null` when they have none. */
	static async findBySubjectId(db: Database, subjectId: string) {
		return await db.findOne(accountDeletions, { where: { subject_id: subjectId } });
	}

	/**
	 * The whole queue, oldest request first, for the daily sweep to work through. Unbounded
	 * on purpose: the table is near-empty on almost every run, and a ceiling would strand
	 * whoever fell past it until a shorter day, which a deletion promise cannot allow.
	 */
	static async listPending(db: Database): Promise<SelectAccountDeletion[]> {
		let result = await db.exec(
			`SELECT ${COLUMNS.join(", ")} FROM ${getTableName(accountDeletions)}
			  ORDER BY requested_at ASC`,
		);

		return (result.rows ?? []) as unknown as SelectAccountDeletion[];
	}

	/**
	 * Removes a subject's queued request, if any. A person cancelling and the sweep finishing
	 * an erasure share this one method: both mean "no longer owed a deletion", which is the
	 * whole of what the absent row asserts.
	 */
	static async remove(db: Database, subjectId: string): Promise<void> {
		await db.deleteMany(accountDeletions, { where: { subject_id: subjectId } });
	}
}
