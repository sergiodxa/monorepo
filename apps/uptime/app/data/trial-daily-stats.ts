/**
 * Data-access model for `trial_daily_stats`: one row per reported UTC day of the trial funnel,
 * written by the report job the morning after and never recomputed.
 *
 * The source rows are swept after about a month and an unsubscribe erases a lead's history
 * retroactively, so a day counted once while those rows exist is its only stable answer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";
import { getTableName } from "remix/data-table";

import type { SelectTrialDailyStats } from "~/database/schema";

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

export default class TrialDailyStats {
	/**
	 * Writes one day's counters, replacing the day if it has already been reported.
	 *
	 * Idempotent on `date`, the unique column, in the one atomic statement `ON CONFLICT DO
	 * UPDATE` gives: a second row would double every later total drawn from this table.
	 *
	 * @param db - Database handle.
	 * @param input - The day and its five counters.
	 */
	static async upsertDay(db: Database, input: TrialDailyStatsInput): Promise<void> {
		let now = Date.now();
		let table = getTableName(trialDailyStats);

		await db.exec(
			`INSERT INTO ${table}
			        (id, created_at, updated_at, date, new_leads, urls_checked, emails_sent,
			         free_signups, paid_conversions)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (date) DO UPDATE
			    SET updated_at = excluded.updated_at,
			        new_leads = excluded.new_leads,
			        urls_checked = excluded.urls_checked,
			        emails_sent = excluded.emails_sent,
			        free_signups = excluded.free_signups,
			        paid_conversions = excluded.paid_conversions`,
			[
				generateUUID(),
				now,
				now,
				input.date,
				input.newLeads,
				input.urlsChecked,
				input.emailsSent,
				input.freeSignups,
				input.paidConversions,
			],
		);
	}

	/**
	 * Sums every reported day from `from` up to and including `to`, for the context block the
	 * report closes with. Summed in SQL over an indexed range, where a day the job never ran for
	 * contributes nothing; `YYYY-MM-DD` strings sort as dates, so the range needs no parsing.
	 *
	 * @param db - Database handle.
	 * @param from - First day of the range, inclusive, as `YYYY-MM-DD`.
	 * @param to - Last day of the range, inclusive, as `YYYY-MM-DD`.
	 * @returns The totals, all zero when the range holds no reported day.
	 */
	static async totalsBetween(db: Database, from: string, to: string): Promise<TrialDailyCounters> {
		let result = await db.exec(
			`SELECT SUM(new_leads) AS newLeads,
			        SUM(urls_checked) AS urlsChecked,
			        SUM(emails_sent) AS emailsSent,
			        SUM(free_signups) AS freeSignups,
			        SUM(paid_conversions) AS paidConversions
			   FROM ${getTableName(trialDailyStats)}
			  WHERE date >= ? AND date <= ?`,
			[from, to],
		);

		let [row] = (result.rows ?? []) as unknown as Record<keyof TrialDailyCounters, number | null>[];

		return {
			newLeads: Number(row?.newLeads ?? 0),
			urlsChecked: Number(row?.urlsChecked ?? 0),
			emailsSent: Number(row?.emailsSent ?? 0),
			freeSignups: Number(row?.freeSignups ?? 0),
			paidConversions: Number(row?.paidConversions ?? 0),
		};
	}

	/** One reported day, or `null` when the job never wrote it. */
	static async findByDate(db: Database, date: string): Promise<SelectTrialDailyStats | null> {
		return await db.findOne(trialDailyStats, { where: { date } });
	}
}
