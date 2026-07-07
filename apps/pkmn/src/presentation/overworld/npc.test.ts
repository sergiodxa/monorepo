/**
 * Tests for the overworld NPC tile geometry.
 *
 * Covers the two pure lookups the scene relies on: which NPC occupies a tile
 * (used to block movement) and which NPC the player is standing adjacent to and
 * facing (used to resolve an interaction target). Rendering is not tested here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { facingNpc, type Npc, npcAt } from "./npc";

let npcs: Npc[] = [
	{ id: "healer", x: 7, y: 5, role: "healer", label: "H" },
	{ id: "shop", x: 7, y: 7, role: "shop", label: "$" },
	{
		id: "trainer",
		x: 5,
		y: 3,
		role: "trainer",
		label: "T",
		trainer: { name: "Rival", party: [{ speciesId: "X", level: 5 }], reward: 500 },
	},
];

test("npcAt returns the NPC standing on a tile", () => {
	expect(npcAt(npcs, 7, 5)?.id).toBe("healer");
	expect(npcAt(npcs, 5, 3)?.id).toBe("trainer");
});

test("npcAt returns null for a free tile", () => {
	expect(npcAt(npcs, 5, 5)).toBeNull();
});

test("facingNpc finds the NPC one tile ahead in the facing direction", () => {
	// Standing left of the healer (7,5) and facing right into it.
	expect(facingNpc(npcs, { x: 6, y: 5, facing: "right" })?.id).toBe("healer");
	// Standing above the trainer (5,3) and facing down into it.
	expect(facingNpc(npcs, { x: 5, y: 2, facing: "down" })?.id).toBe("trainer");
});

test("facingNpc returns null when adjacent but facing away", () => {
	expect(facingNpc(npcs, { x: 6, y: 5, facing: "left" })).toBeNull();
	expect(facingNpc(npcs, { x: 6, y: 5, facing: "up" })).toBeNull();
});

test("facingNpc returns null when facing an NPC but not adjacent", () => {
	// Two tiles left of the healer: the tile ahead is empty, not the NPC.
	expect(facingNpc(npcs, { x: 5, y: 5, facing: "right" })).toBeNull();
});
