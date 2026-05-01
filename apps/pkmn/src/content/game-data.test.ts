import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import { GameData } from "../domain/game-data";
import { GrowthRate } from "../domain/growth-rate";
import { Type as ItemType } from "../domain/item";
import { Class, StatusEffectType } from "../domain/move";
import { Stat } from "../domain/stat";
import { Type } from "../domain/type";

import { SPECIES } from "./species";

describe(GameData.create, () => {
	test("returns indexed maps for valid content", () => {
		let result = GameData.create({
			species: {
				TESTMON: {
					number: 1,
					size: { weight: 6.9, height: 0.7 },
					types: [Type.GRASS],
					baseExperience: 1,
					catchRate: 255,
					growthRate: GrowthRate.MediumFast,
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
					effect: { kind: "none" },
				},
				EMBER: {
					type: Type.FIRE,
					class: Class.Special,
					power: 40,
					accuracy: 100,
					pp: 25,
					effect: { kind: "apply-status", status: StatusEffectType.Burn, chance: 0.1 },
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

	test("ships the full original 151 species roster with modern typings", () => {
		expect(Object.keys(SPECIES)).toHaveLength(151);
		let clefairy = SPECIES.CLEFAIRY;
		let jigglypuff = SPECIES.JIGGLYPUFF;
		let mrMime = SPECIES.MR_MIME;
		let magnemite = SPECIES.MAGNEMITE;
		let gengar = SPECIES.GENGAR;

		expect(clefairy).toBeDefined();
		expect(jigglypuff).toBeDefined();
		expect(mrMime).toBeDefined();
		expect(magnemite).toBeDefined();
		expect(gengar).toBeDefined();

		if (!clefairy || !jigglypuff || !mrMime || !magnemite || !gengar) {
			throw new TypeError("Expected modern-typed Kanto species to be present.");
		}

		expect(clefairy.types).toEqual([Type.FAIRY]);
		expect(jigglypuff.types).toEqual([Type.NORMAL, Type.FAIRY]);
		expect(mrMime.types).toEqual([Type.PSYCHIC, Type.FAIRY]);
		expect(magnemite.types).toEqual([Type.ELECTRIC, Type.STEEL]);
		expect(gengar.types).toEqual([Type.GHOST, Type.POISON]);
	});

	test("fails when a species learnset references a missing move", () => {
		let result = GameData.create({
			species: {
				TESTMON: {
					number: 1,
					size: { weight: 6.9, height: 0.7 },
					types: [Type.GRASS],
					baseExperience: 1,
					catchRate: 255,
					growthRate: GrowthRate.MediumFast,
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
