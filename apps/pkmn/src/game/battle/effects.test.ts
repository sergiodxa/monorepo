/**
 * Exercises the battle effects test surface for this module by verifying how effect handlers
 * mutate combat state and emit battle events under controlled scenarios.
 *
 * This module serves as the specification for the effect behaviors exposed by the battle engine,
 * ensuring state transitions remain stable as the implementation evolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { MoveEffect } from "~/game/data/move";

import { GameData } from "~/game/data/game-data";
import { StatusEffectType } from "~/game/data/move";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";
import { Creature, State } from "~/game/world/creature";

import { CombatantState } from "./combatant-state";
import { Effects } from "./effects";
import { createFieldEffectState, createSideEffectState } from "./state";

let TEST_SPECIES_ID = "SPECIES_ALPHA";
let TEST_NATURE_ID = "NATURE_ALPHA";
let TEST_MOVE_ID = "MOVE_ALPHA";

test("Effects.trap applies trapped volatile state", () => {
	let context = createContext();

	expect(Effects.trap({ kind: "trap" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "trap" },
	]);
	expect(context.target.volatile.trapped).toBe(true);
});

test("Effects.attract applies attraction and records the source", () => {
	let context = createContext();

	expect(Effects.attract({ kind: "attract" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "attract" },
	]);
	expect(context.target.volatile.attracted).toBe(true);
	expect(context.target.volatile.attractedBy).toBe(context.user.creature);
});

test("Effects.forceSwitchTarget is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.forceSwitchTarget({ kind: "force-switch-target" }, context)).toEqual([]);
});

test("Effects.partialTrap applies trapped turns and source side", () => {
	let context = createContext();

	expect(Effects.partialTrap({ kind: "partial-trap", turns: 4 }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "partial-trap" },
	]);
	expect(context.target.volatile.trapped).toBe(true);
	expect(context.target.volatile.partiallyTrappedTurns).toBe(4);
	expect(context.target.volatile.partialTrapSourceSide).toBe(0);
});

test("Effects.confuse applies confusion turns", () => {
	let context = createContext();

	expect(Effects.confuse({ kind: "confuse", turns: 2 }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "confusion" },
	]);
	expect(context.target.volatile.confusionTurns).toBe(2);
});

test("Effects.flinch applies flinch when the roll succeeds", () => {
	let context = createContext(0);

	expect(Effects.flinch({ kind: "flinch", chance: 0.3 }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "flinch" },
	]);
	expect(context.target.volatile.flinched).toBe(true);
});

test("Effects.flinch returns no events when the roll fails", () => {
	let context = createContext(1);

	expect(Effects.flinch({ kind: "flinch", chance: 0.3 }, context)).toEqual([]);
	expect(context.target.volatile.flinched).toBe(false);
});

test("Effects.protect applies protecting to the user", () => {
	let context = createContext();

	expect(Effects.protect({ kind: "protect" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "protect" },
	]);
	expect(context.user.volatile.protecting).toBe(true);
	expect(context.user.volatile.protectionSuccessStreak).toBe(1);
	expect(context.user.volatile.successfulProtectionThisTurn).toBe(true);
});

test("Effects.endure applies enduring to the user", () => {
	let context = createContext();

	expect(Effects.endure({ kind: "endure" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "endure" },
	]);
	expect(context.user.volatile.enduring).toBe(true);
	expect(context.user.volatile.protectionSuccessStreak).toBe(1);
	expect(context.user.volatile.successfulProtectionThisTurn).toBe(true);
});

test("Effects.destinyBond applies destiny bond to the user", () => {
	let context = createContext();

	expect(Effects.destinyBond({ kind: "destiny-bond" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "destiny-bond" },
	]);
	expect(context.user.volatile.destinyBonded).toBe(true);
});

test("Effects.chargedElectric applies charged electric to the user", () => {
	let context = createContext();

	expect(Effects.chargedElectric({ kind: "charged-electric" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "charged-electric" },
	]);
	expect(context.user.volatile.chargedElectric).toBe(true);
});

test("Effects.focusEnergy applies focus energy to the user", () => {
	let context = createContext();

	expect(Effects.focusEnergy({ kind: "focus-energy" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "focus-energy" },
	]);
	expect(context.user.volatile.focusEnergy).toBe(true);
});

test("Effects.aquaRing applies Aqua Ring to the user", () => {
	let context = createContext();

	expect(Effects.aquaRing({ kind: "aqua-ring" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "aqua-ring" },
	]);
	expect(context.user.volatile.aquaRing).toBe(true);
});

test("Effects.followMe marks the user's slot for redirection", () => {
	let context = createContext();

	expect(Effects.followMe({ kind: "follow-me" }, context)).toEqual([]);
	expect(context.state.sides[0]!.followMeUserSlot).toBe(0);
});

test("Effects.healingWish increments the pending side wish count", () => {
	let context = createContext();

	expect(Effects.healingWish({ kind: "healing-wish" }, context)).toEqual([]);
	expect(context.state.sides[0]!.pendingHealingWishCount).toBe(1);
});

test("Effects.breakProtect clears target protection", () => {
	let context = createContext();
	context.target.volatile.protecting = true;

	expect(Effects.breakProtect({ kind: "break-protect" }, context)).toEqual([]);
	expect(context.target.volatile.protecting).toBe(false);
});

test("Effects.firstTurnOnly is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.firstTurnOnly({ kind: "first-turn-only" }, context)).toEqual([]);
});

test("Effects.rampage is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.rampage({ kind: "rampage", turns: 2 }, context)).toEqual([]);
});

test("Effects.modifyStat mutates the requested target stat stage", () => {
	let context = createContext();

	expect(
		Effects.modifyStat(
			{ kind: "modify-stat", stat: Stat.Attack, stages: -2, target: "target" },
			context,
		),
	).toEqual([
		{
			type: "stat-stage-changed",
			target: { side: 1, slot: 0 },
			stat: Stat.Attack,
			stages: -2,
			value: -2,
		},
	]);
	expect(context.target.statStages[Stat.Attack]).toBe(-2);
});

test("Effects.resetStatStages clears every active combatant stage when targeting all active", () => {
	let context = createContext();
	context.user.statStages[Stat.Attack] = 2;
	context.target.statStages[Stat.Speed] = -1;
	context.state.sides[0]!.active[0] = {
		teamIndex: 0,
		creatureIndex: 0,
		combatant: context.user,
	};
	context.state.sides[1]!.active[0] = {
		teamIndex: 0,
		creatureIndex: 0,
		combatant: context.target,
	};

	expect(
		Effects.resetStatStages({ kind: "reset-stat-stages", target: "all-active" }, context),
	).toEqual([
		{
			type: "stat-stage-changed",
			target: { side: 0, slot: 0 },
			stat: Stat.Attack,
			stages: -2,
			value: 0,
		},
		{
			type: "stat-stage-changed",
			target: { side: 1, slot: 0 },
			stat: Stat.Speed,
			stages: 1,
			value: 0,
		},
	]);
	expect(context.user.statStages[Stat.Attack]).toBe(0);
	expect(context.target.statStages[Stat.Speed]).toBe(0);
});

test("Effects.clearSideEffects clears requested hazards and screens", () => {
	let context = createContext();
	context.state.sides[0]!.effects.reflectTurns = 5;
	context.state.sides[1]!.effects.spikesLayers = 2;
	context.state.sides[1]!.effects.stealthRock = true;

	expect(
		Effects.clearSideEffects(
			{
				kind: "clear-side-effects",
				target: "both",
				effects: ["reflect", "spikes", "stealth-rock"],
			},
			context,
		),
	).toEqual([
		{ type: "side-effect-applied", side: 0, effect: "reflect", turns: 0 },
		{ type: "side-effect-applied", side: 1, effect: "spikes", turns: 0 },
		{ type: "side-effect-applied", side: 1, effect: "stealth-rock", turns: 0 },
	]);
	expect(context.state.sides[0]!.effects.reflectTurns).toBe(0);
	expect(context.state.sides[1]!.effects.spikesLayers).toBe(0);
	expect(context.state.sides[1]!.effects.stealthRock).toBe(false);
});

test("Effects.sideEffect routes reflect to the chosen side", () => {
	let context = createContext();

	expect(
		Effects.sideEffect(
			{ kind: "side-effect", effect: "reflect", turns: 5, target: "self" },
			context,
		),
	).toEqual([{ type: "side-effect-applied", side: 0, effect: "reflect", turns: 5 }]);
	expect(context.state.sides[0].effects.reflectTurns).toBe(5);
});

test("Effects.fieldEffect routes rain to shared field state", () => {
	let context = createContext();

	expect(Effects.fieldEffect({ kind: "field-effect", effect: "rain", turns: 5 }, context)).toEqual([
		{ type: "field-effect-applied", effect: "rain", turns: 5 },
	]);
	expect(context.state.field.weather).toBe("rain");
	expect(context.state.field.weatherTurns).toBe(5);
});

test("Effects.fieldEffect routes grassy terrain to shared field state", () => {
	let context = createContext();

	expect(
		Effects.fieldEffect({ kind: "field-effect", effect: "grassy-terrain", turns: 5 }, context),
	).toEqual([{ type: "field-effect-applied", effect: "grassy-terrain", turns: 5 }]);
	expect(context.state.field.terrain).toBe("grassy");
	expect(context.state.field.terrainTurns).toBe(5);
});

test("Effects.fieldEffect routes trick room to shared field state", () => {
	let context = createContext();

	expect(
		Effects.fieldEffect({ kind: "field-effect", effect: "trick-room", turns: 5 }, context),
	).toEqual([{ type: "field-effect-applied", effect: "trick-room", turns: 5 }]);
	expect(context.state.field.trickRoomTurns).toBe(5);
});

test("Effects.fieldEffect clears trick room when reused while active", () => {
	let context = createContext();
	context.state.field.trickRoomTurns = 3;

	expect(
		Effects.fieldEffect({ kind: "field-effect", effect: "trick-room", turns: 5 }, context),
	).toEqual([{ type: "field-effect-applied", effect: "trick-room", turns: 0 }]);
	expect(context.state.field.trickRoomTurns).toBe(0);
});

test("Effects.fieldEffect clears wonder room when reused while active", () => {
	let context = createContext();
	context.state.field.wonderRoomTurns = 2;

	expect(
		Effects.fieldEffect({ kind: "field-effect", effect: "wonder-room", turns: 5 }, context),
	).toEqual([{ type: "field-effect-applied", effect: "wonder-room", turns: 0 }]);
	expect(context.state.field.wonderRoomTurns).toBe(0);
});

test("Effects.fieldEffect clears magic room when reused while active", () => {
	let context = createContext();
	context.state.field.magicRoomTurns = 4;

	expect(
		Effects.fieldEffect({ kind: "field-effect", effect: "magic-room", turns: 5 }, context),
	).toEqual([{ type: "field-effect-applied", effect: "magic-room", turns: 0 }]);
	expect(context.state.field.magicRoomTurns).toBe(0);
});

test("Effects.applyStatus mutates the persistent creature state", () => {
	let context = createContext(0);

	expect(
		Effects.applyStatus(
			{ kind: "apply-status", status: StatusEffectType.Sleep, chance: 1 },
			context,
		),
	).toEqual([{ type: "status-applied", target: { side: 1, slot: 0 }, status: State.Asleep }]);
	expect(context.target.creature.status.state).toBe(State.Asleep);
});

test("Effects.applyStatus blocks type-immune major statuses", () => {
	let context = createContext(0.5, [Type.FIRE]);

	expect(
		Effects.applyStatus(
			{ kind: "apply-status", status: StatusEffectType.Burn, chance: 1 },
			context,
		),
	).toEqual([]);
	expect(context.target.creature.status.state).toBe(null);
});

test("Effects.applyStatus blocks sleep for grounded targets under electric terrain", () => {
	let context = createContext(0.5, [Type.GRASS]);
	context.state.field.terrain = "electric";
	context.state.field.terrainTurns = 5;

	expect(
		Effects.applyStatus(
			{ kind: "apply-status", status: StatusEffectType.Sleep, chance: 1 },
			context,
		),
	).toEqual([]);
	expect(context.target.creature.status.state).toBe(null);
});

test("Effects.applyStatus still allows sleep for ungrounded targets under electric terrain", () => {
	let context = createContext(0.5, [Type.FLYING]);
	context.state.field.terrain = "electric";
	context.state.field.terrainTurns = 5;

	expect(
		Effects.applyStatus(
			{ kind: "apply-status", status: StatusEffectType.Sleep, chance: 1 },
			context,
		),
	).toEqual([{ type: "status-applied", target: { side: 1, slot: 0 }, status: State.Asleep }]);
	expect(context.target.creature.status.state).toBe(State.Asleep);
});

test("Effects.applyStatus treats flying targets as grounded under gravity", () => {
	let context = createContext(0.5, [Type.FLYING]);
	context.state.field.terrain = "electric";
	context.state.field.terrainTurns = 5;
	context.state.field.gravityTurns = 5;

	expect(
		Effects.applyStatus(
			{ kind: "apply-status", status: StatusEffectType.Sleep, chance: 1 },
			context,
		),
	).toEqual([]);
	expect(context.target.creature.status.state).toBe(null);
});

test("Effects.leechSeed marks the target as seeded", () => {
	let context = createContext();

	expect(Effects.leechSeed({ kind: "leech-seed" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "seed" },
	]);
	expect(context.target.volatile.seeded).toBe(true);
	expect(context.target.volatile.seededBy).toBe(0);
});

test("Effects.drain is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.drain({ kind: "drain", ratio: 0.5 }, context)).toEqual([]);
});

test("Effects.cannotKO is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.cannotKO({ kind: "cannot-ko" }, context)).toEqual([]);
});

test("Effects.bellyDrum is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.bellyDrum({ kind: "belly-drum" }, context)).toEqual([]);
});

test("Effects.crashOnMiss is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.crashOnMiss({ kind: "crash-on-miss", ratio: 1 / 2 }, context)).toEqual([]);
});

test("Effects.doublePowerOnDamagedTarget is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.doublePowerOnDamagedTarget(
			{ kind: "double-power-on-damaged-target" } as Extract<
				MoveEffect,
				{ kind: "double-power-on-damaged-target" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.doublePowerOnStatusTarget is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.doublePowerOnStatusTarget(
			{ kind: "double-power-on-status-target" } as Extract<
				MoveEffect,
				{ kind: "double-power-on-status-target" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.powerFromTargetSpeed is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.powerFromTargetSpeed(
			{ kind: "power-from-target-speed" } as Extract<
				MoveEffect,
				{ kind: "power-from-target-speed" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.powerFromUserSpeed is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.powerFromUserSpeed(
			{ kind: "power-from-user-speed" } as Extract<MoveEffect, { kind: "power-from-user-speed" }>,
			context,
		),
	).toEqual([]);
});

test("Effects.powerFromUserHP is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.powerFromUserHP(
			{ kind: "power-from-user-hp" } as Extract<MoveEffect, { kind: "power-from-user-hp" }>,
			context,
		),
	).toEqual([]);
});

test("Effects.powerFromWeight is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.powerFromWeight(
			{ kind: "power-from-weight" } as Extract<MoveEffect, { kind: "power-from-weight" }>,
			context,
		),
	).toEqual([]);
});

test("Effects.doublePowerIfTargetDamagedThisTurn is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.doublePowerIfTargetDamagedThisTurn(
			{ kind: "double-power-if-target-damaged-this-turn" } as Extract<
				MoveEffect,
				{ kind: "double-power-if-target-damaged-this-turn" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.counterLastPhysicalHit is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.counterLastPhysicalHit(
			{ kind: "counter-last-physical-hit" } as Extract<
				MoveEffect,
				{ kind: "counter-last-physical-hit" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.boostOnKO is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.boostOnKO({ kind: "boost-on-ko", stat: Stat.Attack, stages: 3 }, context)).toEqual(
		[],
	);
});

test("Effects.failIfUserDamagedThisTurn is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.failIfUserDamagedThisTurn(
			{ kind: "fail-if-user-damaged-this-turn" } as Extract<
				MoveEffect,
				{ kind: "fail-if-user-damaged-this-turn" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.fixedDamageTargetHPGap is a no-op marker effect", () => {
	let context = createContext();

	expect(
		Effects.fixedDamageTargetHPGap(
			{ kind: "fixed-damage-target-hp-gap" } as Extract<
				MoveEffect,
				{ kind: "fixed-damage-target-hp-gap" }
			>,
			context,
		),
	).toEqual([]);
});

test("Effects.fixedDamageUserHP is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.fixedDamageUserHP({ kind: "fixed-damage-user-hp" }, context)).toEqual([]);
});

test("Effects.selfDestruct is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.selfDestruct({ kind: "self-destruct" }, context)).toEqual([]);
});

test("Effects.charge is a no-op marker effect", () => {
	let context = createContext();

	expect(Effects.charge({ kind: "charge" }, context)).toEqual([]);
});

test("Effects.resolve dispatches compound nested effects", () => {
	let context = createContext();
	let effect: MoveEffect = {
		kind: "compound",
		effects: [
			{ kind: "protect" },
			{ kind: "modify-stat", stat: Stat.Speed, stages: 1, target: "self" },
		],
	};

	expect(Effects.resolve(effect, context)).toEqual([
		{ type: "volatile-applied", target: { side: 0, slot: 0 }, effect: "protect" },
		{
			type: "stat-stage-changed",
			target: { side: 0, slot: 0 },
			stat: Stat.Speed,
			stages: 1,
			value: 1,
		},
	]);
	expect(context.user.volatile.protecting).toBe(true);
	expect(context.user.statStages[Stat.Speed]).toBe(1);
});

function createContext(randomValue = 0.5, targetTypes: Type[] = [Type.GRASS]): Effects.Context {
	let user = new CombatantState(createCreature());
	let target = new CombatantState(createCreature());
	let gameData = new GameData(
		new Map([[TEST_SPECIES_ID, { types: targetTypes } as never]]),
		new Map(),
		new Map(),
		new Map(),
		{} as never,
	);

	return {
		gameData,
		user,
		target,
		userPosition: { side: 0, slot: 0 },
		targetPosition: { side: 1, slot: 0 },
		state: {
			turn: 1,
			phase: "resolving-turn",
			winnerSide: null,
			slots: 1,
			delayedAttacks: [],
			sides: [
				{
					canLeaveBattle: true,
					pendingHealingWishCount: 0,
					followMeUserSlot: null,
					slotTeams: [0],
					teams: [],
					active: [null],
					effects: createSideEffectState(),
				},
				{
					canLeaveBattle: true,
					pendingHealingWishCount: 0,
					followMeUserSlot: null,
					slotTeams: [0],
					teams: [],
					active: [null],
					effects: createSideEffectState(),
				},
			],
			field: createFieldEffectState(),
		},
		random: () => randomValue,
	};
}

function createCreature() {
	return new Creature({
		species: TEST_SPECIES_ID,
		nature: TEST_NATURE_ID,
		experience: 1000,
		moveset: [TEST_MOVE_ID, null, null, null],
		status: { state: null, damage: 0, pp: [35, 0, 0, 0] },
		iv: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
	});
}
