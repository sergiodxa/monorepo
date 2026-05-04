import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import type { NatureId } from "~/domain/nature";
import type { SpeciesId } from "~/domain/species";

import { GameData } from "~/domain/game-data";

import { ITEMS } from "../content/items";
import { TYPE_MATCHUPS } from "../content/matchups";
import { MOVES } from "../content/moves";
import { NATURES } from "../content/natures";
import { SPECIES } from "../content/species";
import { DamageClass } from "../domain/move";
import { Stat } from "../domain/stat";

import type { BattleEvent } from "./battle";

import { Battle } from "./battle";
import { Creature } from "./creature";
import { State } from "./creature";
import { getCreatureCurrentHP, getCreatureStat } from "./mechanics";

let GAME_DATA = unwrap(
	GameData.create({
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	}),
);

test("the faster creature acts first when move priority matches", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulby()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "VINE_WHIP",
		target: { side: 0, slot: 0 },
	});
});

test("Quick Attack acts before a faster creature using a normal-priority move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBraveBulbyWithQuickAttack()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "QUICK_ATTACK",
		target: { side: 1, slot: 0 },
	});
});

test("Extreme Speed acts before another positive-priority move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBraveBulbyWithExtremeSpeed()]] },
			{ teams: [[createModestIvysaurWithQuickAttack()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "EXTREME_SPEED",
		target: { side: 1, slot: 0 },
	});
});

test("when both creatures use Quick Attack, the faster creature acts first", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBraveBulbyWithQuickAttack()]] },
			{ teams: [[createModestIvysaurWithQuickAttack()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "QUICK_ATTACK",
		target: { side: 0, slot: 0 },
	});
});

test("a fainted slot requests a replacement before the next turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpBulby(), createBackupBulby()]] },
			{ teams: [[createModestIvysaur()]] },
		],
		random: () => 1,
	});
	let session = battle.start();
	let events: BattleEvent[] = [];

	events.push(readEvent(session.next()));
	events.push(readEvent(session.next()));
	let turnRequest = readEvent(session.next());
	if (turnRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}
	events.push(turnRequest);

	events.push(
		readEvent(
			session.next([
				{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
				{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
			]),
		),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		events.push(event);
		if (event.type === "request-replacements") break;
		if (result.done) break;
	}

	expect(events).toEqual([
		{ type: "battle-started" },
		{ type: "turn-started", turn: 1 },
		{
			type: "request-turn-commands",
			requests: [
				{ side: 0, slot: 0 },
				{ side: 1, slot: 0 },
			],
		},
		{
			type: "move-used",
			user: { side: 1, slot: 0 },
			moveId: "RAZOR_LEAF",
			target: { side: 0, slot: 0 },
		},
		{
			type: "effectiveness",
			target: { side: 0, slot: 0 },
			effectiveness: 0.25,
		},
		{ type: "damage-dealt", target: { side: 0, slot: 0 }, damage: 1, remainingHP: 0 },
		{ type: "creature-fainted", target: { side: 0, slot: 0 } },
		{ type: "turn-ended", turn: 1 },
		{
			type: "request-replacements",
			requests: [{ side: 0, slot: 0, team: 0, choices: [1] }],
		},
	]);

	let replacementRequest = events.at(-1);
	if (replacementRequest?.type !== "request-replacements") {
		throw new TypeError("Expected replacement request.");
	}

	let nextEvent = readEvent(
		session.next([{ type: "replace", target: { side: 0, slot: 0 }, creature: 1 }]),
	);

	expect(nextEvent).toEqual({ type: "turn-started", turn: 2 });
	expect(battle.state.sides[0].active[0]?.creatureIndex).toBe(1);
	expect(battle.state.phase).toBe("awaiting-turn-input");
});

test("a side loses when its only team has no replacement left", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createLowHpBulby()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();
	let lastEvent: BattleEvent | null = null;

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	readEvent(
		session.next([
			{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.winnerSide).toBe(1);
});

test("a side can leave the battle instead of sending a replacement", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createLowHpBulby(), createBackupBulby()]] },
			{ teams: [[createModestIvysaur()]] },
		],
		random: () => 1,
	});
	let session = battle.start();
	let lastEvent: BattleEvent | null = null;

	readEvent(session.next());
	readEvent(session.next());
	let turnRequest = readEvent(session.next());
	if (turnRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	readEvent(
		session.next([
			{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		if (event.type === "request-replacements") {
			lastEvent = readEvent(session.next([{ type: "leave-battle", target: { side: 0, slot: 0 } }]));
			break;
		}

		if (result.done) {
			lastEvent = event;
			break;
		}
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.winnerSide).toBe(1);
});

test("a side can leave the battle during turn input when escape is allowed", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createBulby()]] },
			{ teams: [[createModestIvysaur()]] },
		],
		random: () => 1,
	});
	let session = battle.start();
	let lastEvent: BattleEvent | null = null;

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.winnerSide).toBe(1);
});

test("a trapped or disallowed side cannot leave during turn input", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulby()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let trappedCombatant = battle.state.sides[0].active[0]?.combatant;
	if (!trappedCombatant) throw new TypeError("Expected an active combatant.");
	trappedCombatant.volatile.trapped = true;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "VINE_WHIP",
		target: { side: 0, slot: 0 },
	});
	expect(battle.state.winnerSide).toBe(null);
});

