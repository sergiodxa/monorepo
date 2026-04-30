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
import { Stat } from "../domain/stat";

import type { BattleEvent } from "./battle";

import { Battle } from "./battle";
import { Creature } from "./creature";
import { getCreatureCurrentHP } from "./mechanics";

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
		{ type: "damage-dealt", target: { side: 0, slot: 0 }, damage: 73, remainingHP: 0 },
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

function createLowHpBulby() {
	let creature = createBulby();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
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
