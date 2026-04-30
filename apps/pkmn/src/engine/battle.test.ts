import { expect, test } from "bun:test";

import type { Nature } from "~/domain/nature";
import type { Species } from "~/domain/species";

import { GAME_DATA } from "~/content/game-data";

import { MOVES } from "../content/moves";
import { Stat } from "../domain/stat";

import { Battle } from "./battle";
import { Creature } from "./creature";
import { getCreatureCurrentHP } from "./mechanics";

const bulby = new Creature({
	nickname: "Bulby",
	species: "BULBASAUR" as Species.Symbol,
	nature: "MODEST" as Nature.Symbol,
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
	species: "IVYSAUR" as Species.Symbol,
	nature: "BRAVE" as Nature.Symbol,
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

	while (!battle.fainted) {
		battle.attack(1);
	}

	expect(getCreatureCurrentHP(GAME_DATA, ivysaur)).toBe(0);
});
