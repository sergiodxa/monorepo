import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import { Type as ItemType } from "../domain/item";
import { Class, Effect } from "../domain/move";
import { Stat } from "../domain/stat";
import { Type } from "../domain/type";

import { createGameData } from "./game-data";

describe(createGameData, () => {
	test("returns indexed maps for valid content", () => {
		let result = createGameData({
			species: {
				TESTMON: {
					number: 1,
					types: [Type.GRASS],
					baseExperience: 1,
					catchRate: 255,
					growthRate: 1,
					stats: {
						[Stat.HP]: 45,
						[Stat.Attack]: 49,
						[Stat.Defense]: 49,
						[Stat.SpecialAttack]: 65,
						[Stat.SpecialDefense]: 65,
						[Stat.Speed]: 45,
					},
					evolutions: [],
					learnset: [{ level: 1, moveId: "TACKLE" }],
					gender: { 0: 87.5, 1: 12.5 },
				},
			},
			moves: {
				TACKLE: {
					type: Type.NORMAL,
					class: Class.Physical,
					power: 40,
					accuracy: 100,
					pp: 35,
					effect: Effect.NO_ADDITIONAL_EFFECT,
				},
			},
			items: {
				HM01: { type: ItemType.HM, price: { buy: 1000, sell: 500 }, teachesMoveId: "TACKLE" },
			},
			natures: {
				HARDY: { increases: null, decreases: null },
			},
			typeChart: {
				[Type.BUG]: {},
				[Type.DARK]: {},
				[Type.DRAGON]: {},
				[Type.ELECTRIC]: {},
				[Type.FAIRY]: {},
				[Type.FIGHTING]: {},
				[Type.FIRE]: {},
				[Type.FLYING]: {},
				[Type.GHOST]: {},
				[Type.GRASS]: {},
				[Type.GROUND]: {},
				[Type.ICE]: {},
				[Type.NORMAL]: {},
				[Type.POISON]: {},
				[Type.PSYCHIC]: {},
				[Type.ROCK]: {},
				[Type.STEEL]: {},
				[Type.WATER]: {},
			},
		});

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.species.get("TESTMON")).toBeDefined();
			expect(result.data.moves.get("TACKLE")).toBeDefined();
		}
	});

	test("fails when a species learnset references a missing move", () => {
		let result = createGameData({
			species: {
				TESTMON: {
					number: 1,
					types: [Type.GRASS],
					baseExperience: 1,
					catchRate: 255,
					growthRate: 1,
					stats: {
						[Stat.HP]: 45,
						[Stat.Attack]: 49,
						[Stat.Defense]: 49,
						[Stat.SpecialAttack]: 65,
						[Stat.SpecialDefense]: 65,
						[Stat.Speed]: 45,
					},
					evolutions: [],
					learnset: [{ level: 1, moveId: "MISSING_MOVE" }],
					gender: { 0: 87.5, 1: 12.5 },
				},
			},
			moves: {},
			items: {},
			natures: {
				HARDY: { increases: null, decreases: null },
			},
			typeChart: {
				[Type.BUG]: {},
				[Type.DARK]: {},
				[Type.DRAGON]: {},
				[Type.ELECTRIC]: {},
				[Type.FAIRY]: {},
				[Type.FIGHTING]: {},
				[Type.FIRE]: {},
				[Type.FLYING]: {},
				[Type.GHOST]: {},
				[Type.GRASS]: {},
				[Type.GROUND]: {},
				[Type.ICE]: {},
				[Type.NORMAL]: {},
				[Type.POISON]: {},
				[Type.PSYCHIC]: {},
				[Type.ROCK]: {},
				[Type.STEEL]: {},
				[Type.WATER]: {},
			},
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toContain("missing move MISSING_MOVE");
		}
	});
});
