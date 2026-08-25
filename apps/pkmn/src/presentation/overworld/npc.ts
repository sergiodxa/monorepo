/**
 * Interactable overworld NPCs and the pure geometry of talking to them.
 *
 * Owns the fixed healer, shop, and trainer characters and the tile math for
 * who occupies a tile and who the player faces, kept separate from the
 * renderer so it can be unit-tested without a canvas.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { type Direction, directionDelta } from "../core/direction";

/** What an overworld NPC does when the player interacts with it. */
export type NpcRole = "healer" | "shop" | "trainer";

/** One creature slot in a trainer's party, spawned fresh for each battle. */
export interface TrainerPartyMember {
	speciesId: string;
	level: number;
}

/** The party a trainer NPC fields, spawned fresh for each battle. */
export interface TrainerData {
	/** Optional display name shown in trainer intro/defeat lines. */
	name?: string;
	/** The ordered creatures the trainer sends out, at least one. */
	party: TrainerPartyMember[];
	/** Money credited on a win and debited on a loss; a default applies when omitted. */
	reward?: number;
}

/** A fixed, interactable character standing on one overworld tile. */
export interface Npc {
	/** Stable identifier, unique within a map. */
	id: string;
	x: number;
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
 * Requires the player to stand adjacent to the NPC and face toward it: the
 * tile one step ahead in the facing direction must hold the NPC.
 */
export function facingNpc(
	npcs: readonly Npc[],
	player: { x: number; y: number; facing: Direction },
): Npc | null {
	let delta = directionDelta(player.facing);
	return npcAt(npcs, player.x + delta.dx, player.y + delta.dy);
}
