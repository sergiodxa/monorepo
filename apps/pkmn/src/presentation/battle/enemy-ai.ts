/**
 * A small, deterministic move-selection AI for the opponent side.
 *
 * The battle engine ships no built-in AI, so this module picks the enemy's
 * move by highest expected damage (power weighted by type effectiveness),
 * falling back to any usable move, then slot 0, ties favor the lowest index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Matchup } from "~/game/data/type";

import { Effectiveness } from "~/game/data/type";

/** A move slot the enemy could commit this turn. */
export interface EnemyMoveOption {
	index: 0 | 1 | 2 | 3;
	/** The move id, or null when the slot is empty. */
	id: string | null;
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
	defenderTypes: readonly string[];
	/** The type chart used to weigh damage by effectiveness. */
	typeChart: Matchup<string>;
}

/**
 * Chooses the enemy's move slot for this turn: the highest expected damage
 * (power weighted by type effectiveness) among usable moves, tie-breaking to
 * the lowest index, falling back to any usable move then to slot 0.
 *
 * @param context - The enemy's move options and the current defender's typing.
 * @returns The move slot index the enemy should commit.
 */
export function chooseEnemyAction(context: EnemyActionContext): 0 | 1 | 2 | 3 {
	let usable = context.moves.filter(isUsable);
	if (usable.length === 0) return 0;

	let damaging = usable.filter((move) => move.isStatus === false && move.power > 0);
	if (damaging.length === 0) {
		return lowestIndex(usable).index;
	}

	let best = damaging[0]!;
	let bestScore = expectedDamage(best, context);
	for (let move of damaging.slice(1)) {
		let score = expectedDamage(move, context);
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
