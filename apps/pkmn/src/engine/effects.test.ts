import { expect, test } from "bun:test";

import type { MoveEffect } from "../domain/move";

import { StatusEffectType } from "../domain/move";
import { Stat } from "../domain/stat";

import { createFieldEffectState, createSideEffectState } from "./battle-state";
import { CombatantState } from "./combatant-state";
import { Creature, State } from "./creature";
import { Effects } from "./effects";

test("Effects.trap applies trapped volatile state", () => {
	let context = createContext();

	expect(Effects.trap({ kind: "trap" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "trap" },
	]);
	expect(context.target.volatile.trapped).toBe(true);
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

test("Effects.leechSeed marks the target as seeded", () => {
	let context = createContext();

	expect(Effects.leechSeed({ kind: "leech-seed" }, context)).toEqual([
		{ type: "volatile-applied", target: { side: 1, slot: 0 }, effect: "seed" },
	]);
	expect(context.target.volatile.seeded).toBe(true);
	expect(context.target.volatile.seededBy).toBe(0);
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

function createContext(randomValue = 0.5): Effects.Context {
	let user = new CombatantState(createCreature());
	let target = new CombatantState(createCreature());

	return {
		user,
		target,
		userPosition: { side: 0, slot: 0 },
		targetPosition: { side: 1, slot: 0 },
		state: {
			turn: 1,
			phase: "resolving-turn",
			winnerSide: null,
			slots: 1,
			sides: [
				{
					canLeaveBattle: true,
					slotTeams: [0],
					teams: [],
					active: [null],
					effects: createSideEffectState(),
				},
				{
					canLeaveBattle: true,
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
		species: "BULBASAUR",
		nature: "MODEST",
		experience: 1000,
		moveset: ["TACKLE", null, null, null],
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
