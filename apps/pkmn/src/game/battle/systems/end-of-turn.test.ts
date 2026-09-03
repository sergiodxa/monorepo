import { unwrap } from "@sdxc/result";
/**
 * Verifies the end-of-turn residual pipeline's held-item passive heal using a
 * minimal battle state with one active combatant, wired with the same HP
 * helpers the engine uses at runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { ItemId } from "~/game/data/item";
import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { CombatantState } from "~/game/battle/combatant-state";
import { getCreatureStat } from "~/game/battle/mechanics";
import { createFieldEffectState, createSideEffectState } from "~/game/battle/state";
import { GameData } from "~/game/data/game-data";
import { Stat } from "~/game/data/stat";
import { Creature } from "~/game/world/creature";

import type { BattleState } from "../battle";

import type { EndOfTurnContext } from "./end-of-turn";

import { applyEndOfTurnEffects } from "./end-of-turn";

let GAME_DATA = unwrap(
	GameData.create({
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	}),
);

let PRIMARY_SPECIES_ID = getSpeciesId((species) => species.number === 1);

test("Leftovers restores floor(maxHP / 16) at the end of the turn", () => {
	let scenario = createEndOfTurnScenario("LEFTOVERS");
	let maxHP = getCreatureStat(GAME_DATA, scenario.combatant.creature, Stat.HP);
	scenario.combatant.creature.status.damage = maxHP - 1;

	let events = applyEndOfTurnEffects(scenario.context);

	let restored = Math.floor(maxHP / 16);
	expect(scenario.combatant.creature.status.damage).toBe(maxHP - 1 - restored);
	expect(events).toContainEqual({
		type: "damage-dealt",
		target: { side: 0, slot: 0 },
		damage: 0,
		remainingHP: maxHP - (maxHP - 1 - restored),
	});
});

/** One point of damage: a full 1/16 heal would overshoot, so it must clamp to 0. */
test("Leftovers never overheals past maximum HP", () => {
	let scenario = createEndOfTurnScenario("LEFTOVERS");
	scenario.combatant.creature.status.damage = 1;

	applyEndOfTurnEffects(scenario.context);

	expect(scenario.combatant.creature.status.damage).toBe(0);
});

test("Leftovers does nothing at full HP", () => {
	let scenario = createEndOfTurnScenario("LEFTOVERS");
	scenario.combatant.creature.status.damage = 0;

	let events = applyEndOfTurnEffects(scenario.context);

	expect(scenario.combatant.creature.status.damage).toBe(0);
	expect(events).toHaveLength(0);
});

/** A fainted wielder is at (or beyond) full damage and must not be revived. */
test("Leftovers does nothing when the wielder has fainted", () => {
	let scenario = createEndOfTurnScenario("LEFTOVERS");
	let maxHP = getCreatureStat(GAME_DATA, scenario.combatant.creature, Stat.HP);
	scenario.combatant.creature.status.damage = maxHP;

	let events = applyEndOfTurnEffects(scenario.context);

	expect(scenario.combatant.creature.status.damage).toBe(maxHP);
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 0, slot: 0 } });
	expect(events).not.toContainEqual(
		expect.objectContaining({ type: "damage-dealt", target: { side: 0, slot: 0 } }),
	);
});

test("A creature with no held item is unaffected at end of turn", () => {
	let scenario = createEndOfTurnScenario(null);
	let maxHP = getCreatureStat(GAME_DATA, scenario.combatant.creature, Stat.HP);
	scenario.combatant.creature.status.damage = maxHP - 1;

	let events = applyEndOfTurnEffects(scenario.context);

	expect(scenario.combatant.creature.status.damage).toBe(maxHP - 1);
	expect(events).toHaveLength(0);
});

