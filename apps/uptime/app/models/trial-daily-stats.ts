/**
 * One row per reported UTC day of the trial funnel, written by the report job the morning
 * after and never recomputed: the source rows are swept within a month and an unsubscribe
 * erases a lead's history, so a day counted while those rows exist is its only stable answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName } from "remix/data-table";

import { trialDailyStats } from "~/database/schema";

/** The five counters a reported day is made of, separate from the row that stores them. */
export interface TrialDailyCounters {
	/** Addresses handed over for the first time. */
	newLeads: number;
	/** URLs submitted to the free form, one per watch created. */
	urlsChecked: number;
	/** Trial emails a transport accepted, across every lead. */
	emailsSent: number;
	/** Leads who signed in and became a free account. */
	freeSignups: number;
	/** Converted accounts whose first payment landed. */
	paidConversions: number;
}

/** A day of counters, ready to store. */
export interface TrialDailyStatsInput extends TrialDailyCounters {
	/** The reported UTC day, as `YYYY-MM-DD`. */
	date: string;
}

/** Whether a day had nothing at all happen on it, which is what suppresses the report email. */
export function isEmptyDay(counters: TrialDailyCounters): boolean {
	return (
		counters.newLeads === 0 &&
		counters.urlsChecked === 0 &&
		counters.emailsSent === 0 &&
		counters.freeSignups === 0 &&
		counters.paidConversions === 0
	);
}

export const TrialDailyStats = createModel(trialDailyStats, {
	optional: ["new_leads", "urls_checked", "emails_sent", "free_signups", "paid_conversions"],

	methods: {
		/**
		 * Writes one day's counters, replacing the day if it was already reported, in one
		 * upsert keyed on `date` that keeps the row's id and `created_at`: a
		 * second row would double every later total drawn from this table.
		 */
		async upsertDay(input: TrialDailyStatsInput): Promise<void> {
			unwrap(
				await this.upsert(
					{
						id: generateUUID(),
						date: input.date,
						new_leads: input.newLeads,
						urls_checked: input.urlsChecked,
						emails_sent: input.emailsSent,
						free_signups: input.freeSignups,
						paid_conversions: input.paidConversions,
					},
					{ conflict: ["date"] },
				),
			);
		},

		/**
		 * Sums every reported day from `from` through `to`, both `YYYY-MM-DD` and inclusive,
		 * for the context block the report closes with. A day the job never ran for contributes
		 * nothing, and an empty range reads as zeroes.
		 */
		async totalsBetween(from: string, to: string): Promise<TrialDailyCounters> {
			let result = await this.db.exec(
				`SELECT SUM(new_leads) AS newLeads,
				        SUM(urls_checked) AS urlsChecked,
				        SUM(emails_sent) AS emailsSent,
				        SUM(free_signups) AS freeSignups,
				        SUM(paid_conversions) AS paidConversions
				   FROM ${getTableName(trialDailyStats)}
				  WHERE date >= ? AND date <= ?`,
				[from, to],
			);

			let [row] = (result.rows ?? []) as unknown as Record<
				keyof TrialDailyCounters,
				number | null
			>[];

			return {
				newLeads: Number(row?.newLeads ?? 0),
				urlsChecked: Number(row?.urlsChecked ?? 0),
				emailsSent: Number(row?.emailsSent ?? 0),
				freeSignups: Number(row?.freeSignups ?? 0),
				paidConversions: Number(row?.paidConversions ?? 0),
			};
		},
	},
});

/** One reported day of the trial funnel, as reads return it. */
export type TrialDailyStat = ModelRow<typeof TrialDailyStats>;

export default TrialDailyStats;
