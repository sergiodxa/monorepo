/**
 * One trial check each, the history a trial digest or report draws its uptime bar from. Rows
 * live exactly as long as the watch naming them: the sweep deletes them by following the watch
 * past its `converts_until`, so a result can neither outlive nor orphan its watch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName, gte, lt } from "remix/data-table";

import type { BatchedSweepResult } from "~/app/lib/retention";
import type { SelectTrialWatchResult } from "~/database/schema";

import { RETENTION_BATCH_SIZE, RETENTION_MAX_BATCHES } from "~/app/lib/retention";
import { trialWatchResults, trialWatches } from "~/database/schema";

/** Results a digest renders for one target: an hourly bar over a day, with room to spare. */
const RESULT_HISTORY_LIMIT = 200;

export const TrialWatchResults = createModel(trialWatchResults, {
	optional: ["id"],

	scopes: {
		ofWatch: (query, watchId: string) => query.where({ trial_watch_id: watchId }),
		checkedBetween: (query, from: number, to: number) =>
			query.where(gte("checked_at", from)).where(lt("checked_at", to)),
	},

	methods: {
		/** One target's latest results, newest first, capped at what a digest can render. */
		listByWatch(
			watchId: string,
			limit: number = RESULT_HISTORY_LIMIT,
		): Promise<SelectTrialWatchResult[]> {
			return this.ofWatch(watchId).orderBy("checked_at", "desc").limit(limit).all();
		},

		/**
		 * One target's results from `from` (inclusive) to `to` (exclusive), oldest first: the
		 * day a digest covers, or the whole week for the wrap-up, in the left-to-right order a
		 * bar is drawn in.
		 */
		listBetween(watchId: string, from: number, to: number): Promise<SelectTrialWatchResult[]> {
			return this.ofWatch(watchId).checkedBetween(from, to).orderBy("checked_at", "asc").all();
		},

		/**
		 * Deletes the history of watches whose thirty days are up, in bounded batches. The
		 * condition joins to the watch, so run it before the expired watches themselves go.
		 */
		async deleteExpired(now: number): Promise<BatchedSweepResult> {
			let results = getTableName(trialWatchResults);
			let watches = getTableName(trialWatches);

			let sql =
				`DELETE FROM ${results} WHERE \`id\` IN (` +
				`SELECT r.\`id\` FROM ${results} r ` +
				`JOIN ${watches} w ON w.\`id\` = r.\`trial_watch_id\` ` +
				`WHERE w.\`converts_until\` < ? LIMIT ?)`;

			let rowsAffected = 0;
			let batches = 0;

			while (batches < RETENTION_MAX_BATCHES) {
				let result = await this.db.exec(sql, [now, RETENTION_BATCH_SIZE]);
				batches += 1;

				let affected = result.affectedRows ?? 0;
				rowsAffected += affected;

				if (affected < RETENTION_BATCH_SIZE) {
					return { rowsAffected, batches, reachedCeiling: false };
				}
			}

			return { rowsAffected, batches, reachedCeiling: true };
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** One trial check, as reads return it. */
export type TrialWatchResult = ModelRow<typeof TrialWatchResults>;

export default TrialWatchResults;
