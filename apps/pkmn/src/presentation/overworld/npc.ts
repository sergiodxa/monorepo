/**
 * Interactable overworld NPCs and the pure geometry of talking to them.
 *
 * The overworld ships with a few fixed characters — a healer, a shop, and a
 * trainer — placed on walkable tiles near the spawn. This module owns their
 * typed data and the tile math the scene needs (which NPC sits on a tile, and
 * which one the player is standing next to and facing), keeping that decision
 * logic out of the renderer so it can be unit-tested without a canvas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { type Direction, directionDelta } from "../core/direction";

/** What an overworld NPC does when the player interacts with it. */
export type NpcRole = "healer" | "shop" | "trainer";

/** The creature a trainer NPC fields, spawned fresh for each battle. */
export interface TrainerData {
	/** The species the trainer's sole creature is spawned from. */
	speciesId: string;
	/** The level the trainer's creature is spawned at. */
	level: number;
}

/** A fixed, interactable character standing on one overworld tile. */
export interface Npc {
	/** Stable identifier, unique within a map. */
	id: string;
	/** Tile column the NPC occupies. */
	x: number;
	/** Tile row the NPC occupies. */
	y: number;
	/** Which behavior fires on interaction. */
	role: NpcRole;
	/** Short label drawn over the sprite so the roles read at a glance. */
	label: string;
	/** Trainer-only battle data; absent for the healer and shop. */
	trainer?: TrainerData;
}

/**
 * Returns the NPC occupying a tile, or null when the tile is free.
 *
 * Used both to block movement onto an NPC and to resolve interaction targets,
 * so it compares tile coordinates only and ignores role.
 */
export function npcAt(npcs: readonly Npc[], x: number, y: number): Npc | null {
	for (let npc of npcs) if (npc.x === x && npc.y === y) return npc;
	return null;
}

/**
 * Returns the NPC the player is positioned to interact with, or null.
 *
 * Interaction requires the player to stand on the tile directly adjacent to the
 * NPC and face toward it, matching how talking works in the source games: the
 * tile one step ahead of the player, in their facing direction, must hold an
 * NPC.
 */
export function facingNpc(
	npcs: readonly Npc[],
	player: { x: number; y: number; facing: Direction },
): Npc | null {
	let delta = directionDelta(player.facing);
	return npcAt(npcs, player.x + delta.dx, player.y + delta.dy);
}
