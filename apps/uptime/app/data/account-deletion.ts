/**
 * Data-access model for `account_deletions`: the queue of accounts waiting to be erased.
 * Enqueues a request idempotently, reads back whether one subject has a pending request,
 * lists the queue for the daily sweep, and removes a row — which is both what a cancellation
 * does and what the sweep does once an erasure has actually finished.
 *
 * There is no status column and no attempt counter to read here, deliberately: a row means
 * "still owed", its absence means "nothing to do", and those two states are the whole state
 * machine. See the table's docblock in `database/schema.ts` for why the row also carries an
 * email address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { getTableName } from "remix/data-table";

import type { SelectAccountDeletion } from "~/database/schema";

import { accountDeletions } from "~/database/schema";

/** Every column, so the upsert's `RETURNING` hands back a whole row rather than a fragment. */
const COLUMNS = ["id", "created_at", "subject_id", "email", "requested_at"] as const;

export default class AccountDeletion {
	/**
	 * Records that a subject asked for their account to be deleted, or returns the request
	 * they already have.
	 *
	 * One statement keyed on the unique `subject_id`, not a read followed by a write: a
	 * double-submitted form would otherwise have both requests find nothing and both insert,
	 * and the second insert would fail on the constraint after the first had already signed
	 * the person out.
	 *
	 * A repeat submission updates `email` — the address on the current ID token is the freshest
	 * one available and the only one the confirmation mail can use — and leaves `requested_at`
	 * alone, so the queued-state copy keeps telling the person when they actually asked rather
	 * than when they last reloaded the page.
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
		// The upsert is unconditional, so every path through it writes a row and returns it.
		if (!row) throw new Error(`Failed to enqueue account deletion for ${subjectId}`);
		return row;
	}

	/** The pending request for a subject, or `null` when they have none. */
	static async findBySubjectId(db: Database, subjectId: string) {
		return await db.findOne(accountDeletions, { where: { subject_id: subjectId } });
	}

	/**
	 * The whole queue, oldest request first, for the daily sweep to work through.
	 *
	 * Unpaginated and unbounded on purpose: the table is empty on almost every run, and a
	 * ceiling here would silently strand whoever fell past it until a day when the queue was
	 * shorter — the opposite of what a deletion promise needs.
	 */
	static async listPending(db: Database): Promise<SelectAccountDeletion[]> {
		let result = await db.exec(
			`SELECT ${COLUMNS.join(", ")} FROM ${getTableName(accountDeletions)}
			  ORDER BY requested_at ASC`,
		);

		return (result.rows ?? []) as unknown as SelectAccountDeletion[];
	}

	/**
	 * Removes a subject's queued request, if any.
	 *
	 * Two callers with opposite intents and identical effects: a person cancelling before the
	 * sweep runs, and the sweep itself after an erasure completed. Both mean "this subject is
	 * no longer owed a deletion", which is the only thing the absence of a row asserts, so they
	 * share one method rather than pretending the row remembers which of them removed it.
	 */
	static async remove(db: Database, subjectId: string): Promise<void> {
		await db.deleteMany(accountDeletions, { where: { subject_id: subjectId } });
	}
}
