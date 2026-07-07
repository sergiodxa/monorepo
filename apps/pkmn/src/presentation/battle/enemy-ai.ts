/**
 * A small, deterministic move-selection AI for the opponent side.
 *
 * The battle engine ships no built-in AI, so the scene must choose the enemy's
 * move itself. This module keeps that choice pure and side-effect free: it takes
 * the enemy's candidate move slots plus the defender's types and type chart, and
 * returns the slot index to use. It prefers the highest expected damage —
 * base power weighted by type effectiveness against the defender — and, when no
 * damaging move is usable, falls back to any usable move, then to slot 0 so the
 * engine's own struggle fallback can take over. Ties always break toward the
 * lowest move index, so the same inputs always yield the same choice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Matchup } from "~/game/data/type";

import { Effectiveness } from "~/game/data/type";

/** A move slot the enemy could commit this turn. */
export interface EnemyMoveOption {
	/** The move slot index (0-3). */
	index: 0 | 1 | 2 | 3;
	/** The move id, or null when the slot is empty. */
	id: string | null;
	/** Remaining PP for the slot. */
	pp: number;
	/** Base power of the move (0 for status moves). */
	power: number;
	/** Elemental type of the move, used for the effectiveness weighting. */
	type: string;
	/** Whether this move deals no direct damage (status class). */
	isStatus: boolean;
	/** Whether the slot is currently unusable for a reason other than PP (e.g. disabled). */
	disabled?: boolean;
}

/** Inputs the enemy AI needs to weigh its options against the current defender. */
export interface EnemyActionContext {
	/** The enemy's four move slots, in order. */
	moves: EnemyMoveOption[];
	/** The defender's elemental types. */
	defenderTypes: readonly string[];
	/** The type chart used to weigh damage by effectiveness. */
	typeChart: Matchup<string>;
}

/**
 * Chooses the enemy's move slot for this turn.
 *
 * Among usable moves (has PP and not disabled), it prefers the highest expected
 * damage — `power * effectiveness` against the defender — breaking ties by the
 * lowest slot index. If no damaging move is usable it uses any usable move; if
 * none are usable at all it returns slot 0 so the engine's fallback move resolves.
 *
 * @param context - The enemy's move options and the current defender's typing.
 * @returns The move slot index the enemy should commit.
 */
export function chooseEnemyAction(context: EnemyActionContext): 0 | 1 | 2 | 3 {
	let usable = context.moves.filter(isUsable);
	if (usable.length === 0) return 0;

	let damaging = usable.filter((move) => move.isStatus === false && move.power > 0);
	if (damaging.length === 0) {
		// No damaging option: fall back to the first usable (lowest-index) move.
		return lowestIndex(usable).index;
	}

	let best = damaging[0]!;
	let bestScore = expectedDamage(best, context);
	for (let move of damaging.slice(1)) {
		let score = expectedDamage(move, context);
		// Strictly greater keeps the earliest (lowest-index) move on a tie.
		if (score > bestScore) {
			best = move;
			bestScore = score;
		}
	}

	return best.index;
}

/** Whether a move slot can be committed this turn (has a move, has PP, not disabled). */
function isUsable(move: EnemyMoveOption): boolean {
	return move.id !== null && move.pp > 0 && move.disabled !== true;
}

/** The lowest-index move in a non-empty list. */
function lowestIndex(moves: EnemyMoveOption[]): EnemyMoveOption {
	return moves.reduce((best, move) => (move.index < best.index ? move : best));
}

/** Estimates a move's damage as base power scaled by type effectiveness on the defender. */
function expectedDamage(move: EnemyMoveOption, context: EnemyActionContext): number {
	return move.power * effectivenessAgainst(move.type, context.defenderTypes, context.typeChart);
}

/** Multiplies the per-type effectiveness of an attacking type against every defender type. */
function effectivenessAgainst(
	attackingType: string,
	defenderTypes: readonly string[],
	typeChart: Matchup<string>,
): number {
	let matchups = typeChart[attackingType] ?? {};
	return defenderTypes.reduce((factor, defenderType) => {
		let matchup = matchups[defenderType];
		return matchup === undefined ? factor : factor * matchup;
	}, Number(Effectiveness.NORMAL));
}