/** CHARCOAL only boosts damage; it must not trigger the residual heal path. */
test("A held item without a heal fraction does not heal", () => {
	let scenario = createEndOfTurnScenario("CHARCOAL");
	let maxHP = getCreatureStat(GAME_DATA, scenario.combatant.creature, Stat.HP);
	scenario.combatant.creature.status.damage = maxHP - 1;

	let events = applyEndOfTurnEffects(scenario.context);

	expect(scenario.combatant.creature.status.damage).toBe(maxHP - 1);
	expect(events).toHaveLength(0);
});

function createEndOfTurnScenario(heldItemId: ItemId | null) {
	let combatant = new CombatantState(createCreature(PRIMARY_SPECIES_ID, heldItemId));
	let state = createBattleState(combatant);
	let context = createEndOfTurnContext(state);
	return { combatant, state, context };
}

function createEndOfTurnContext(state: BattleState): EndOfTurnContext {
	let getRemainingHP = (combatant: CombatantState) =>
		getCreatureStat(GAME_DATA, combatant.creature, Stat.HP) - combatant.creature.status.damage;
	let isCombatantFainted = (combatant: CombatantState) => getRemainingHP(combatant) <= 0;

	return {
		state,
		gameData: GAME_DATA,
		random: () => 0,
		flattenEffects: (effect) => [effect],
		findEffect: () => null,
		getActiveCombatant: (position) => state.sides[position.side]?.active[position.slot] ?? null,
		clearActiveCombatant: (position) => {
			let side = state.sides[position.side];
			if (side) side.active[position.slot] = null;
		},
		applyMoveDamage: () => 0,
		applyDamage: (combatant, position, damage, events) => {
			let maxHP = getCreatureStat(GAME_DATA, combatant.creature, Stat.HP);
			let next = Math.min(maxHP, combatant.creature.status.damage + damage);
			let dealt = next - combatant.creature.status.damage;
			combatant.creature.status.damage = next;
			if (dealt > 0) {
				events.push({
					type: "damage-dealt",
					target: position,
					damage: dealt,
					remainingHP: maxHP - next,
				});
			}
			return dealt;
		},
		healSeedSource: () => {},
		getRemainingHP,
		getTypeEffectiveness: () => 1,
		isGrounded: () => true,
		isCombatantFainted,
		reconcileSideState: () => [],
		updateWinnerSide: () => {},
	};
}

function createBattleState(combatant: CombatantState): BattleState {
	let activeSlot = { teamIndex: 0, creatureIndex: 0, combatant };
	return {
		turn: 1,
		phase: "resolving-turn",
		winnerSide: null,
		slots: 1,
		sides: [
			{
				canLeaveBattle: false,
				pendingHealingWishCount: 0,
				followMeUserSlot: null,
				slotTeams: [0],
				teams: [{ creatures: [combatant], eliminated: false }],
				active: [activeSlot],
				effects: createSideEffectState(),
			},
			{
				canLeaveBattle: false,
				pendingHealingWishCount: 0,
				followMeUserSlot: null,
				slotTeams: [0],
				teams: [],
				active: [null],
				effects: createSideEffectState(),
			},
		],
		field: createFieldEffectState(),
		delayedAttacks: [],
	};
}

function createCreature(speciesId: SpeciesId, heldItemId: ItemId | null) {
	return new Creature({
		species: speciesId,
		nature: "HARDY" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "GROWL", "TAIL_WHIP", "LEER"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: {
			state: null,
			damage: 0,
			pp: [35, 40, 30, 30],
		},
		heldItemId,
	});
}

function createPerfectStats() {
	return {
		[Stat.HP]: 31,
		[Stat.Attack]: 31,
		[Stat.Defense]: 31,
		[Stat.SpecialAttack]: 31,
		[Stat.SpecialDefense]: 31,
		[Stat.Speed]: 31,
	};
}

function getSpeciesId(
	predicate: (species: (typeof SPECIES)[keyof typeof SPECIES]) => boolean,
): SpeciesId {
	for (let [speciesId, species] of Object.entries(SPECIES)) {
		if (predicate(species)) return speciesId as SpeciesId;
	}

	throw new ReferenceError("Expected a species fixture matching the requested predicate.");
}
