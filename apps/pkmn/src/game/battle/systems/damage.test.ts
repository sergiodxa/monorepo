/**
 * Verifies direct damage-system behavior under controlled battle state so crit-specific
 * stat overrides can be covered without depending on unrelated full-battle sequencing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@pkg/result";
import { expect, test } from "vitest";

import type { BattleEvent, BattleState } from "~/game/battle/battle";
import type { ItemId } from "~/game/data/item";
import type { Move, MoveEffect, MoveId } from "~/game/data/move";
import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { CombatantState } from "~/game/battle/combatant-state";
import { getCreatureLevel } from "~/game/battle/mechanics";
import { createFieldEffectState, createSideEffectState } from "~/game/battle/state";
import { GameData } from "~/game/data/game-data";
import { DamageClass } from "~/game/data/move";
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

test("Screens and weather stack instead of only the first modifier applying", () => {
	let base = createDamageScenario("EMBER");
	let screenOnly = createDamageScenario("EMBER");
	let weatherOnly = createDamageScenario("EMBER");
	let both = createDamageScenario("EMBER");

	screenOnly.state.sides[1]!.effects.lightScreenTurns = 5;

	weatherOnly.state.field.weather = "sun";
	weatherOnly.state.field.weatherTurns = 5;

	both.state.sides[1]!.effects.lightScreenTurns = 5;
	both.state.field.weather = "sun";
	both.state.field.weatherTurns = 5;

	let baseDamage = resolveDirectDamage(base);
	let screenDamage = resolveDirectDamage(screenOnly);
	let weatherDamage = resolveDirectDamage(weatherOnly);
	let bothDamage = resolveDirectDamage(both);

	expect(screenDamage).toBe(Math.floor(Math.floor(baseDamage * 0.5)));
	expect(weatherDamage).toBe(Math.floor(baseDamage * 1.5));

	expect(bothDamage).toBe(Math.floor(Math.floor(baseDamage * 0.5) * 1.5));
	expect(bothDamage).not.toBe(screenDamage);
	expect(bothDamage).not.toBe(weatherDamage);
});

test("Critical hits are not reduced by screens", () => {
	let withoutScreen = createDamageScenario();
	let withScreen = createDamageScenario();

	withScreen.state.sides[1]!.effects.reflectTurns = 5;

	expect(resolveCriticalDamage(withScreen)).toBe(resolveCriticalDamage(withoutScreen));
});

test("Level-based fixed damage deals exactly the user's level", () => {
	let scenario = createDamageScenario("NIGHT_SHADE");
	let level = getCreatureLevel(GAME_DATA, scenario.user.creature);

	expect(resolveFixedDamage(scenario)).toBe(level);
});

test("Level-based fixed damage ignores the defender's defensive stats and stages", () => {
	let neutral = createDamageScenario("SEISMIC_TOSS");
	let bulky = createDamageScenario("SEISMIC_TOSS");
	bulky.target.statStages[Stat.Defense] = 6;
	bulky.target.statStages[Stat.SpecialDefense] = 6;

	let level = getCreatureLevel(GAME_DATA, neutral.user.creature);
	expect(resolveFixedDamage(neutral)).toBe(level);
	expect(resolveFixedDamage(bulky)).toBe(level);
});

test("Level-based fixed damage is zeroed by type immunity", () => {
	let scenario = createDamageScenario("SEISMIC_TOSS");
	expect(resolveFixedDamage(scenario, Effectiveness.ZERO)).toBe(0);
});

test("Half-target-HP damage removes half the target's current HP", () => {
	let scenario = createDamageScenario("SUPER_FANG");
	expect(resolveFixedDamage(scenario)).toBe(50);
});

test("Half-target-HP damage floors and never drops below 1", () => {
	let scenario = createDamageScenario("SUPER_FANG");
	expect(resolveFixedDamage(scenario, Effectiveness.NORMAL, 1)).toBe(1);
	expect(resolveFixedDamage(scenario, Effectiveness.NORMAL, 3)).toBe(1);
	expect(resolveFixedDamage(scenario, Effectiveness.NORMAL, 5)).toBe(2);
});

test("Special counter returns double the special damage taken from the target", () => {
	let scenario = createDamageScenario("MIRROR_COAT");
	scenario.user.volatile.lastDamageThisTurn = {
		amount: 40,
		source: { side: 1, slot: 0 },
		moveClass: DamageClass.Special,
	};

	expect(resolveFixedDamage(scenario)).toBe(80);
});

test("Special counter ignores physical damage taken", () => {
	let scenario = createDamageScenario("MIRROR_COAT");
	scenario.user.volatile.lastDamageThisTurn = {
		amount: 40,
		source: { side: 1, slot: 0 },
		moveClass: DamageClass.Physical,
	};

	expect(resolveFixedDamage(scenario)).toBe(0);
});

test("Any-category counter returns 1.5x the last damage taken, flooring", () => {
	let scenario = createDamageScenario("METAL_BURST");
	scenario.user.volatile.lastDamageThisTurn = {
		amount: 41,
		source: { side: 1, slot: 0 },
		moveClass: DamageClass.Physical,
	};

	expect(resolveFixedDamage(scenario)).toBe(61);
});

test("Counter reflects nothing when no damage was taken this turn", () => {
	let mirrorCoat = createDamageScenario("MIRROR_COAT");
	let metalBurst = createDamageScenario("METAL_BURST");

	expect(resolveFixedDamage(mirrorCoat)).toBe(0);
	expect(resolveFixedDamage(metalBurst)).toBe(0);
});

test("Counter reflects nothing when the last hit came from another slot", () => {
	let scenario = createDamageScenario("METAL_BURST");
	scenario.user.volatile.lastDamageThisTurn = {
		amount: 40,
		source: { side: 1, slot: 1 },
		moveClass: DamageClass.Physical,
	};

	expect(resolveFixedDamage(scenario)).toBe(0);
});

test("A type-boost held item multiplies matching-type damage", () => {
	let plain = createDamageScenario("EMBER");
	let boosted = createDamageScenario("EMBER", PRIMARY_SPECIES_ID, SECONDARY_SPECIES_ID, "CHARCOAL");

	let plainDamage = resolveBoostDamage(plain);
	let boostedDamage = resolveBoostDamage(boosted);

	expect(boostedDamage).toBe(Math.floor(plainDamage * 1.1));
	expect(boostedDamage).toBeGreaterThan(plainDamage);
});

test("A type-boost held item leaves non-matching-type damage untouched", () => {
	let plain = createDamageScenario("TACKLE");
	let boosted = createDamageScenario(
		"TACKLE",
		PRIMARY_SPECIES_ID,
		SECONDARY_SPECIES_ID,
		"CHARCOAL",
	);

	expect(resolveBoostDamage(boosted)).toBe(resolveBoostDamage(plain));
});

test("A creature with no held item deals unmodified damage", () => {
	let withItem = createDamageScenario(
		"EMBER",
		PRIMARY_SPECIES_ID,
		SECONDARY_SPECIES_ID,
		"CHARCOAL",
	);
	let withoutItem = createDamageScenario("EMBER");

	expect(resolveBoostDamage(withoutItem)).toBeLessThan(resolveBoostDamage(withItem));
	expect(withoutItem.user.creature.heldItemId).toBe(null);
});

test("Held-item-power damage scales with the thrown item's fling power", () => {
	let heavy = createDamageScenario("FLING", PRIMARY_SPECIES_ID, SECONDARY_SPECIES_ID, "IRONBALL");
	let light = createDamageScenario("FLING", PRIMARY_SPECIES_ID, SECONDARY_SPECIES_ID, "CHARCOAL");

	let heavyDamage = resolveFlingDamage(heavy);
	let lightDamage = resolveFlingDamage(light);

	expect(heavyDamage).toBeGreaterThan(0);
	expect(lightDamage).toBeGreaterThan(0);
	expect(heavyDamage).toBeGreaterThan(lightDamage);
});

test("Held-item-power damage matches a normal hit at the item's fling power", () => {
	let fling = createDamageScenario("FLING", PRIMARY_SPECIES_ID, SECONDARY_SPECIES_ID, "IRONBALL");
	let reference = createDamageScenario(
		"FLING",
		PRIMARY_SPECIES_ID,
		SECONDARY_SPECIES_ID,
		"IRONBALL",
	);
	reference.move = { ...reference.move, power: 130, effect: { kind: "none" } };

	expect(resolveFlingDamage(fling)).toBe(resolveFlingDamage(reference));
});

test("Held-item-power damage does nothing when the user holds no item", () => {
	let scenario = createDamageScenario("FLING");

	expect(scenario.user.creature.heldItemId).toBe(null);
	expect(resolveFlingDamage(scenario)).toBe(0);
});

test("Held-item-power damage does nothing when the held item has no fling power", () => {
	let scenario = createDamageScenario(
		"FLING",
		PRIMARY_SPECIES_ID,
		SECONDARY_SPECIES_ID,
		"LEFTOVERS",
	);

	expect(resolveFlingDamage(scenario)).toBe(0);
});

test("Held-item-power damage is zeroed by type immunity", () => {
	let scenario = createDamageScenario(
		"FLING",
		PRIMARY_SPECIES_ID,
		SECONDARY_SPECIES_ID,
		"IRONBALL",
	);

	expect(resolveFlingDamage(scenario, Effectiveness.ZERO)).toBe(0);
});

/**
 * Resolves held-item-power (FLING-style) damage with the random spread pinned to
 * 1.0 (`floor(0.9375 * 16) = 15`, so `(85 + 15) / 100 = 1`). `effectiveness` feeds
 * both the pre-formula immunity guard and the in-formula multiply.
 */
