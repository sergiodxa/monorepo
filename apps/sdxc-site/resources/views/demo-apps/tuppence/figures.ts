/**
 * The sums Tuppence's screens draw: spending by category and by day, the running total of a
 * month against the month before, how each budget stands, and the bills due next. Every sum
 * is in euro cents, counting the visitor's own share of a split bill.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CategoryId, Recurring } from "./data";
import type { Entry, Wallet } from "./state";

import {
	CATEGORIES,
	RECURRING,
	TODAY,
	addDays,
	daysInMonth,
	findAccount,
	findCategory,
	previousMonth,
	toHome,
} from "./data";
import { budgetFor, entries } from "./state";

/**
 * Whether a movement is spending: money out in a spending category.
 *
 * @param entry The movement.
 */
export function isSpending(entry: Entry): boolean {
	return entry.share < 0 && (findCategory(entry.category)?.spending ?? false);
}

/** A movement's spending in euro cents, positive. */
function spent(entry: Entry): number {
	return -toHome(entry.share, findAccount(entry.account)?.currency ?? "EUR");
}

/**
 * Spending in a month, per category, largest first; categories with none are left out.
 *
 * @param wallet The visitor's changes.
 * @param month `YYYY-MM`.
 * @param through The last day of the month counted, for comparing like with like.
 */
export function spendingByCategory(
	wallet: Wallet,
	month: string,
	through = 31,
): Array<{ category: CategoryId; total: number }> {
	let totals = new Map<CategoryId, number>();
	for (let entry of entries(wallet)) {
		if (!entry.date.startsWith(month) || Number(entry.date.slice(8)) > through) continue;
		if (!isSpending(entry)) continue;
		totals.set(entry.category, (totals.get(entry.category) ?? 0) + spent(entry));
	}
	return CATEGORIES.filter((category) => totals.has(category.id))
		.map((category) => ({ category: category.id, total: totals.get(category.id) ?? 0 }))
		.sort((a, b) => b.total - a.total);
}

/**
 * A month's spending as a running total, one point per day: the curve the home screen lays
 * over last month's.
 *
 * @param wallet The visitor's changes.
 * @param month `YYYY-MM`.
 * @param through The last day drawn; a current month stops at today.
 */
export function cumulative(wallet: Wallet, month: string, through: number): number[] {
	let daily = Array.from({ length: through }, () => 0);
	for (let entry of entries(wallet)) {
		if (!entry.date.startsWith(month) || !isSpending(entry)) continue;
		let day = Number(entry.date.slice(8));
		if (day <= through) daily[day - 1]! += spent(entry);
	}
	let running = 0;
	return daily.map((amount) => {
		running += amount;
		return running;
	});
}

/** How this month's spending so far compares with the same days of last month. */
export interface MonthToDate {
	month: string;
	day: number;
	total: number;
	/** Last month's spending over the same number of days. */
	before: number;
	/** Last month's whole spending. */
	beforeWhole: number;
	thisCurve: number[];
	lastCurve: number[];
}

/**
 * This month so far beside last month.
 *
 * @param wallet The visitor's changes.
 */
export function monthToDate(wallet: Wallet): MonthToDate {
	let month = TODAY.slice(0, 7);
	let day = Number(TODAY.slice(8));
	let last = previousMonth(month);
	let thisCurve = cumulative(wallet, month, day);
	let lastCurve = cumulative(wallet, last, daysInMonth(last));
	return {
		month,
		day,
		total: thisCurve[thisCurve.length - 1] ?? 0,
		before: lastCurve[day - 1] ?? 0,
		beforeWhole: lastCurve[lastCurve.length - 1] ?? 0,
		thisCurve,
		lastCurve,
	};
}

/** Where a budget stands this month. */
export interface BudgetStatus {
	category: CategoryId;
	budget: number;
	spent: number;
	/** `over` past the budget, `near` past 80% of it, else `fine`. */
	state: "over" | "near" | "fine";
	/** What the month's pace projects by its last day. */
	projected: number;
}

/** A budget's state from how much of it is spent: past it, past 80% of it, or within. */
function budgetState(ratio: number): BudgetStatus["state"] {
	if (ratio > 1) return "over";
	if (ratio >= 0.8) return "near";
	return "fine";
}

/**
 * Every category with a budget, as this month stands: most stretched first.
 *
 * @param wallet The visitor's changes.
 */
export function budgetStatuses(wallet: Wallet): BudgetStatus[] {
	let month = TODAY.slice(0, 7);
	let day = Number(TODAY.slice(8));
	let totals = new Map(spendingByCategory(wallet, month).map((row) => [row.category, row.total]));
	return CATEGORIES.flatMap((category) => {
		let budget = budgetFor(wallet, category.id);
		if (budget === undefined) return [];
		let spentSoFar = totals.get(category.id) ?? 0;
		return [
			{
				category: category.id,
				budget,
				spent: spentSoFar,
				state: budgetState(spentSoFar / budget),
				projected: Math.round((spentSoFar / day) * daysInMonth(month)),
			},
		];
	}).sort((a, b) => b.spent / b.budget - a.spent / a.budget);
}

/** A bill, subscription or income on the day it next falls due. */
export interface Upcoming extends Recurring {
	date: string;
}

/**
 * Everything that repeats, on its next due day after today, soonest first.
 *
 * @param days How far ahead to look.
 */
export function upcoming(days: number): Upcoming[] {
	let found: Upcoming[] = [];
	for (let offset = 1; offset <= days; offset++) {
		let date = addDays(TODAY, offset);
		for (let entry of RECURRING) {
			if (Number(date.slice(8)) === entry.day) found.push({ ...entry, date });
		}
	}
	return found;
}

/**
 * The monthly cost of everything that repeats out of an account, in euro cents.
 *
 * @param kinds Which kinds to count.
 */
export function monthlyTotal(kinds: readonly Recurring["kind"][]): number {
	return RECURRING.filter((entry) => kinds.includes(entry.kind)).reduce(
		(total, entry) =>
			total + Math.abs(toHome(entry.amount, findAccount(entry.account)?.currency ?? "EUR")),
		0,
	);
}
