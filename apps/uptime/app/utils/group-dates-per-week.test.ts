/**
 * Unit tests for the `groupDatesPerWeek` helper. They confirm it buckets a year's worth
 * of dates into arrays of weeks and that the first and last weeks of 2025 contain exactly
 * the expected partial-week dates. They exist to pin down the week-grouping edges that the
 * heatmap's weekly columns rely on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import daysOfYear from "./days-of-year";
import groupDatesPerWeek from "./group-dates-per-week";

describe(groupDatesPerWeek, () => {
	test("groups dates into weeks", () => {
		expect(groupDatesPerWeek(daysOfYear(new Date(2025, 0, 1)))).toEqual(
			expect.arrayContaining([expect.arrayContaining([expect.any(Date)])]),
		);
	});

	test("returns correctly the first week of 2025", () => {
		let dates = daysOfYear(new Date(2025, 0, 1));
		expect(groupDatesPerWeek(dates.slice(0, 7)).at(0)).toEqual([
			dates.at(0)!,
			dates.at(1)!,
			dates.at(2)!,
			dates.at(3)!,
		]);
	});

	test("returns correctly the last week of 2025", () => {
		let dates = daysOfYear(new Date(2025, 0, 1));
		expect(groupDatesPerWeek(dates).at(-1)).toEqual([
			dates.at(361)!,
			dates.at(362)!,
			dates.at(363)!,
			dates.at(364)!,
		]);
	});
});