test("Mean Look prevents leaving the battle on later turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createBulby()]] },
			{ teams: [[createIvysaurWithMeanLook()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	readEvent(
		session.next([
			{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		if (event.type === "turn-ended") break;
		if (result.done) throw new TypeError("Battle ended before Mean Look test could continue.");
	}

	expect(battle.state.sides[0].active[0]?.combatant.volatile.trapped).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });

	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected second turn command request.");
	}

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "RAZOR_LEAF",
		target: { side: 0, slot: 0 },
	});
	expect(battle.state.winnerSide).toBe(null);
});

test("a side can switch to a bench creature during turn input", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithTackle(), createBackupBulby()]] },
			{ teams: [[createModestIvysaur()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstEvent = readEvent(
		session.next([
			{ type: "switch", target: { side: 0, slot: 0 }, creature: 1 },
			{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstEvent).toEqual({
		type: "creature-switched",
		target: { side: 0, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[0].active[0]?.creatureIndex).toBe(1);
});

test("Growl lowers the target attack stage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithGrowl()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);
});

test("Safeguard blocks major status on the protected side", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithSafeguard()]] },
			{ teams: [[createModestIvysaurWithSleepPowder()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 0)).toBe(
		false,
	);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Mist blocks stat drops on the protected side", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithMist()]] }, { teams: [[createModestIvysaurWithGrowl()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		events.some((event) => event.type === "stat-stage-changed" && event.target.side === 0),
	).toBe(false);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
});

test("Growth raises the user's special attack stage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulby()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.SpecialAttack]).toBe(1);
});

test("Agility sharply raises the user's speed", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithAgility()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Speed,
		stages: 2,
		value: 2,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Speed]).toBe(2);
});

test("Bulk Up raises the user's attack and defense", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithBulkUp()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Defense,
		stages: 1,
		value: 1,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(1);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Defense]).toBe(1);
});

test("Tailwind doubles side speed and changes turn order", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithTailwind()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "EMBER",
		target: { side: 1, slot: 0 },
	});
});

test("Baby-Doll Eyes acts before a faster normal-priority move and lowers attack", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithBabyDollEyes()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "BABY_DOLL_EYES",
		target: { side: 1, slot: 0 },
	});

	let events = [firstResolutionEvent];
	while (true) {
		let result = session.next();
		let event = readEvent(result);
		events.push(event);
		if (event.type === "turn-ended") break;
		if (result.done || battle.state.phase !== "resolving-turn") break;
	}

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);
});

test("Reflect reduces physical damage on the protected side", () => {
	let withoutReflect = getOpeningDamage([
		{ teams: [[createBulbyWithTackle()]] },
		{ teams: [[createModestIvysaur()]] },
	]);
	let withReflectBattle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithReflect()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = withReflectBattle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, withReflectBattle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, withReflectBattle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let reflectedDamage = secondTurnEvents.find((event) => event.type === "damage-dealt");
	if (!reflectedDamage || reflectedDamage.type !== "damage-dealt") {
		throw new TypeError("Expected damage event.");
	}

	expect(reflectedDamage.damage).toBeLessThan(withoutReflect);
	expect(withReflectBattle.state.sides[0].effects.reflectTurns).toBeGreaterThan(0);
});

test("Brick Break clears Reflect on the target side", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithBrickBreak()]] },
			{ teams: [[createModestIvysaurWithReflect()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].effects.reflectTurns).toBeGreaterThan(0);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "side-effect-applied",
		side: 1,
		effect: "reflect",
		turns: 0,
	});
	expect(battle.state.sides[1].effects.reflectTurns).toBe(0);
});

test("Haze resets stat stages for both active combatants", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithHaze()]] }, { teams: [[createModestIvysaurWithGrowl()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 0,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
});

test("Clear Smog resets the target stat stages after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithClearSmog()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 0,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
});

test("Defog clears hazards from both sides", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithDefog()]] }, { teams: [[createModestIvysaurWithSpikes()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].effects.spikesLayers).toBe(1);

	battle.state.sides[1].effects.stealthRock = true;

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "side-effect-applied",
		side: 0,
		effect: "spikes",
		turns: 0,
	});
	expect(events).toContainEqual({
		type: "side-effect-applied",
		side: 1,
		effect: "stealth-rock",
		turns: 0,
	});
	expect(battle.state.sides[0].effects.spikesLayers).toBe(0);
	expect(battle.state.sides[1].effects.stealthRock).toBe(false);
});

test("Trick Room reverses speed order on the following turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithTrickRoom()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "TACKLE",
		target: { side: 1, slot: 0 },
	});
});

test("Rain Dance applies rain to the shared field", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithRainDance()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({ type: "field-effect-applied", effect: "rain", turns: 5 });
	expect(battle.state.field.weather).toBe("rain");
	expect(battle.state.field.weatherTurns).toBe(4);
});

test("Grassy Terrain applies grassy terrain to the shared field", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithGrassyTerrain()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "field-effect-applied",
		effect: "grassy-terrain",
		turns: 5,
	});
	expect(battle.state.field.terrain).toBe("grassy");
	expect(battle.state.field.terrainTurns).toBe(4);
});

