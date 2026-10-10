/**
 * The queue of accounts waiting to be erased. A row means "still owed" and its absence means
 * "nothing to do"; those two states are the whole state machine, which is why one removal
 * serves both a cancellation and a finished erasure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName } from "remix/data-table";

import type { SelectAccountDeletion } from "~/database/schema";

import { accountDeletions } from "~/database/schema";

/** Every column, so the upsert's `RETURNING` hands back a whole row. */
const COLUMNS = ["id", "created_at", "subject_id", "email", "requested_at"] as const;

export const AccountDeletions = createModel(accountDeletions, {
	optional: ["id"],

	methods: {
		/**
		 * Records a subject's deletion request, or returns the one they already have. One upsert
		 * keyed on `subject_id` keeps a double-submitted form to a single row; a repeat takes the
		 * fresher `email` the confirmation mail needs and keeps the original `requested_at`.
		 *
		 * @throws When the upsert yields no row; every path through it writes one.
		 */
		async enqueue(
			subjectId: string,
			email: string,
			requestedAt: number = Date.now(),
		): Promise<SelectAccountDeletion> {
			let result = await this.db.exec(
				`INSERT INTO ${getTableName(accountDeletions)} (id, created_at, subject_id, email, requested_at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (subject_id) DO UPDATE SET email = excluded.email
				RETURNING ${COLUMNS.join(", ")}`,
				[generateUUID(), requestedAt, subjectId, email, requestedAt],
			);

			let [row] = (result.rows ?? []) as unknown as SelectAccountDeletion[];
			if (!row) throw new Error(`Failed to enqueue account deletion for ${subjectId}`);
			return row;
		},

		/**
		 * The whole queue, oldest request first, for the daily sweep to work through. Unbounded
		 * on purpose: the table is near-empty on almost every run, and a deletion promise must
		 * reach whoever asked, however long the queue grows.
		 */
		listPending() {
			return this.query().orderBy("requested_at", "asc").all();
		},

		/**
		 * Removes a subject's queued request, if any. A person cancelling and the sweep finishing
		 * an erasure share this one method: both mean "no longer owed a deletion", which is the
		 * whole of what the absent row asserts.
		 */
		async remove(subjectId: string): Promise<void> {
			await this.query().where({ subject_id: subjectId }).delete();
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A queued account deletion, as reads return it. */
export type AccountDeletion = ModelRow<typeof AccountDeletions>;

export default AccountDeletions;
