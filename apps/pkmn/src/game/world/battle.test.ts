/**
 * Regression coverage for the battle-to-world synchronization bridge, focused on how
 * runtime combatants are mapped back onto their persistent creature ids when a single
 * side carries more than one team.
 *
 * These tests build a minimal world and a hand-rolled runtime battle state so the
 * multi-team mapping path can be exercised directly, independent of how the engine
 * currently assembles sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type {
	BattleActiveSlotState,
	BattleSideState,
	BattleState,
	BattleTeamState,
} from "~/game/battle/battle";

import { CombatantState } from "~/game/battle/combatant-state";
import { createFieldEffectState, createSideEffectState } from "~/game/battle/state";
import { State } from "~/game/data/status";

import type { BattleRuntimeHandle } from "./battle";
import type { CreatureId } from "./ids";
import type { World } from "./world";

import {
	cleanupBattle,
	getBattleMemberEntityId,
	syncBattleState,
	writeBackPlayerBattleResults,
} from "./battle";
import { Creature } from "./creature";
import { createBattleId, createCreatureId, createPlayerId } from "./ids";

/** Builds a bare combatant with a controllable status/damage/pp footprint for assertions. */
function createCombatant(options: {
	damage?: number;
	state?: State | null;
	poison?: "regular" | "escalating";
	pp?: [number, number, number, number];
}): CombatantState {
	return new CombatantState(
		new Creature({
			species: "test-species",
			nature: "test-nature",
			experience: 0,
			moveset: ["move-a", null, null, null],
			status: {
				state: options.state ?? null,
				...(options.poison ? { poison: options.poison } : {}),
				damage: options.damage ?? 0,
				pp: options.pp ?? [10, 0, 0, 0],
			},
			iv: {} as never,
			ev: {} as never,
		}),
	);
}

/** Wraps a list of combatants into a runtime team. */
function createTeam(creatures: CombatantState[]): BattleTeamState {
	return { creatures, eliminated: false };
}

/** Assembles a runtime side from its teams, activating each team's first creature by slot. */
function createSide(teams: BattleTeamState[]): BattleSideState {
	let active: Array<BattleActiveSlotState | null> = teams.map((team, teamIndex) => ({
		teamIndex,
		creatureIndex: 0,
		combatant: team.creatures[0]!,
	}));

	return {
		canLeaveBattle: true,
		pendingHealingWishCount: 0,
		followMeUserSlot: null,
		slotTeams: teams.map((_team, teamIndex) => teamIndex),
		teams,
		active,
		effects: createSideEffectState(),
	};
}

/** Builds a runtime battle state from the two prepared sides. */
function createBattleState(playerSide: BattleSideState, enemySide: BattleSideState): BattleState {
	return {
		turn: 1,
		phase: "resolving-turn",
		winnerSide: null,
		slots: 1,
		sides: [playerSide, enemySide],
		field: createFieldEffectState(),
		delayedAttacks: [],
	};
}

/** Builds a minimal world with only the stores the battle sync touches. */
function createWorld(): World {
	return {
		entities: [],
		playerId: createPlayerId("hero"),
		playerProfile: {},
		party: {},
		inventory: {},
		money: {},
		bestiary: {},
		storageBoxes: {},
		creatureIdentity: {},
		creatureProgress: {},
		creatureMoves: {},
		creatureHealth: {},
		creatureStatus: {},
		creatureInstance: {},
		ownership: {},
		creatureLocation: {},
		flags: {},
		activeBattle: {},
		battleParticipants: {},
		battlePhase: {},
		battleField: {},
		battleSide: {},
		battlePendingTurn: {},
		battlePendingReplacement: {},
		battleLog: {},
		battleMember: {},
	};
}

test("syncBattleState maps a multi-team player side back to flat party ids by global index", () => {
	// Player side carries two teams (A: 2 creatures, B: 2 creatures). The flat party id
	// list stores them in team order, so team B's members live at indices 2 and 3.
	let teamAFirst = createCreatureId("a1");
	let teamASecond = createCreatureId("a2");
	let teamBFirst = createCreatureId("b1");
	let teamBSecond = createCreatureId("b2");
	let playerParty: CreatureId[] = [teamAFirst, teamASecond, teamBFirst, teamBSecond];

	// Give the second team distinctive damage so a wrong (per-team) mapping would land it on
	// a first-team id instead of its own id.
	let teamA = createTeam([
		createCombatant({ damage: 5, state: State.Burned }),
		createCombatant({ damage: 6 }),
	]);
	let teamB = createTeam([
		createCombatant({ damage: 40, state: State.Paralyzed }),
		createCombatant({ damage: 41, state: State.Asleep }),
	]);

	let enemyCreatureId = createCreatureId("e1");
	let enemySide = createSide([createTeam([createCombatant({ damage: 0 })])]);
	let state = createBattleState(createSide([teamA, teamB]), enemySide);

	let world = createWorld();
	let battleId = createBattleId("multi-team");
	world.battleParticipants[battleId] = {
		playerId: createPlayerId("hero"),
		enemyId: createPlayerId("rival"),
		playerParty,
		enemyParty: [enemyCreatureId],
	};

	let runtime = { battle: { state } } as unknown as BattleRuntimeHandle;
	syncBattleState(world, runtime, battleId, []);

	// The mirror for team B slot 0 must point at teamBFirst (flat index 2), not teamAFirst.
	let teamBFirstMember = world.battleMember[getBattleMemberEntityId(battleId, 0, 1, 0)];
	let teamBSecondMember = world.battleMember[getBattleMemberEntityId(battleId, 0, 1, 1)];
	expect(teamBFirstMember?.creatureId).toBe(teamBFirst);
	expect(teamBFirstMember?.damage).toBe(40);
	expect(teamBFirstMember?.status).toBe(State.Paralyzed);
	expect(teamBSecondMember?.creatureId).toBe(teamBSecond);
	expect(teamBSecondMember?.damage).toBe(41);
	expect(teamBSecondMember?.status).toBe(State.Asleep);

	// Team A stays mapped to its own ids at the front of the flat list.
	let teamAFirstMember = world.battleMember[getBattleMemberEntityId(battleId, 0, 0, 0)];
	let teamASecondMember = world.battleMember[getBattleMemberEntityId(battleId, 0, 0, 1)];
	expect(teamAFirstMember?.creatureId).toBe(teamAFirst);
	expect(teamAFirstMember?.damage).toBe(5);
	expect(teamASecondMember?.creatureId).toBe(teamASecond);
	expect(teamASecondMember?.damage).toBe(6);
});

