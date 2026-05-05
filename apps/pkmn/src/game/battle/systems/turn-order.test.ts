/**
 * Verifies deterministic turn action ordering when priority and effective speed
 * are tied. These tests focus on the turn-order system directly and add one
 * small battle-level check to confirm the session wiring uses the same RNG path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";
import type { Creature as CreatureType } from "~/game/world/creature";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { GameData } from "~/game/data/game-data";
import { DamageClass, type Move } from "~/game/data/move";
import { Stat } from "~/game/data/stat";
import { Creature } from "~/game/world/creature";

import {
	Battle,
	type BattleActiveSlotState,
	type BattleEvent,
	type BattlePosition,
	type BattleState,
} from "../battle";
import { CombatantState } from "../combatant-state";
import { createFieldEffectState, createSideEffectState } from "../state";

import { getTurnActions } from "./turn-order";

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

test("equal-speed ties use one precomputed RNG roll per action", () => {
	let callCount = 0;
	let state = createBattleState(2, 0);
	let move = createStubMove();
	let actionsByKey = new Map<string, BattleActiveSlotState>();
	let requests = [
		{ side: 0, slot: 0 },
		{ side: 1, slot: 0 },
		{ side: 0, slot: 1 },
	] satisfies BattlePosition[];

	actionsByKey.set("0:0", createActiveSlot("TACKLE"));
	actionsByKey.set("1:0", createActiveSlot("TACKLE"));
	actionsByKey.set("0:1", createActiveSlot("TACKLE"));

	let actions = getTurnActions(
		{
			state,
			gameData: createStubGameData(move),
			random: () => {
				callCount += 1;
				if (callCount === 1) return 0.1;
				if (callCount === 2) return 0.9;
				return 0.4;
			},
			getActiveCombatant: (position) => actionsByKey.get(getPositionKey(position)) ?? null,
			canCombatantLeaveBattle: () => true,
			canSwitchCombatant: () => true,
			getCombatantSpeed: () => 100,
			getMovePriority: () => 0,
		},
		requests,
		[
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		],
	);

	expect(callCount).toBe(3);
	expect(actions.map((action) => action.userPosition)).toEqual([
		{ side: 1, slot: 0 },
		{ side: 0, slot: 1 },
		{ side: 0, slot: 0 },
	]);
});

test("Trick Room ties still use RNG after effective speed matches", () => {
	let state = createBattleState(1, 5);
	let move = createStubMove();
	let actionsByKey = new Map<string, BattleActiveSlotState>();
	let requests = [
		{ side: 0, slot: 0 },
		{ side: 1, slot: 0 },
	] satisfies BattlePosition[];
	let callCount = 0;

	actionsByKey.set("0:0", createActiveSlot("TACKLE"));
	actionsByKey.set("1:0", createActiveSlot("TACKLE"));

	let actions = getTurnActions(
		{
			state,
			gameData: createStubGameData(move),
			random: () => {
				callCount += 1;
				if (callCount === 1) return 0.2;
				return 0.8;
			},
			getActiveCombatant: (position) => actionsByKey.get(getPositionKey(position)) ?? null,
			canCombatantLeaveBattle: () => true,
			canSwitchCombatant: () => true,
			getCombatantSpeed: () => 55,
			getMovePriority: () => 0,
		},
		requests,
		[
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		],
	);

	expect(actions.map((action) => action.userPosition)).toEqual([
		{ side: 1, slot: 0 },
		{ side: 0, slot: 0 },
	]);
});

test("Battle uses its RNG tie-breaker for equal-speed actions under Trick Room", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTrickRoomAndTackle()]] },
			{ teams: [[createPrimaryFixtureWithGrowthAndTackle()]] },
		],
		random: createRandomSequence(0.9, 0.1, 0.2, 0.8, 1),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(readEvent(session.next())).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
});

/** Returns a minimal move record for turn-order sorting tests. */
function createStubMove(): Move {
	return {
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp: 35,
		effect: { kind: "none" },
	};
}

/** Returns a minimal game data container that can resolve one move identifier. */
function createStubGameData(move: Move): GameData {
	return {
		species: GAME_DATA.species,
		moves: new Map([["TACKLE", move]]),
		items: GAME_DATA.items,
		natures: GAME_DATA.natures,
		typeChart: GAME_DATA.typeChart,
	};
}