test("Grassy Terrain heals grounded combatants at the end of the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedBulbyWithGrassyTerrain()]] },
			{ teams: [[createModestIvysaur()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let beforeDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let healedEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0 && event.damage === 0,
	);
	let afterDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;

	expect(healedEvent).toBeDefined();
	expect(afterDamage).toBeLessThan(beforeDamage);
});

test("Gravity applies gravity turns to the shared field", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithGravity()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({ type: "field-effect-applied", effect: "gravity", turns: 5 });
	expect(battle.state.field.gravityTurns).toBe(4);
});

test("Spikes damages a creature that switches in", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithSpikes()]] },
			{ teams: [[createModestIvysaurWithTackle(), createBackupIvysaur()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(battle.state.sides[1].effects.spikesLayers).toBe(1);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 0 },
	]);

	expect(events).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "spikes",
	});
});

test("Protect prevents direct damage for the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithProtect()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "protect",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		false,
	);
});

test("Protect blocks targeted status effects for the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithProtect()]] },
			{ teams: [[createModestIvysaurWithSleepPowder()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 0)).toBe(
		false,
	);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Detect protects like Protect", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithDetect()]] }, { teams: [[createModestIvysaurWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "protect",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		false,
	);
});

test("Endure leaves the user at 1 HP against lethal damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpBulbyWithEndure()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "endure",
	});
	let active = battle.state.sides[0].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	expect(getCreatureCurrentHP(GAME_DATA, active.creature)).toBe(1);
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 0)).toBe(
		false,
	);
});

test("False Swipe cannot knock out the target", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFalseSwipe()]] },
			{ teams: [[createLowHpIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let active = battle.state.sides[1].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	expect(getCreatureCurrentHP(GAME_DATA, active.creature)).toBe(1);
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 1)).toBe(
		false,
	);
});

test("Belly Drum costs half max HP and maximizes attack", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithBellyDrum()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let maxHP = getCreatureCurrentHP(GAME_DATA, user.creature);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 6,
		value: 6,
	});
	expect(user.statStages[Stat.Attack]).toBe(6);
	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(maxHP - Math.floor(maxHP / 2));
});

test("Jump Kick crash damage is applied when the move misses", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithJumpKick()]] },
			{ teams: [[createModestIvysaurWithSandAttack()]] },
		],
		random: createRandomSequence(1, 1, 0.99),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let maxHP = getCreatureCurrentHP(GAME_DATA, user.creature);
	let hpBeforeMiss = maxHP;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-missed",
		user: { side: 0, slot: 0 },
		target: { side: 1, slot: 0 },
	});
	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(hpBeforeMiss - Math.floor(maxHP / 2));
});

test("Fake Out only works on the user's first action", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFakeOut()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "volatile-applied",
		target: { side: 1, slot: 0 },
		effect: "flinch",
	});
	expect(firstTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(
		false,
	);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "move-used" && event.user.side === 0),
	).toBe(false);
	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
});

test("Feint breaks protection and still deals damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithFeint()]] }, { teams: [[createModestIvysaurWithDetect()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "DETECT",
		target: { side: 0, slot: 0 },
	});
	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "FEINT",
		target: { side: 1, slot: 0 },
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
});

test("Confuse Ray applies confusion to the target", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithConfuseRay()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 1, slot: 0 },
		effect: "confusion",
	});
	expect(battle.state.sides[1].active[0]?.combatant.volatile.confusionTurns).toBe(2);
});

test("Fly spends one turn charging, avoids later attacks, then hits on the next turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithFly()]] }, { teams: [[createModestIvysaurWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].active[0]?.combatant.volatile.charging).toBe(true);
	expect(
		firstTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 0),
	).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "FLY",
		target: { side: 1, slot: 0 },
	});
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].active[0]?.combatant.volatile.charging).toBe(false);
	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
	let secondTurnFirstDamage = secondTurnEvents.find((event) => event.type === "damage-dealt");
	if (!secondTurnFirstDamage || secondTurnFirstDamage.type !== "damage-dealt") {
		throw new TypeError("Expected damage event from Fly.");
	}
	expect(secondTurnFirstDamage.target).toEqual({ side: 1, slot: 0 });
});

test("confused combatants can lose their action and hurt themselves", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithConfuseRay()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: createRandomSequence(1, 1, 0),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(false);
	let selfDamage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!selfDamage || selfDamage.type !== "damage-dealt") {
		throw new TypeError("Expected confusion self-hit damage.");
	}
	expect(selfDamage.damage).toBeGreaterThan(0);
});

