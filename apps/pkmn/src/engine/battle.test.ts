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

const GAME_DATA = unwrap(
	GameData.create({
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	}),
);

const bulby = new Creature({
	nickname: "Bulby",
	species: "BULBASAUR" as SpeciesId,
	nature: "MODEST" as NatureId,
	experience: 1000000,
	moveset: ["VINE_WHIP", "EMBER", "GROWTH", "LEECH_SEED"],
	iv: {
		[Stat.HP]: 31,
		[Stat.Attack]: 31,
		[Stat.Defense]: 31,
		[Stat.SpecialAttack]: 31,
		[Stat.SpecialDefense]: 31,
		[Stat.Speed]: 31,
	},
	ev: {
		[Stat.HP]: 255,
		[Stat.Attack]: 255,
		[Stat.Defense]: 0,
		[Stat.SpecialAttack]: 0,
		[Stat.SpecialDefense]: 0,
		[Stat.Speed]: 0,
	},
	status: {
		state: null,
		damage: 0,
		pp: [MOVES["VINE_WHIP"].pp, MOVES["RAZOR_LEAF"].pp, MOVES["GROWTH"].pp, MOVES["LEECH_SEED"].pp],
	},
});

const ivysaur = new Creature({
	species: "IVYSAUR" as SpeciesId,
	nature: "BRAVE" as NatureId,
	experience: 1000000,
	moveset: ["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
	iv: {
		[Stat.HP]: 31,
		[Stat.Attack]: 31,
		[Stat.Defense]: 31,
		[Stat.SpecialAttack]: 31,
		[Stat.SpecialDefense]: 31,
		[Stat.Speed]: 31,
	},
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
		pp: [MOVES["VINE_WHIP"].pp, MOVES["RAZOR_LEAF"].pp, MOVES["GROWTH"].pp, MOVES["LEECH_SEED"].pp],
	},
});

test("Bulby uses Leech Seed on Ivysaur", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		creatures: [bulby, ivysaur],
		random: () => 0,
	});
	let session = battle.start();
	let events: BattleEvent[] = [];

	events.push(readEvent(session.next()));
	events.push(readEvent(session.next()));

	while (battle.state.phase !== "finished") {
		events.push(
			readEvent(
				session.next([
					{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
					{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
				]),
			),
		);

		while (battle.state.phase === "resolving-turn") {
			let result = session.next();
			events.push(readEvent(result));
			if (result.done) break;
		}
	}

	expect(events.some((event) => event.type === "move-used")).toBe(true);
	expect(events.some((event) => event.type === "damage-dealt")).toBe(true);
	expect(events.at(-1)).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(getCreatureCurrentHP(GAME_DATA, bulby)).toBe(0);
	expect(events).toEqual([
		{ type: "battle-started" },
		{ type: "turn-started", turn: 1 },
		{
			type: "action-required",
			requests: [
				{ side: 0, slot: 0 },
				{ side: 1, slot: 0 },
			],
		},
		{
			type: "move-used",
			user: { side: 0, slot: 0 },
			moveId: "EMBER",
			target: { side: 1, slot: 0 },
		},
		{
			type: "effectiveness",
			target: { side: 1, slot: 0 },
			effectiveness: 2,
		},
		{ type: "critical-hit", target: { side: 1, slot: 0 } },
		{ type: "damage-dealt", target: { side: 1, slot: 0 }, damage: 84, remainingHP: 177 },
		{ type: "status-applied", target: { side: 1, slot: 0 }, status: 0 },
		{
			type: "move-used",
			user: { side: 1, slot: 0 },
			moveId: "RAZOR_LEAF",
			target: { side: 0, slot: 0 },
		},
		{ type: "critical-hit", target: { side: 0, slot: 0 } },
		{ type: "damage-dealt", target: { side: 0, slot: 0 }, damage: 118, remainingHP: 176 },
		{ type: "turn-ended", turn: 1 },
		{ type: "turn-started", turn: 2 },
		{
			type: "action-required",
			requests: [
				{ side: 0, slot: 0 },
				{ side: 1, slot: 0 },
			],
		},
		{
			type: "move-used",
			user: { side: 0, slot: 0 },
			moveId: "EMBER",
			target: { side: 1, slot: 0 },
		},
		{ type: "effectiveness", target: { side: 1, slot: 0 }, effectiveness: 2 },
		{ type: "critical-hit", target: { side: 1, slot: 0 } },
		{ type: "damage-dealt", target: { side: 1, slot: 0 }, damage: 84, remainingHP: 93 },
		{
			type: "move-used",
			user: { side: 1, slot: 0 },
			moveId: "RAZOR_LEAF",
			target: { side: 0, slot: 0 },
		},
		{ type: "critical-hit", target: { side: 0, slot: 0 } },
		{ type: "damage-dealt", target: { side: 0, slot: 0 }, damage: 118, remainingHP: 58 },
		{ type: "turn-ended", turn: 2 },
		{ type: "turn-started", turn: 3 },
		{
			type: "action-required",
			requests: [
				{ side: 0, slot: 0 },
				{ side: 1, slot: 0 },
			],
		},
		{
			type: "move-used",
			user: { side: 0, slot: 0 },
			moveId: "EMBER",
			target: { side: 1, slot: 0 },
		},
		{ type: "effectiveness", target: { side: 1, slot: 0 }, effectiveness: 2 },
		{ type: "critical-hit", target: { side: 1, slot: 0 } },
		{ type: "damage-dealt", target: { side: 1, slot: 0 }, damage: 84, remainingHP: 9 },
		{
			type: "move-used",
			user: { side: 1, slot: 0 },
			moveId: "RAZOR_LEAF",
			target: { side: 0, slot: 0 },
		},
		{ type: "critical-hit", target: { side: 0, slot: 0 } },
		{ type: "damage-dealt", target: { side: 0, slot: 0 }, damage: 118, remainingHP: 0 },
		{ type: "creature-fainted", target: { side: 0, slot: 0 } },
		{ type: "battle-finished", winnerSide: 1 },
	]);
});

function readEvent(result: IteratorResult<BattleEvent, BattleEvent>) {
	if (result.done) return result.value;
	return result.value;
}
