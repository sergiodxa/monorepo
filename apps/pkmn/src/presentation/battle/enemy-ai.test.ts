/**
 * Verifies the deterministic enemy move-selection AI.
 *
 * These assertions pin down the choice policy the battle scene relies on: prefer
 * the highest expected damage (base power weighted by type effectiveness), skip
 * moves that are out of PP or disabled, break ties toward the lowest slot index,
 * and fall back gracefully when no damaging or usable move exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { Matchup } from "~/game/data/type";

import { Effectiveness } from "~/game/data/type";

import { chooseEnemyAction, type EnemyMoveOption } from "./enemy-ai";

/** A tiny type chart: fire is super effective on grass, weak on water. */
let TYPE_CHART: Matchup<string> = {
	fire: { grass: Effectiveness.SUPER, water: Effectiveness.WEAK },
	water: { fire: Effectiveness.SUPER, grass: Effectiveness.WEAK },
	normal: {},
};

function move(overrides: Partial<EnemyMoveOption> & { index: 0 | 1 | 2 | 3 }): EnemyMoveOption {
	return {
		id: `move-${overrides.index}`,
		pp: 10,
		power: 40,
		type: "normal",
		isStatus: false,
		...overrides,
	};
}

test("prefers the higher-power move among usable damaging moves", () => {
	let choice = chooseEnemyAction({
		moves: [
			move({ index: 0, power: 40 }),
			move({ index: 1, power: 90 }),
			move({ index: 2, power: 60 }),
		],
		defenderTypes: ["normal"],
		typeChart: TYPE_CHART,
	});

	expect(choice).toBe(1);
});

test("weights damage by type effectiveness against the defender", () => {
	// The weaker-power fire move (super effective, 60 * 2 = 120) beats the
	// higher-power normal move (80 * 1 = 80) once effectiveness is applied.
	let choice = chooseEnemyAction({
		moves: [
			move({ index: 0, power: 80, type: "normal" }),
			move({ index: 1, power: 60, type: "fire" }),
		],
		defenderTypes: ["grass"],
		typeChart: TYPE_CHART,
	});

	expect(choice).toBe(1);
});

test("skips a move that is out of PP", () => {
	let choice = chooseEnemyAction({
		moves: [move({ index: 0, power: 120, pp: 0 }), move({ index: 1, power: 50, pp: 5 })],
		defenderTypes: ["normal"],
		typeChart: TYPE_CHART,
	});

	expect(choice).toBe(1);
});

test("skips a disabled move", () => {
	let choice = chooseEnemyAction({
		moves: [move({ index: 0, power: 120, disabled: true }), move({ index: 1, power: 50 })],
		defenderTypes: ["normal"],
		typeChart: TYPE_CHART,
	});

	expect(choice).toBe(1);
});

test("breaks ties toward the lowest move index", () => {
	let choice = chooseEnemyAction({
		moves: [
			move({ index: 0, power: 60 }),
			move({ index: 1, power: 60 }),
			move({ index: 2, power: 60 }),
		],
		defenderTypes: ["normal"],
		typeChart: TYPE_CHART,
	});

	expect(choice).toBe(0);
});

test("falls back to any usable move when no damaging move is available", () => {
	let choice = chooseEnemyAction({
		moves: [
			move({ index: 0, id: null, power: 0, pp: 0 }),
			move({ index: 1, power: 0, isStatus: true }),
			move({ index: 2, power: 0, isStatus: true }),
		],
		defenderTypes: ["normal"],
		typeChart: TYPE_CHART,
	});

	// Slot 0 is empty; the first usable (status) move is slot 1.
	expect(choice).toBe(1);
});

test("falls back to slot 0 when no move is usable at all", () => {
	let choice = chooseEnemyAction({
		moves: [
			move({ index: 0, pp: 0 }),
			move({ index: 1, pp: 0 }),
			move({ index: 2, id: null, pp: 0 }),
			move({ index: 3, disabled: true }),
		],
		defenderTypes: ["normal"],
		typeChart: TYPE_CHART,
	});

	expect(choice).toBe(0);
});