test("Light Screen reduces special damage on the protected side", () => {
	let withoutLightScreen = getOpeningDamage([
		{ teams: [[createBulbyWithEmber()]] },
		{ teams: [[createModestIvysaur()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithLightScreen()]] },
			{ teams: [[createModestIvysaurWithEmber()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let screenedDamage = secondTurnEvents.find((event) => event.type === "damage-dealt");
	if (!screenedDamage || screenedDamage.type !== "damage-dealt") {
		throw new TypeError("Expected special damage event.");
	}

	expect(screenedDamage.damage).toBeLessThan(withoutLightScreen);
	expect(battle.state.sides[0].effects.lightScreenTurns).toBeGreaterThan(0);
});

test("Dragon Rage deals fixed damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithDragonRage()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt")
		throw new TypeError("Expected Dragon Rage damage.");
	expect(damage.damage).toBe(40);
});

test("Brine deals more damage to a target below half HP", () => {
	let healthyDamage = getOpeningDamage([
		{ teams: [[createBulbyWithBrine()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithBrine()]] },
			{ teams: [[createBelowHalfHpIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Brine damage.");

	expect(damage.damage).toBeGreaterThan(healthyDamage);
});

test("Hex deals more damage to a statused target", () => {
	let healthyDamage = getOpeningDamage([
		{ teams: [[createBulbyWithHex()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithHex()]] }, { teams: [[createParalyzedIvysaurWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Hex damage.");

	expect(damage.damage).toBeGreaterThan(healthyDamage);
});

test("Electro Ball deals more damage when the user is much faster", () => {
	let slowerDamage = getFirstDamageDealt([
		{ teams: [[createBraveBulbyWithElectroBall()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);
	let fasterDamage = getFirstDamageDealt([
		{ teams: [[createFastBulbyWithElectroBall()]] },
		{ teams: [[createSlowIvysaurWithTackle()]] },
	]);

	expect(fasterDamage).toBeGreaterThan(slowerDamage);
});

test("Gyro Ball deals more damage when the user is much slower", () => {
	let fasterUserDamage = getFirstDamageDealt([
		{ teams: [[createFastBulbyWithGyroBall()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);
	let slowerUserDamage = getFirstDamageDealt([
		{ teams: [[createBraveBulbyWithGyroBall()]] },
		{ teams: [[createFastIvysaurWithTackle()]] },
	]);

	expect(slowerUserDamage).toBeGreaterThan(fasterUserDamage);
});

test("Flail deals more damage at low HP", () => {
	let healthyDamage = getFirstDamageDealt([
		{ teams: [[createBulbyWithFlail()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpBulbyWithFlail()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Flail damage.");

	expect(damage.damage).toBeGreaterThan(healthyDamage);
});

test("Endeavor deals damage equal to the HP gap between target and user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpBulbyWithEndeavor()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	let target = battle.state.sides[1].active[0]?.combatant;
	if (!user || !target) throw new TypeError("Expected active combatants.");
	let expectedDamage =
		getCreatureCurrentHP(GAME_DATA, target.creature) -
		getCreatureCurrentHP(GAME_DATA, user.creature);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Endeavor damage.");

	expect(damage.damage).toBe(expectedDamage);
	expect(getCreatureCurrentHP(GAME_DATA, target.creature)).toBe(
		getCreatureCurrentHP(GAME_DATA, user.creature),
	);
});

test("Heavy Slam deals more damage to lighter targets", () => {
	let veryLightTargetDamage = getFirstDamageDealt([
		{ teams: [[createSnorlaxWithHeavySlam()]] },
		{ teams: [[createJigglypuffWithTackle()]] },
	]);
	let heavierTargetDamage = getFirstDamageDealt([
		{ teams: [[createSnorlaxWithHeavySlam()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);

	expect(veryLightTargetDamage).toBeGreaterThan(heavierTargetDamage);
});

test("Follow Me redirects an attack from an ally to the user in doubles", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFollowMe(), createBackupBulby()]] },
			{ teams: [[createModestIvysaurWithTackle(), createBackupIvysaur()]] },
		],
		slots: 2,
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 1 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 1 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
	expect(
		firstTurnEvents.some(
			(event) =>
				event.type === "damage-dealt" && event.target.side === 0 && event.target.slot === 0,
		),
	).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 1 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 1 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 1 },
	});
	expect(
		secondTurnEvents.some(
			(event) =>
				event.type === "damage-dealt" && event.target.side === 0 && event.target.slot === 1,
		),
	).toBe(true);
});

test("Dragon Tail forces the target to switch after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithDragonTail()]] },
			{ teams: [[createModestIvysaurWithTackle(), createBackupIvysaur()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "creature-switched",
		target: { side: 1, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[1].active[0]?.creatureIndex).toBe(1);
});

test("Roar forces the target to switch without dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithRoar()]] },
			{ teams: [[createSlowIvysaurWithTackle(), createBackupIvysaur()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
	expect(events).toContainEqual({
		type: "creature-switched",
		target: { side: 1, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[1].active[0]?.creatureIndex).toBe(1);
});

test("Baton Pass switches the user and preserves stat stages", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithBatonPass(), createBackupBulby()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let active = battle.state.sides[0].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	active.statStages[Stat.Attack] = 2;
	active.statStages[Stat.Defense] = 1;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 }, creature: 1 },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "creature-switched",
		target: { side: 0, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[0].active[0]?.creatureIndex).toBe(1);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(2);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Defense]).toBe(1);
});

test("Future Sight deals damage at the end of a later turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFutureSight()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.delayedAttacks).toHaveLength(1);
	expect(battle.state.delayedAttacks[0]?.moveId).toBe("FUTURE_SIGHT");

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Charge doubles the user's next Electric attack once", () => {
	let normalDamage = getFirstDamageDealt([
		{ teams: [[createBulbyWithChargeBeam()]] },
		{ teams: [[createModestIvysaurWithGrowl()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithCharge()]] }, { teams: [[createModestIvysaurWithGrowl()]] }],
		random: createRandomSequence(1, 1, 1, 1),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = secondTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);
	if (!damage || damage.type !== "damage-dealt")
		throw new TypeError("Expected charged Electric damage.");

	expect(damage.damage).toBeGreaterThan(normalDamage);
});

test("Focus Energy raises the user's critical-hit chance", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFocusEnergy()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: createRandomSequence(0.1, 1),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({ type: "critical-hit", target: { side: 1, slot: 0 } });
});

test("Aqua Ring heals the user at the end of the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedBulbyWithAquaRing()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	let startingHP = getCreatureCurrentHP(
		GAME_DATA,
		battle.state.sides[0].active[0]!.combatant.creature,
	);
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let endingHP = getCreatureCurrentHP(
		GAME_DATA,
		battle.state.sides[0].active[0]!.combatant.creature,
	);
	expect(endingHP).toBeGreaterThan(startingHP);
});

test("Healing Wish restores the next replacement", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithHealingWish(), createDamagedParalyzedBackupBulby()]] },
			{ teams: [[createModestIvysaurWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let replacementRequest = readEvent(session.next());
	if (replacementRequest.type !== "request-replacements")
		throw new TypeError("Expected replacement request.");
	readEvent(session.next([{ type: "replace", target: { side: 0, slot: 0 }, creature: 1 }]));
	let replacement = battle.state.sides[0].active[0]?.combatant;
	if (!replacement) throw new TypeError("Expected replacement combatant.");

	expect(replacement.creature.status.state).toBe(null);
	expect(getCreatureCurrentHP(GAME_DATA, replacement.creature)).toBe(
		getCreatureStat(GAME_DATA, replacement.creature, Stat.HP),
	);
});

test("Curse boosts Attack and Defense and lowers Speed for non-Ghost users", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithCurse()]] }, { teams: [[createModestIvysaurWithGrowl()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Defense,
		stages: 1,
		value: 1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Speed,
		stages: -1,
		value: -1,
	});
});

test("Curse deals half the user's HP and curses the target for Ghost users", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createGastlyWithCurse()]] }, { teams: [[createModestIvysaurWithGrowl()]] }],
		random: () => 1,
	});
	let session = battle.start();

	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let maxHP = getCreatureStat(GAME_DATA, user.creature, Stat.HP);
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(maxHP - Math.floor(maxHP / 2));
	expect(battle.state.sides[1].active[0]?.combatant.volatile.cursed).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Assurance deals more damage after the target was already hit this turn", () => {
	let normalDamage = getFirstDamageDealt([
		{ teams: [[createBulbyWithAssurance()]] },
		{ teams: [[createModestIvysaurWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithAssurance()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let target = battle.state.sides[1].active[0]?.combatant;
	if (!target) throw new TypeError("Expected active target.");
	target.volatile.lastDamageThisTurn = {
		amount: 12,
		source: { side: 1, slot: 0 },
		moveClass: DamageClass.Physical,
	};
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Assurance damage.");

	expect(damage.damage).toBeGreaterThan(normalDamage);
});

test("Counter returns double the last physical damage taken", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithCounter()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let takenDamage = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0,
	);
	if (!takenDamage || takenDamage.type !== "damage-dealt")
		throw new TypeError("Expected damage taken.");
	let counterDamage = [...events]
		.reverse()
		.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!counterDamage || counterDamage.type !== "damage-dealt")
		throw new TypeError("Expected Counter damage.");

	expect(counterDamage.damage).toBe(takenDamage.damage * 2);
});

test("Destiny Bond makes the attacker faint after knocking out the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpBulbyWithDestinyBond()]] },
			{ teams: [[createJigglypuffWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "destiny-bond",
	});
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 0)).toBe(
		true,
	);
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 1)).toBe(
		true,
	);
});

test("Fell Stinger sharply raises attack after a knockout", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFellStinger()]] },
			{ teams: [[createLowHpIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 3,
		value: 3,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(3);
});

test("Focus Punch fails if the user was damaged earlier in the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFocusPunch()]] },
			{ teams: [[createModestIvysaurWithQuickAttack()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "disabled",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
});

test("Take Down deals recoil to the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithTakeDown()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		true,
	);
});

test("Sandstorm deals residual damage to non-immune combatants", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithSandstorm()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({ type: "field-effect-applied", effect: "sand", turns: 5 });
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(battle.state.field.weather).toBe("sand");
	expect(battle.state.field.weatherTurns).toBe(4);
});

test("Hyper Beam forces the user to recharge on the next turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithHyperBeam()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "recharge",
	});
});

