/**
 * Tests for the summary screen's pure IV/EV table derivation.
 *
 * Covers `statTrainingRows`, which pairs a creature's individual and effort
 * values into ordered, labeled rows for display. The canvas drawing itself is
 * not exercised here; only the ordering and value pairing are asserted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { StatSet } from "~/game/data/stat";

import { statTrainingRows } from "./summary";

/** IV spread with a distinct value per stat for order-sensitive assertions. */
let IVS: StatSet = {
	hp: 31,
	attack: 30,
	defense: 29,
	"special-attack": 28,
	"special-defense": 27,
	speed: 26,
};

/** EV spread that differs from the IVs on every stat. */
let EVS: StatSet = {
	hp: 252,
	attack: 6,
	defense: 0,
	"special-attack": 100,
	"special-defense": 50,
	speed: 100,
};

test("statTrainingRows lists stats in a fixed display order", () => {
	let rows = statTrainingRows(IVS, EVS);
	expect(rows.map((row) => row.label)).toEqual(["HP", "ATK", "DEF", "SPA", "SPD", "SPE"]);
});

test("statTrainingRows pairs each stat's IV and EV values", () => {
	let rows = statTrainingRows(IVS, EVS);
	expect(rows).toEqual([
		{ label: "HP", iv: 31, ev: 252 },
		{ label: "ATK", iv: 30, ev: 6 },
		{ label: "DEF", iv: 29, ev: 0 },
		{ label: "SPA", iv: 28, ev: 100 },
		{ label: "SPD", iv: 27, ev: 50 },
		{ label: "SPE", iv: 26, ev: 100 },
	]);
});
