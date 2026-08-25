/**
 * Unit tests for the `TrialDailyStats` data-access model: the stored copy of a reported day,
 * and the trailing sum the report closes with.
 *
 * The case worth having is the re-run. The job is dispatched through a queue, so a redelivered
 * message could write a day twice and double every later total drawn from this table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { TrialDailyStatsInput } from "~/app/data/trial-daily-stats";

import TrialDailyStats, { isEmptyDay } from "~/app/data/trial-daily-stats";
import { createTestDatabase } from "~/app/lib/test/db";
import { trialDailyStats } from "~/database/schema";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** A reported day, with any counter overridable per test. */
async function store(date: string, overrides: Partial<TrialDailyStatsInput> = {}) {
	await TrialDailyStats.upsertDay(db, {
		date,
		newLeads: 1,
		urlsChecked: 1,
		emailsSent: 1,
		freeSignups: 0,
		paidConversions: 0,
		...overrides,
	});
}

describe("TrialDailyStats.upsertDay", () => {
	test("stores the day's five counters", async () => {
		await store("2026-07-01", {
			newLeads: 3,
			urlsChecked: 4,
			emailsSent: 12,
			freeSignups: 2,
			paidConversions: 1,
		});

		let row = await TrialDailyStats.findByDate(db, "2026-07-01");
		expect(row?.new_leads).toBe(3);
		expect(row?.urls_checked).toBe(4);
		expect(row?.emails_sent).toBe(12);
		expect(row?.free_signups).toBe(2);
		expect(row?.paid_conversions).toBe(1);
	});

	test("re-running a day replaces it instead of adding a second row", async () => {
		await store("2026-07-01", { newLeads: 3 });
		await store("2026-07-01", { newLeads: 5 });

		expect(await db.findMany(trialDailyStats, {})).toHaveLength(1);
		expect((await TrialDailyStats.findByDate(db, "2026-07-01"))?.new_leads).toBe(5);
	});

	test("records a day on which nothing happened, rather than leaving a gap", async () => {
		await store("2026-07-01", {
			newLeads: 0,
			urlsChecked: 0,
			emailsSent: 0,
			freeSignups: 0,
			paidConversions: 0,
		});

		expect(await TrialDailyStats.findByDate(db, "2026-07-01")).not.toBeNull();
	});
});

describe("TrialDailyStats.totalsBetween", () => {
	test("sums the reported days inside the range, inclusive at both ends", async () => {
		await store("2026-06-29", { newLeads: 1, paidConversions: 1 });
		await store("2026-06-30", { newLeads: 2 });
		await store("2026-07-01", { newLeads: 4, paidConversions: 2 });

		let totals = await TrialDailyStats.totalsBetween(db, "2026-06-30", "2026-07-01");

		expect(totals.newLeads).toBe(6);
		expect(totals.paidConversions).toBe(2);
	});

	test("answers with zeroes for a range holding no reported day", async () => {
		expect(await TrialDailyStats.totalsBetween(db, "2026-01-01", "2026-01-31")).toEqual({
			newLeads: 0,
			urlsChecked: 0,
			emailsSent: 0,
			freeSignups: 0,
			paidConversions: 0,
		});
	});
});

describe("isEmptyDay", () => {
	test("is true only when every counter is zero", () => {
		let zero = {
			newLeads: 0,
			urlsChecked: 0,
			emailsSent: 0,
			freeSignups: 0,
			paidConversions: 0,
		};

		expect(isEmptyDay(zero)).toBe(true);
		expect(isEmptyDay({ ...zero, emailsSent: 1 })).toBe(false);
		expect(isEmptyDay({ ...zero, paidConversions: 1 })).toBe(false);
	});
});