test("Taunt prevents the target from using status moves", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithTaunt()]] }, { teams: [[createModestIvysaur()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 1, slot: 0 },
		reason: "taunt",
	});
});

test("Disable prevents using the disabled move slot", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithDisable()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 1, slot: 0 },
		reason: "disabled",
	});
});

test("Encore locks the target into its last successful move slot", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createModestIvysaurWithEncore()]] }, { teams: [[createBulbyWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let thirdTurnStarted = readEvent(session.next());
	expect(thirdTurnStarted).toEqual({ type: "turn-started", turn: 3 });
	let thirdRequest = readEvent(session.next());
	if (thirdRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "EMBER",
		target: { side: 0, slot: 0 },
	});
	expect(battle.state.sides[1].active[0]?.combatant.volatile.encoredMoveSlot).toBe(1);
});

test("Identify lets Normal moves hit a Ghost target on later turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithIdentify()]] }, { teams: [[createGastlyWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "volatile-applied",
		target: { side: 1, slot: 0 },
		effect: "identify",
	});
	expect(battle.state.sides[1].active[0]?.combatant.volatile.identified).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Wrap traps and deals residual damage on later turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithWrap()]] }, { teams: [[createModestIvysaurWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.volatile.partiallyTrappedTurns).toBeGreaterThan(
		0,
	);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Double Slap can hit multiple times in one move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithDoubleSlap()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: createRandomSequence(1, 0.9),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let hits = events.filter((event) => event.type === "damage-dealt" && event.target.side === 1);
	expect(hits.length).toBeGreaterThan(1);
});

