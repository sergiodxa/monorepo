/**
 * Pure, content-agnostic helpers for level-up move learning: which moves a
 * learnset grants across a level range, and what a moveset becomes once a
 * move is learned. Purity lets the engine auto-learn or prompt through the
 * same logic, using opaque move ids and a fixed four-slot moveset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "../data/game-data";
import type { MoveId } from "../data/move";
import type { LearnsetEntry, LevelUpMove } from "../data/species";
import type { MoveSet } from "../world/creature";
import type { CreatureId } from "../world/ids";
import type { World } from "../world/world";

import { isLevelUpMove } from "../data/species";
import { getCreatureComponentSet } from "../world/world";

/** Highest number of moves a creature can hold at once. */
const MAX_MOVES = 4;

/**
 * Uses `(fromLevel, toLevel]` so a creature that just leveled up learns
 * exactly the moves newly reached; duplicate move ids across levels appear
 * once, and non-level-up entries (machine, tutor, egg) are ignored.
 */
export function movesLearnedBetween(
	learnset: LearnsetEntry[],
	fromLevel: number,
	toLevel: number,
): MoveId[] {
	let entries: LevelUpMove[] = learnset
		.filter(isLevelUpMove)
		.filter((entry) => entry.level > fromLevel && entry.level <= toLevel)
		.sort((a, b) => a.level - b.level);

	let seen = new Set<MoveId>();
	let moves: MoveId[] = [];
	for (let entry of entries) {
		if (seen.has(entry.moveId)) continue;
		seen.add(entry.moveId);
		moves.push(entry.moveId);
	}
	return moves;
}

/**
 * No-ops for an already-known move. Fills a free slot when one exists unless
 * `replaceSlotIndex` is given, in which case that slot is always honored; an
 * out-of-range index is treated as the player declining and returns unchanged.
 */
export function applyLearnedMove(
	moveset: MoveSet,
	moveId: MoveId,
	replaceSlotIndex?: number,
): MoveSet {
	if (moveset.includes(moveId)) return moveset;

	if (replaceSlotIndex !== undefined) {
		if (replaceSlotIndex < 0 || replaceSlotIndex >= MAX_MOVES) return moveset;
		let next = [...moveset] as MoveSet;
		next[replaceSlotIndex] = moveId;
		return next;
	}

	let freeSlot = moveset.findIndex((slot) => slot === null);
	if (freeSlot === -1) return moveset;

	let next = [...moveset] as MoveSet;
	next[freeSlot] = moveId;
	return next;
}

/** Returns whether a moveset has an empty slot a new move could auto-fill. */
export function hasFreeMoveSlot(moveset: MoveSet): boolean {
	return moveset.includes(null);
}

/** Outcome of writing a learned move back into the world. */
export interface LearnMoveResult {
	/** Whether the moveset actually changed. */
	learned: boolean;
	/** The slot the move landed in, when learned. */
	slotIndex: number;
	/** The move id previously in that slot, when one was replaced. */
	replacedMoveId?: MoveId;
}

/**
 * Delegates the slot decision to {@link applyLearnedMove} and, when a move is
 * learned, refreshes that slot's PP to the move's full value so it enters
 * battle ready to use.
 */
export function learnMove(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
	moveId: MoveId,
	replaceSlotIndex?: number,
): LearnMoveResult {
	let components = getCreatureComponentSet(world, creatureId);
	let before = components.moves.moveset;
	let after = applyLearnedMove(before, moveId, replaceSlotIndex);
	if (after === before) return { learned: false, slotIndex: -1 };

	let slotIndex = after.findIndex((slot, index) => slot !== before[index]);
	if (slotIndex === -1) return { learned: false, slotIndex: -1 };

	let replaced = before[slotIndex];
	let pp = [...components.moves.pp] as [number, number, number, number];
	pp[slotIndex] = gameData.moves.get(moveId)?.pp ?? 0;

	world.creatureMoves[creatureId] = { moveset: after, pp };

	return {
		learned: true,
		slotIndex,
		replacedMoveId: replaced ?? undefined,
	};
}