/** Returns a minimal active slot backed by a combatant with one usable move. */
function createActiveSlot(moveId: string): BattleActiveSlotState {
	let combatant = new CombatantState({
		moveset: [moveId, moveId, moveId, moveId],
		status: { pp: [10, 10, 10, 10] },
	} as CreatureType);

	return {
		teamIndex: 0,
		creatureIndex: 0,
		combatant,
	};
}

/** Returns a fresh battle state with the requested slot count and Trick Room duration. */
function createBattleState(slots: 1 | 2 | 3, trickRoomTurns: number): BattleState {
	let side0 = {
		canLeaveBattle: false,
		pendingHealingWishCount: 0,
		followMeUserSlot: null,
		slotTeams: Array.from({ length: slots }, () => 0),
		teams: [],
		active: Array.from({ length: slots }, () => null),
		effects: createSideEffectState(),
	};
	let side1 = {
		canLeaveBattle: false,
		pendingHealingWishCount: 0,
		followMeUserSlot: null,
		slotTeams: Array.from({ length: slots }, () => 0),
		teams: [],
		active: Array.from({ length: slots }, () => null),
		effects: createSideEffectState(),
	};
	let field = createFieldEffectState();
	field.trickRoomTurns = trickRoomTurns;

	return {
		turn: 1,
		phase: "awaiting-turn-input",
		winnerSide: null,
		slots,
		sides: [side0, side1] as BattleState["sides"],
		field,
		delayedAttacks: [],
	};
}

/** Returns a stable string key for active-slot lookup in the system tests. */
function getPositionKey(position: BattlePosition): string {
	return `${position.side}:${position.slot}`;
}

/** Returns a fixture that can activate Trick Room and then use Tackle. */
function createPrimaryFixtureWithTrickRoomAndTackle() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TRICK_ROOM", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TRICK_ROOM", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

/** Returns a matching-speed fixture that can spend turn one on Growth. */
function createPrimaryFixtureWithGrowthAndTackle() {
	return new Creature({
		nickname: "Reserve Beta",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GROWTH", "TACKLE", "LEECH_SEED", "EMBER"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GROWTH", "TACKLE", "LEECH_SEED", "EMBER"]),
	});
}

/** Returns max IVs for all stats used by the integration fixtures. */
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

/** Returns a fresh status record with PP loaded from the authored move data. */
function createStatus(moveset: [string, string, string, string]) {
	return {
		state: null,
		damage: 0,
		pp: [
			MOVES[moveset[0] as keyof typeof MOVES].pp,
			MOVES[moveset[1] as keyof typeof MOVES].pp,
			MOVES[moveset[2] as keyof typeof MOVES].pp,
			MOVES[moveset[3] as keyof typeof MOVES].pp,
		] as [number, number, number, number],
	};
}

/** Returns the event value from one generator step. */
function readEvent(result: IteratorResult<BattleEvent, BattleEvent>) {
	return result.value;
}

/** Collects events until the current turn finishes resolving. */
function collectTurnEvents(
	session: Generator<BattleEvent, BattleEvent, any>,
	battle: Battle,
	commands: Array<any>,
) {
	let events: BattleEvent[] = [];
	events.push(readEvent(session.next(commands)));

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		events.push(event);
		if (event.type === "turn-ended") break;
		if (result.done || battle.state.phase !== "resolving-turn") break;
	}

	return events;
}

/** Returns an RNG callback that reuses the last value once the sequence is exhausted. */
function createRandomSequence(...values: number[]) {
	let index = 0;
	return () => {
		let value = values[index] ?? values.at(-1) ?? 0;
		index += 1;
		return value;
	};
}

/** Returns one authored species identifier that satisfies the provided predicate. */
function getSpeciesId(
	predicate: (species: (typeof SPECIES)[keyof typeof SPECIES]) => boolean,
): SpeciesId {
	for (let [speciesId, species] of Object.entries(SPECIES)) {
		if (predicate(species)) return speciesId as SpeciesId;
	}

	throw new ReferenceError("Expected a species fixture matching the requested predicate.");
}
