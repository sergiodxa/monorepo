/**
 * The home page's pricing estimate, read from the query: one check interval per monitor in
 * `m`, plus the Add and Remove buttons a page without script submits. The bill comes from
 * `config/pricing.ts`, so the page and the subscription price the same pings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CostBreakdown } from "~/config/pricing";

import { monthlyCost, monthlyPings } from "~/config/pricing";

/** The query parameter holding each monitor's interval, repeated once per monitor. */
export const MONITOR_PARAM = "m";

/** The submit button that adds a monitor; its value is ignored. */
export const ADD_PARAM = "add";

/** The submit button that removes a monitor; its value is the monitor's position, from 0. */
export const REMOVE_PARAM = "remove";

/** Bounds of a monitor's interval, in minutes: as often as every minute, as rarely as hourly. */
export const MIN_INTERVAL_MINUTES = 1;
export const MAX_INTERVAL_MINUTES = 60;

/** The interval the page starts with, and that an added monitor gets. */
export const DEFAULT_INTERVAL_MINUTES = 10;

/** Most monitors one estimate prices, so a crafted query stays a small page. */
export const MAX_MONITORS = 20;

/** What the page prints: the monitors as priced and the bill for them. */
export interface PricingEstimate {
	/** Each monitor's interval in minutes, in the order the form lists them. */
	intervals: number[];
	/** Checks every monitor adds up to in a billing month. */
	pings: number;
	cost: CostBreakdown;
}

/**
 * A query value as an interval: a whole number of minutes clamped to the slider's range, or
 * nothing for a value that is not a number at all.
 */
function parseInterval(value: string): number | undefined {
	let minutes = Math.round(Number(value));
	if (!Number.isFinite(minutes) || value.trim() === "") return undefined;
	return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, minutes));
}

/**
 * Reads the estimate the query describes. Remove drops the monitor at its position and Add
 * appends one at the default interval; an empty list prices one monitor at the default, so
 * the page always shows a bill.
 *
 * @param query - The page URL's search parameters.
 * @example estimateFromQuery(new URLSearchParams("m=30&m=5")).cost.totalUsd // 5
 */
export function estimateFromQuery(query: URLSearchParams): PricingEstimate {
	let intervals = query
		.getAll(MONITOR_PARAM)
		.map(parseInterval)
		.filter((minutes) => minutes !== undefined);

	let remove = query.get(REMOVE_PARAM);
	if (remove !== null) {
		let index = Number(remove);
		if (Number.isInteger(index)) intervals = intervals.filter((_, at) => at !== index);
	}
	if (query.has(ADD_PARAM)) intervals.push(DEFAULT_INTERVAL_MINUTES);
	if (intervals.length === 0) intervals = [DEFAULT_INTERVAL_MINUTES];
	intervals = intervals.slice(0, MAX_MONITORS);

	let pings = intervals.reduce(
		(total, minutes) => total + monthlyPings({ monitors: 1, intervalMinutes: minutes }),
		0,
	);

	return { intervals, pings, cost: monthlyCost(pings) };
}
