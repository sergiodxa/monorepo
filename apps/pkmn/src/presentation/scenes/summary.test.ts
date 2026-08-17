/**
 * Tests for the summary screen's pure stat-value table derivation.
 *
 * Covers `statValueRows`, which maps a creature's current stat values into
 * ordered, labeled rows for display. The canvas drawing itself is not exercised
 * here; only the ordering, value mapping, and the regression that effort values
 * are never surfaced are asserted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { StatSet } from "~/game/data/stat";

import { statValueRows } from "./summary";

/** Current stat values with a distinct number per stat for order assertions. */
let STATS: StatSet = {
	hp: 120,
	attack: 84,
	defense: 76,
	"special-attack": 95,
	"special-defense": 70,
	speed: 102,
};

/** An EV spread whose values are absent from `STATS` so leaks are detectable. */
let EVS: StatSet = {
	hp: 252,
	attack: 6,
	defense: 0,
	"special-attack": 100,
	"special-defense": 50,
	speed: 100,
};

test("statValueRows lists stats in a fixed display order", () => {
	let rows = statValueRows(STATS);
	expect(rows.map((row) => row.label)).toEqual(["HP", "ATK", "DEF", "SPA", "SPD", "SPE"]);
});

test("statValueRows maps each stat's current value in order", () => {
	let rows = statValueRows(STATS);
	expect(rows).toEqual([
		{ label: "HP", value: 120 },
		{ label: "ATK", value: 84 },
		{ label: "DEF", value: 76 },
		{ label: "SPA", value: 95 },
		{ label: "SPD", value: 70 },
		{ label: "SPE", value: 102 },
	]);
});

test("statValueRows shows current stat values and never effort values", () => {
	let rows = statValueRows(STATS);

	// Regression: the STATS page must show current stat values, not EVs. Every
	// row carries a `value` (never an `ev`) and none of the EV numbers leak in.
	for (let row of rows) {
		expect(row).not.toHaveProperty("ev");
		expect(Object.values(EVS)).not.toContain(row.value);
	}
	expect(rows.map((row) => row.value)).toEqual(Object.values(STATS));
});
