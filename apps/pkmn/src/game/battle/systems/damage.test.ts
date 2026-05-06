/**
 * Verifies direct damage-system behavior under controlled battle state so crit-specific
 * stat overrides can be covered without depending on unrelated full-battle sequencing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import type { BattleEvent, BattleState } from "~/game/battle/battle";
import type { Move, MoveEffect, MoveId } from "~/game/data/move";
import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { CombatantState } from "~/game/battle/combatant-state";
import { createFieldEffectState, createSideEffectState } from "~/game/battle/state";
import { GameData } from "~/game/data/game-data";
import { Stat } from "~/game/data/stat";
import { Effectiveness } from "~/game/data/type";
import { Creature, State } from "~/game/world/creature";

import { getResolvedMoveDamage } from "./damage";

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
let SECONDARY_SPECIES_ID = getSpeciesId((species) => species.number === 2);

test("Critical hits ignore negative attacker stages during direct damage", () => {
	let neutral = createDamageScenario();
	let lowered = createDamageScenario();
	lowered.user.statStages[Stat.Attack] = -6;

	expect(resolveCriticalDamage(neutral)).toBe(resolveCriticalDamage(lowered));
});

test("Critical hits ignore positive defender stages during direct damage", () => {
	let neutral = createDamageScenario();
	let boosted = createDamageScenario();
	boosted.target.statStages[Stat.Defense] = 6;

	expect(resolveCriticalDamage(neutral)).toBe(resolveCriticalDamage(boosted));
});

test("Direct damage scales across the full effectiveness result set", () => {
	let neutral = createDamageScenario();
	let quarter = createDamageScenario();
	let hyper = createDamageScenario();

	let neutralDamage = resolveDamageWithEffectiveness(neutral, Effectiveness.NORMAL);
	let quarterDamage = resolveDamageWithEffectiveness(quarter, Effectiveness.QUARTER);
	let hyperDamage = resolveDamageWithEffectiveness(hyper, Effectiveness.HYPER);

	expect(quarter.events).toContainEqual({
		type: "effectiveness",
		target: { side: 1, slot: 0 },
		effectiveness: Effectiveness.QUARTER,
	});
	expect(hyper.events).toContainEqual({
		type: "effectiveness",
		target: { side: 1, slot: 0 },
		effectiveness: Effectiveness.HYPER,
	});
	expect(quarterDamage).toBe(Math.floor(neutralDamage * Effectiveness.QUARTER));
	expect(hyperDamage).toBe(neutralDamage * Effectiveness.HYPER);
});

test("Burn halves physical direct damage", () => {
	let neutral = createDamageScenario();
	let burned = createDamageScenario();
	burned.user.creature.status.state = State.Burned;

	let neutralDamage = resolveDirectDamage(neutral);
	let burnedDamage = resolveDirectDamage(burned);

	expect(burnedDamage).toBe(Math.floor(neutralDamage * 0.5));
});

test("Burn does not reduce special direct damage", () => {
	let neutral = createDamageScenario("EMBER");
	let burned = createDamageScenario("EMBER");
	burned.user.creature.status.state = State.Burned;

	expect(resolveDirectDamage(burned)).toBe(resolveDirectDamage(neutral));
});

test("Electric Terrain boosts electric damage only for grounded attackers", () => {
	let grounded = createDamageScenario("THUNDERBOLT");
	let airborne = createDamageScenario("THUNDERBOLT");
	airborne.user.volatile.invulnerable = true;
	grounded.state.field.terrain = "electric";
	grounded.state.field.terrainTurns = 5;
	airborne.state.field.terrain = "electric";
	airborne.state.field.terrainTurns = 5;

	let groundedDamage = resolveDirectDamage(grounded);
	let airborneDamage = resolveDirectDamage(airborne);
	let neutralDamage = resolveDirectDamage(createDamageScenario("THUNDERBOLT"));

	expect(groundedDamage).toBe(Math.floor(neutralDamage * 1.3));
	expect(airborneDamage).toBe(neutralDamage);
});

test("Misty Terrain reduces dragon damage only against grounded targets", () => {
	let grounded = createDamageScenario("DRAGON_CLAW");
	let airborne = createDamageScenario("DRAGON_CLAW");
	airborne.target.volatile.invulnerable = true;
	grounded.state.field.terrain = "misty";
	grounded.state.field.terrainTurns = 5;
	airborne.state.field.terrain = "misty";
	airborne.state.field.terrainTurns = 5;

	let groundedDamage = resolveDirectDamage(grounded);
	let airborneDamage = resolveDirectDamage(airborne);
	let neutralDamage = resolveDirectDamage(createDamageScenario("DRAGON_CLAW"));

	expect(groundedDamage).toBe(Math.floor(neutralDamage * 0.5));
	expect(airborneDamage).toBe(neutralDamage);
});

function createDamageScenario(
	moveId: MoveId = "TACKLE",
	userSpeciesId = PRIMARY_SPECIES_ID,
	targetSpeciesId = SECONDARY_SPECIES_ID,
) {
	let user = new CombatantState(createCreature(userSpeciesId, 255));
	let target = new CombatantState(createCreature(targetSpeciesId));
	let state = createBattleState();
	let events: BattleEvent[] = [];
	let move = GAME_DATA.moves.get(moveId);
	if (!move) throw new ReferenceError(`Expected ${moveId} move data.`);

	return { user, target, state, events, move };
}

function resolveCriticalDamage(scenario: ReturnType<typeof createDamageScenario>) {
	return getResolvedMoveDamage(
		{
			state: scenario.state,
			gameData: GAME_DATA,
			random: createRandomSequence(0, 1),
			isGrounded: (combatant) => isGrounded(combatant),
			findEffect: <TKind extends MoveEffect["kind"]>(
				effects: MoveEffect[],
				kind: TKind,
			): Extract<MoveEffect, { kind: TKind }> | null => {
				for (let effect of effects) {
					if (effect.kind === kind) return effect as Extract<MoveEffect, { kind: TKind }>;
				}

				return null;
			},
			flattenEffects: (effect: MoveEffect) => [effect],
			getRemainingHP: () => 100,
			getTypeEffectiveness: () => 1,
			getCombatantSide: (combatant) => (combatant === scenario.target ? 1 : 0),
			getCombatantPosition: (combatant) =>
				combatant === scenario.target ? { side: 1, slot: 0 } : { side: 0, slot: 0 },
			getCombatantSpeed: () => 100,
			getStageModifier: (stage) => {
				if (stage >= 0) return (2 + stage) / 2;
				return 2 / (2 + Math.abs(stage));
			},
			getCriticalHitChance: () => 1,
			getStabModifier: () => 1,
		},
		scenario.user,
		scenario.target,
		{ side: 1, slot: 0 },
		scenario.move,
		flattenMoveEffects(scenario.move),
		scenario.events,
	);
}

function resolveDamageWithEffectiveness(
	scenario: ReturnType<typeof createDamageScenario>,
	effectiveness: Effectiveness,
) {
	return getResolvedMoveDamage(
		{
			state: scenario.state,
			gameData: GAME_DATA,
			random: createRandomSequence(0, 0.9375),
			isGrounded: (combatant) => isGrounded(combatant),
			findEffect: <TKind extends MoveEffect["kind"]>(
				effects: MoveEffect[],
				kind: TKind,
			): Extract<MoveEffect, { kind: TKind }> | null => {
				for (let effect of effects) {
					if (effect.kind === kind) return effect as Extract<MoveEffect, { kind: TKind }>;
				}

				return null;
			},
			flattenEffects: (effect: MoveEffect) => [effect],
			getRemainingHP: () => 100,
			getTypeEffectiveness: () => effectiveness,
			getCombatantSide: (combatant) => (combatant === scenario.target ? 1 : 0),
			getCombatantPosition: (combatant) =>
				combatant === scenario.target ? { side: 1, slot: 0 } : { side: 0, slot: 0 },
			getCombatantSpeed: () => 100,
			getStageModifier: (stage) => {
				if (stage >= 0) return (2 + stage) / 2;
				return 2 / (2 + Math.abs(stage));
			},
			getCriticalHitChance: () => 0,
			getStabModifier: () => 1,
		},
		scenario.user,
		scenario.target,
		{ side: 1, slot: 0 },
		scenario.move,
		flattenMoveEffects(scenario.move),
		scenario.events,
	);
}

function resolveDirectDamage(scenario: ReturnType<typeof createDamageScenario>) {
	return getResolvedMoveDamage(
		{
			state: scenario.state,
			gameData: GAME_DATA,
			random: () => 1,
			isGrounded: (combatant) => isGrounded(combatant),
			findEffect: <TKind extends MoveEffect["kind"]>(
				effects: MoveEffect[],
				kind: TKind,
			): Extract<MoveEffect, { kind: TKind }> | null => {
				for (let effect of effects) {
					if (effect.kind === kind) return effect as Extract<MoveEffect, { kind: TKind }>;
				}

				return null;
			},
			flattenEffects: (effect: MoveEffect) => [effect],
			getRemainingHP: () => 100,
			getTypeEffectiveness: () => 1,
			getCombatantSide: (combatant) => (combatant === scenario.target ? 1 : 0),
			getCombatantPosition: (combatant) =>
				combatant === scenario.target ? { side: 1, slot: 0 } : { side: 0, slot: 0 },
			getCombatantSpeed: () => 100,
			getStageModifier: (stage) => {
				if (stage >= 0) return (2 + stage) / 2;
				return 2 / (2 + Math.abs(stage));
			},
			getCriticalHitChance: () => 0,
			getStabModifier: () => 1,
		},
		scenario.user,
		scenario.target,
		{ side: 1, slot: 0 },
		scenario.move,
		flattenMoveEffects(scenario.move),
		scenario.events,
	);
}

function createBattleState(): BattleState {
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
				teams: [],
				active: [],
				effects: createSideEffectState(),
			},
			{
				canLeaveBattle: false,
				pendingHealingWishCount: 0,
				followMeUserSlot: null,
				slotTeams: [0],
				teams: [],
				active: [],
				effects: createSideEffectState(),
			},
		],
		field: createFieldEffectState(),
		delayedAttacks: [],
	};
}

function createCreature(speciesId: SpeciesId, attackEv = 0) {
	return new Creature({
		species: speciesId,
		nature: "HARDY" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "GROWL", "TAIL_WHIP", "LEER"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: attackEv,
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

function flattenMoveEffects(move: Move): MoveEffect[] {
	let effects: MoveEffect[] = [];
	let queue = [move.effect];

	while (queue.length > 0) {
		let effect = queue.shift();
		if (!effect) continue;
		if (effect.kind === "compound") {
			queue.unshift(...effect.effects);
			continue;
		}

		effects.push(effect);
	}

	return effects;
}

function isGrounded(combatant: CombatantState): boolean {
	if (combatant.volatile.invulnerable) return false;
	let species = GAME_DATA.species.get(combatant.creature.speciesId);
	if (!species) throw new ReferenceError(`Species ${combatant.creature.speciesId} not found.`);
	return species.types.includes("flying") === false;
}

function createRandomSequence(...values: number[]) {
	let index = 0;
	return () => {
		let value = values[index] ?? values.at(-1) ?? 0;
		index += 1;
		return value;
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