function resolveFlingDamage(
	scenario: ReturnType<typeof createDamageScenario>,
	effectiveness: Effectiveness = Effectiveness.NORMAL,
) {
	return getResolvedMoveDamage(
		{
			state: scenario.state,
			gameData: GAME_DATA,
			random: () => 0.9375,
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

/**
 * Resolves damage through the full formula with the random spread pinned to
 * 1.0 (`floor(0.9375 * 16) = 15`, so `(85 + 15) / 100 = 1`), keeping the
 * held-item type-boost the only multiplier able to move the result.
 */
function resolveBoostDamage(scenario: ReturnType<typeof createDamageScenario>) {
	return getResolvedMoveDamage(
		{
			state: scenario.state,
			gameData: GAME_DATA,
			random: () => 0.9375,
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

function createDamageScenario(
	moveId: MoveId = "TACKLE",
	userSpeciesId = PRIMARY_SPECIES_ID,
	targetSpeciesId = SECONDARY_SPECIES_ID,
	heldItemId: ItemId | null = null,
) {
	let user = new CombatantState(createCreature(userSpeciesId, 255, heldItemId));
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

/**
 * Resolves damage for the effect-override paths (fixed-damage and counter) that
 * bypass the normal formula. `targetRemainingHP` pins the target's current HP so
 * fraction-based moves are deterministic, and `effectiveness` still gates immunity.
 */
function resolveFixedDamage(
	scenario: ReturnType<typeof createDamageScenario>,
	effectiveness: Effectiveness = Effectiveness.NORMAL,
	targetRemainingHP = 100,
) {
	return getResolvedMoveDamage(
		{
			state: scenario.state,
			gameData: GAME_DATA,
			random: () => 0,
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
			getRemainingHP: (combatant) => (combatant === scenario.target ? targetRemainingHP : 100),
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

function createCreature(speciesId: SpeciesId, attackEv = 0, heldItemId: ItemId | null = null) {
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