test("writeBackPlayerBattleResults writes multi-team results to the matching flat party ids", () => {
	let teamAFirst = createCreatureId("a1");
	let teamASecond = createCreatureId("a2");
	let teamBFirst = createCreatureId("b1");
	let teamBSecond = createCreatureId("b2");
	let playerParty: CreatureId[] = [teamAFirst, teamASecond, teamBFirst, teamBSecond];

	let teamA = createTeam([createCombatant({ damage: 5 }), createCombatant({ damage: 6 })]);
	let teamB = createTeam([
		createCombatant({ damage: 40, state: State.Poisoned, poison: "escalating", pp: [3, 0, 0, 0] }),
		createCombatant({ damage: 41 }),
	]);

	let enemySide = createSide([createTeam([createCombatant({ damage: 0 })])]);
	let state = createBattleState(createSide([teamA, teamB]), enemySide);

	let world = createWorld();
	let battleId = createBattleId("multi-team-writeback");
	world.battleParticipants[battleId] = {
		playerId: createPlayerId("hero"),
		enemyId: createPlayerId("rival"),
		playerParty,
		enemyParty: [createCreatureId("e1")],
	};

	// Seed the moves store so PP write-back has a moveset to preserve for team B's first creature.
	world.creatureMoves[teamBFirst] = { moveset: ["move-a", null, null, null], pp: [10, 0, 0, 0] };

	let runtime = { battle: { state } } as unknown as BattleRuntimeHandle;
	writeBackPlayerBattleResults(world, runtime, battleId);

	// Team B's first creature (flat index 2) receives its own results, not team A's.
	expect(world.creatureHealth[teamBFirst]?.damage).toBe(40);
	// Escalating poison downgrades to regular at battle end.
	expect(world.creatureStatus[teamBFirst]).toEqual({ state: State.Poisoned, poison: "regular" });
	expect(world.creatureMoves[teamBFirst]?.pp).toEqual([3, 0, 0, 0]);

	// Team A's first creature is untouched by team B's larger damage value.
	expect(world.creatureHealth[teamAFirst]?.damage).toBe(5);
});

test("cleanupBattle despawns unowned trainer creatures like encounter creatures", () => {
	let world = createWorld();
	let battleId = createBattleId("trainer-cleanup");
	let wildId = createCreatureId("wild-1");
	let trainerId = createCreatureId("trainer-1");
	let allyId = createCreatureId("ally-1");

	// Seed a wild and a trainer enemy plus one owned ally, each with a full component set.
	for (let id of [wildId, trainerId, allyId]) {
		world.entities.push(id);
		world.creatureIdentity[id] = { speciesId: "test-species" };
		world.creatureProgress[id] = { natureId: "n", experience: 0, iv: {} as never, ev: {} as never };
		world.creatureMoves[id] = { moveset: ["move-a", null, null, null], pp: [10, 0, 0, 0] };
		world.creatureHealth[id] = { damage: 0 };
		world.creatureStatus[id] = { state: null };
	}
	world.creatureLocation[wildId] = { kind: "encounter", encounterId: "e1" };
	world.creatureLocation[trainerId] = { kind: "trainer", trainerId: "rival-0" };
	world.creatureLocation[allyId] = { kind: "battle", battleId, side: 1, slot: 0 };
	// The ally is owned, so it must survive cleanup even though it sat on the enemy side.
	world.ownership[allyId] = { ownerId: createPlayerId("hero") };

	world.battleParticipants[battleId] = {
		playerId: createPlayerId("hero"),
		enemyId: createPlayerId("rival"),
		playerParty: [],
		enemyParty: [wildId, trainerId, allyId],
	};

	cleanupBattle(world, battleId);

	// Both transient enemy kinds are gone from the world; the owned creature stays.
	expect(trainerId in world.creatureIdentity).toBe(false);
	expect(trainerId in world.creatureLocation).toBe(false);
	expect(world.entities.includes(trainerId)).toBe(false);
	expect(wildId in world.creatureIdentity).toBe(false);
	expect(world.entities.includes(wildId)).toBe(false);
	expect(world.entities.includes(allyId)).toBe(true);
	expect(allyId in world.creatureIdentity).toBe(true);
});
