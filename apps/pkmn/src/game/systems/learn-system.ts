/**
 * Pure helpers for level-up move learning in the game systems layer.
 *
 * This module answers two content-agnostic questions without touching world
 * state: which moves a learnset grants across a level range, and what a moveset
 * becomes once a chosen move is learned into it. Keeping the rules pure lets the
 * engine decide when to auto-learn versus prompt, and lets the presentation apply
 * a player's replace/skip choice through the same logic the engine uses.
 *
 * The helpers work in terms of opaque move identifier strings and a fixed
 * four-slot moveset, so no franchise-specific move knowledge lives here.
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
 * Returns the level-up move ids a learnset grants across `(fromLevel, toLevel]`.
 *
 * Only levels strictly above `fromLevel` and at most `toLevel` count, so a
 * creature that just crossed from one level to the next learns exactly the moves
 * pinned to the newly reached level(s). Entries are returned in ascending level
 * order (ties keep authoring order), and a move id repeated across levels appears
 * only once. Non level-up entries (machine, tutor, egg) are ignored.
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
 * Returns the moveset that results from learning `moveId`, or the unchanged
 * moveset when the move cannot or should not be learned.
 *
 * The move is a no-op when it is already known (no relearning). With fewer than
 * four moves and no `replaceSlotIndex`, it is appended to the first free slot.
 * When the moveset is full, `replaceSlotIndex` names the slot to overwrite; an
 * out-of-range or negative index is treated as the player declining, so the
 * moveset is returned unchanged. Passing a valid `replaceSlotIndex` while a free
 * slot exists still honors the requested slot.
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
 * Applies a learned move to one creature's stored moveset and refreshes its PP.
 *
 * Delegates the slot decision to {@link applyLearnedMove}: appends into a free
 * slot when one exists, overwrites `replaceSlotIndex` when full, and leaves the
 * moveset untouched for an already-known move or a declined (out-of-range) slot.
 * When a move is learned, the affected slot's PP is set to that move's full PP so
 * the new move enters battle ready to use. Reports whether anything changed, the
 * slot used, and the move it displaced.
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
