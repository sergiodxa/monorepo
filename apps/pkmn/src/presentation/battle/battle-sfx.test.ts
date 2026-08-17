/**
 * Tests for the pure battle-event and engine-event sound-effect mappings.
 *
 * Covers `sfxForBattleEvent` (a damaging hit → `hit`, a faint → `faint`, a
 * healing/reviving item → `heal`, and every silent case → null) and
 * `sfxForGameEvent` (a level-crossing experience grant → `level-up`, otherwise
 * null). Both are pure lookups, so the tests build plain event literals and
 * assert the returned name with no audio context involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { BattleEvent, BattlePosition } from "~/game/battle/battle";
import type { GameEvent } from "~/game/events";

import { State } from "~/game/data/status";

import { sfxForBattleEvent, sfxForGameEvent } from "./battle-sfx";

let USER: BattlePosition = { side: 0, slot: 0 };
let TARGET: BattlePosition = { side: 1, slot: 0 };

test("a damaging damage-dealt maps to hit", () => {
	let event: BattleEvent = { type: "damage-dealt", target: TARGET, damage: 12, remainingHP: 30 };
	expect(sfxForBattleEvent(event)).toBe("hit");
});

test("a zero-damage damage-dealt is silent", () => {
	let event: BattleEvent = { type: "damage-dealt", target: TARGET, damage: 0, remainingHP: 30 };
	expect(sfxForBattleEvent(event)).toBeNull();
});

test("a creature-fainted maps to faint", () => {
	expect(sfxForBattleEvent({ type: "creature-fainted", target: TARGET })).toBe("faint");
});

test("an item-used that healed maps to heal", () => {
	let event: BattleEvent = {
		type: "item-used",
		user: USER,
		itemId: "potion",
		side: 0,
		team: 0,
		creature: 0,
		remainingHP: 40,
		healed: 20,
		status: null,
		revived: false,
	};
	expect(sfxForBattleEvent(event)).toBe("heal");
});

test("an item-used that revived (but healed 0) maps to heal", () => {
	let event: BattleEvent = {
		type: "item-used",
		user: USER,
		itemId: "revive",
		side: 0,
		team: 0,
		creature: 0,
		remainingHP: 20,
		healed: 0,
		status: null,
		revived: true,
	};
	expect(sfxForBattleEvent(event)).toBe("heal");
});

test("a pure status-cure item (no heal, no revive) is silent", () => {
	let event: BattleEvent = {
		type: "item-used",
		user: USER,
		itemId: "antidote",
		side: 0,
		team: 0,
		creature: 0,
		remainingHP: 40,
		healed: 0,
		status: null,
		revived: false,
	};
	expect(sfxForBattleEvent(event)).toBeNull();
});

test("unrelated battle events map to null", () => {
	let events: BattleEvent[] = [
		{ type: "battle-started" },
		{ type: "turn-started", turn: 1 },
		{ type: "move-used", user: USER, moveId: "tackle", target: TARGET },
		{ type: "critical-hit", target: TARGET },
		{ type: "move-missed", user: USER, target: TARGET },
		{ type: "status-applied", target: TARGET, status: State.Poisoned },
		{ type: "creature-switched", target: TARGET, creature: 1 },
		{ type: "turn-ended", turn: 1 },
		{ type: "battle-finished", winnerSide: 0 },
	];
	for (let event of events) expect(sfxForBattleEvent(event)).toBeNull();
});

test("a level-crossing experience grant maps to level-up", () => {
	let event: GameEvent = {
		type: "creature-experience-granted",
		creatureId: "c1",
		levelBefore: 4,
		levelAfter: 5,
		totalExperience: 200,
	};
	expect(sfxForGameEvent(event)).toBe("level-up");
});

test("an experience grant that did not cross a level is silent", () => {
	let event: GameEvent = {
		type: "creature-experience-granted",
		creatureId: "c1",
		levelBefore: 5,
		levelAfter: 5,
		totalExperience: 260,
	};
	expect(sfxForGameEvent(event)).toBeNull();
});

test("unrelated engine events map to null", () => {
	let events: GameEvent[] = [
		{ type: "money-changed", playerId: "p1", amount: 100 },
		{ type: "battle-finished", battleId: "b1", winnerSide: 0 },
	];
	for (let event of events) expect(sfxForGameEvent(event)).toBeNull();
});