test("Sleep Powder applies sleep and sleeping combatants cannot act", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithSleepPowder()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: 3,
	});

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1),
	).toBe(false);
});

test("Hypnosis applies sleep and sleeping combatants cannot act", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithHypnosis()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: 3,
	});

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1),
	).toBe(false);
});

test("Absorb heals the user after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedBulbyWithAbsorb()]] },
			{ teams: [[createSleepingIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let beforeDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damageEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);
	let healedEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0 && event.damage === 0,
	);
	let afterDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;

	expect(damageEvent).toBeDefined();
	expect(healedEvent).toBeDefined();
	expect(afterDamage).toBeLessThan(beforeDamage);
});

test("Dream Eater heals the user when the target is asleep", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedBulbyWithDreamEater()]] },
			{ teams: [[createSleepingIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let beforeDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let healedEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0 && event.damage === 0,
	);
	let afterDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(healedEvent).toBeDefined();
	expect(afterDamage).toBeLessThan(beforeDamage);
});

test("accuracy drops can cause a move to miss", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithSandAttack()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: createRandomSequence(1, 0.9),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-missed",
		user: { side: 1, slot: 0 },
		target: { side: 0, slot: 0 },
	});
});

test("Glare applies guaranteed paralysis", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithGlare()]] }, { teams: [[createModestIvysaurWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Paralyzed,
	});
});

test("Dragon Breath can apply paralysis after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithDragonBreath()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Paralyzed,
	});
});

test("Metal Sound sharply lowers the target special defense", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithMetalSound()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.SpecialDefense,
		stages: -2,
		value: -2,
	});
});

test("Mud-Slap lowers the target accuracy after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithMudSlap()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: "accuracy",
		stages: -1,
		value: -1,
	});
});

test("Icy Wind deals damage and lowers the target speed", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithIcyWind()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Speed,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Speed]).toBe(-1);
});

test("Leaf Storm lowers the user's special attack after hitting", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithLeafStorm()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.SpecialAttack,
		stages: -2,
		value: -2,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.SpecialAttack]).toBe(-2);
});

test("Close Combat lowers the user's defenses after hitting", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithCloseCombat()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Defense,
		stages: -1,
		value: -1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.SpecialDefense,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Defense]).toBe(-1);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.SpecialDefense]).toBe(-1);
});

test("Self-Destruct knocks out the user after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithSelfDestruct()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 0, slot: 0 } });
	expect(battle.state.sides[0].active[0]).toBe(null);
});

test("Final Gambit deals damage equal to the user's HP and knocks out the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBulbyWithFinalGambit()]] },
			{ teams: [[createModestIvysaurWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let activeTarget = battle.state.sides[1].active[0]?.combatant.creature;
	if (!activeTarget) throw new TypeError("Expected active Final Gambit target.");
	let expectedDamage = getCreatureCurrentHP(GAME_DATA, activeTarget);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damageEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	if (!damageEvent || damageEvent.type !== "damage-dealt") {
		throw new TypeError("Expected Final Gambit damage event.");
	}

	expect(damageEvent.damage).toBe(expectedDamage);
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 0, slot: 0 } });
});

test("Thrash locks the user into repeated attacks and causes confusion after it ends", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createBulbyWithThrash()]] }, { teams: [[createModestIvysaurWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "THRASH",
		target: { side: 1, slot: 0 },
	});
	expect(battle.state.sides[0].active[0]?.combatant.volatile.rampageTurns).toBe(0);
	expect(battle.state.sides[0].active[0]?.combatant.volatile.confusionTurns).toBe(2);
});

test("an invalid team count for the battle format throws", () => {
	expect(
		() =>
			new Battle({
				gameData: GAME_DATA,
				slots: 3,
				sides: [
					{ teams: [[createBulby()], [createBackupBulby()]] },
					{ teams: [[createModestIvysaur()]] },
				],
			}),
	).toThrow("must provide either 1 team or 3 teams");
});

function createBulby() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["VINE_WHIP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithGrowl() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GROWL", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GROWL", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithTailwind() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TAILWIND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TAILWIND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithAgility() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["AGILITY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["AGILITY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithBulkUp() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BULK_UP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BULK_UP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithBabyDollEyes() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["BABY_DOLL_EYES", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BABY_DOLL_EYES", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithReflect() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithBrickBreak() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["BRICK_BREAK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BRICK_BREAK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithHaze() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HAZE", "GROWL", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HAZE", "GROWL", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithClearSmog() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CLEAR_SMOG", "GROWL", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CLEAR_SMOG", "GROWL", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithTrickRoom() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TRICK_ROOM", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TRICK_ROOM", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithRainDance() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["RAIN_DANCE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["RAIN_DANCE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithSafeguard() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SAFEGUARD", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SAFEGUARD", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithMist() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MIST", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MIST", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithGrassyTerrain() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GRASSY_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GRASSY_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedBulbyWithGrassyTerrain() {
	let creature = createBulbyWithGrassyTerrain();
	creature.status.damage = 16;
	return creature;
}

function createBulbyWithGravity() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GRAVITY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GRAVITY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithSandstorm() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SANDSTORM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SANDSTORM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithSpikes() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SPIKES", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SPIKES", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithDefog() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DEFOG", "SPIKES", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DEFOG", "SPIKES", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithProtect() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["PROTECT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["PROTECT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithDetect() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DETECT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DETECT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFakeOut() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FAKE_OUT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FAKE_OUT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFeint() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FEINT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FEINT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithConfuseRay() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CONFUSE_RAY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CONFUSE_RAY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithTackle() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFly() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FLY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FLY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithLightScreen() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["LIGHT_SCREEN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["LIGHT_SCREEN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithEmber() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["EMBER", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["EMBER", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithBrine() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BRINE", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BRINE", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithAssurance() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["ASSURANCE", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ASSURANCE", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithCounter() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["COUNTER", "GROWTH", "LEECH_SEED", "TACKLE"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["COUNTER", "GROWTH", "LEECH_SEED", "TACKLE"]),
	});
}

function createBulbyWithDragonTail() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["DRAGON_TAIL", "GROWTH", "LEECH_SEED", "TACKLE"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DRAGON_TAIL", "GROWTH", "LEECH_SEED", "TACKLE"]),
	});
}

function createBulbyWithFollowMe() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FOLLOW_ME", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FOLLOW_ME", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithRoar() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ROAR", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ROAR", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithBatonPass() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BATON_PASS", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BATON_PASS", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFutureSight() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FUTURE_SIGHT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FUTURE_SIGHT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithCharge() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CHARGE", "CHARGE_BEAM", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CHARGE", "CHARGE_BEAM", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithChargeBeam() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CHARGE_BEAM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CHARGE_BEAM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFocusEnergy() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FOCUS_ENERGY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FOCUS_ENERGY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithAquaRing() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["AQUA_RING", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["AQUA_RING", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithHealingWish() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HEALING_WISH", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HEALING_WISH", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithCurse() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["CURSE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CURSE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithDestinyBond() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DESTINY_BOND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DESTINY_BOND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFellStinger() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FELL_STINGER", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FELL_STINGER", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFocusPunch() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FOCUS_PUNCH", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FOCUS_PUNCH", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithHex() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HEX", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HEX", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBraveBulbyWithElectroBall() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastBulbyWithElectroBall() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBraveBulbyWithGyroBall() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastBulbyWithGyroBall() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFlail() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FLAIL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FLAIL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithEndeavor() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["ENDEAVOR", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ENDEAVOR", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createSnorlaxWithHeavySlam() {
	return new Creature({
		nickname: "Snorlax",
		species: "SNORLAX" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		size: { scale: 128, weight: 128 },
		moveset: ["HEAVY_SLAM", "TACKLE", "REST", "SNORE"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HEAVY_SLAM", "TACKLE", "REST", "SNORE"]),
	});
}

function createBulbyWithDragonRage() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DRAGON_RAGE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DRAGON_RAGE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithTakeDown() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TAKE_DOWN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TAKE_DOWN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithHyperBeam() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HYPER_BEAM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HYPER_BEAM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithTaunt() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TAUNT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TAUNT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithDisable() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DISABLE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DISABLE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithIdentify() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["IDENTIFY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["IDENTIFY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithWrap() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["WRAP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["WRAP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithDoubleSlap() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DOUBLE_SLAP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DOUBLE_SLAP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithSleepPowder() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SLEEP_POWDER", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SLEEP_POWDER", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithHypnosis() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HYPNOSIS", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HYPNOSIS", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithAbsorb() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ABSORB", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ABSORB", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedBulbyWithAbsorb() {
	let creature = createBulbyWithAbsorb();
	creature.status.damage = 16;
	return creature;
}

function createBulbyWithDreamEater() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DREAM_EATER", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DREAM_EATER", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedBulbyWithDreamEater() {
	let creature = createBulbyWithDreamEater();
	creature.status.damage = 16;
	return creature;
}

function createBulbyWithIcyWind() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ICY_WIND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ICY_WIND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithLeafStorm() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["LEAF_STORM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["LEAF_STORM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithCloseCombat() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["CLOSE_COMBAT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CLOSE_COMBAT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithSelfDestruct() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["SELF_DESTRUCT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SELF_DESTRUCT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFinalGambit() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FINAL_GAMBIT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FINAL_GAMBIT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithThrash() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["THRASH", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["THRASH", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithGlare() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GLARE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GLARE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithDragonBreath() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DRAGON_BREATH", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DRAGON_BREATH", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithMetalSound() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["METAL_SOUND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["METAL_SOUND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithMudSlap() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MUD_SLAP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MUD_SLAP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithSandAttack() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SAND_ATTACK", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SAND_ATTACK", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithEndure() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ENDURE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ENDURE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithFalseSwipe() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FALSE_SWIPE", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FALSE_SWIPE", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithBellyDrum() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["BELLY_DRUM", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BELLY_DRUM", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBulbyWithJumpKick() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["JUMP_KICK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["JUMP_KICK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createLowHpBulby() {
	let creature = createBulby();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpBulbyWithFlail() {
	let creature = createBulbyWithFlail();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpBulbyWithEndeavor() {
	let creature = createBulbyWithEndeavor();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpBulbyWithDestinyBond() {
	let creature = createBulbyWithDestinyBond();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createDamagedBulbyWithAquaRing() {
	let creature = createBulbyWithAquaRing();
	creature.status.damage = 20;
	return creature;
}

function createLowHpBulbyWithEndure() {
	let creature = createBulbyWithEndure();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpIvysaurWithTackle() {
	let creature = createModestIvysaurWithTackle();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createBelowHalfHpIvysaurWithTackle() {
	let creature = createModestIvysaurWithTackle();
	let maxHP = getCreatureCurrentHP(GAME_DATA, creature);
	creature.status.damage = Math.floor(maxHP / 2) + 10;
	return creature;
}

function createParalyzedIvysaurWithTackle() {
	let creature = createModestIvysaurWithTackle();
	creature.status.state = State.Paralyzed;
	return creature;
}

function createBackupBulby() {
	return new Creature({
		nickname: "Bulby II",
		species: "BULBASAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "VINE_WHIP", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "VINE_WHIP", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedParalyzedBackupBulby() {
	let creature = createBackupBulby();
	creature.status.damage = 20;
	creature.status.state = State.Paralyzed;
	return creature;
}

function createBackupIvysaur() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaur() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithTackle() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createSlowIvysaurWithTackle() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastIvysaurWithTackle() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createJigglypuffWithTackle() {
	return new Creature({
		species: "JIGGLYPUFF" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "POUND", "REST", "SING"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "POUND", "REST", "SING"]),
	});
}

function createModestIvysaurWithDetect() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DETECT", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DETECT", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithEmber() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["EMBER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["EMBER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithEncore() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ENCORE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ENCORE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithGrowl() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GROWL", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GROWL", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithReflect() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithSpikes() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SPIKES", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SPIKES", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithSandAttack() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SAND_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SAND_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithSleepPowder() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SLEEP_POWDER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SLEEP_POWDER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createSleepingIvysaurWithTackle() {
	let creature = createModestIvysaurWithTackle();
	creature.status.state = State.Asleep;
	return creature;
}

function createIvysaurWithMeanLook() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MEAN_LOOK", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MEAN_LOOK", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createBraveBulbyWithQuickAttack() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBraveBulbyWithExtremeSpeed() {
	return new Creature({
		nickname: "Bulby",
		species: "BULBASAUR" as SpeciesId,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["EXTREME_SPEED", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["EXTREME_SPEED", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestIvysaurWithQuickAttack() {
	return new Creature({
		species: "IVYSAUR" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createGastlyWithTackle() {
	return new Creature({
		species: "GASTLY" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"]),
	});
}

function createGastlyWithCurse() {
	return new Creature({
		species: "GASTLY" as SpeciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CURSE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CURSE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"]),
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

function createStatus(moveset: [string, string, string, string]) {
	return {
		state: null,
		damage: 0,
		pp: getMovePP(
			moveset[0] as keyof typeof MOVES,
			moveset[1] as keyof typeof MOVES,
			moveset[2] as keyof typeof MOVES,
			moveset[3] as keyof typeof MOVES,
		),
	};
}

function getMovePP(
	move1: keyof typeof MOVES,
	move2: keyof typeof MOVES,
	move3: keyof typeof MOVES,
	move4: keyof typeof MOVES,
) {
	return [MOVES[move1].pp, MOVES[move2].pp, MOVES[move3].pp, MOVES[move4].pp] as [
		number,
		number,
		number,
		number,
	];
}

function readEvent(result: IteratorResult<BattleEvent, BattleEvent>) {
	if (result.done) return result.value;
	return result.value;
}

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

function getOpeningDamage(sides: ConstructorParameters<typeof Battle>[0]["sides"]) {
	let battle = new Battle({ gameData: GAME_DATA, sides, random: () => 1 });
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt")
		throw new TypeError("Expected opening damage event.");
	return damage.damage;
}

function getFirstDamageDealt(sides: ConstructorParameters<typeof Battle>[0]["sides"]) {
	let battle = new Battle({ gameData: GAME_DATA, sides, random: () => 1 });
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") {
		throw new TypeError("Expected first damage event.");
	}

	return damage.damage;
}

function createRandomSequence(...values: number[]) {
	let index = 0;
	return () => {
		let value = values[index] ?? values.at(-1) ?? 0;
		index += 1;
		return value;
	};
}
