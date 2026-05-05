/**
 * Exercises the `GameData` test module that verifies how structured game content is
 * assembled into runtime lookup tables and validated for internal consistency.
 *
 * This module documents the expected behavior of the data-loading boundary by
 * asserting successful indexing for valid inputs and preserving confidence that
 * curated content fixtures remain compatible with the engine-facing data model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess } from "@pkg/result";

import { SPECIES } from "~/content/species";

import { GameData } from "./game-data";
import { GrowthRate } from "./growth-rate";
import { ItemAttribute, ItemCategory } from "./item";
import { DamageClass, StatusEffectType } from "./move";
import { EggGroup, Gender } from "./species";
import { Stat } from "./stat";
import { Type } from "./type";

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
					gender: { [Gender.Male]: 87.5, [Gender.Female]: 12.5 },
					eggGroup: [EggGroup.Indeterminate],
				},
			},
			moves: {
				TACKLE: {
					type: Type.NORMAL,
					damageClass: DamageClass.Physical,
					power: 40,
					accuracy: 100,
					pp: 35,
					effect: { kind: "none" },
				},
				EMBER: {
					type: Type.FIRE,
					damageClass: DamageClass.Special,
					power: 40,
					accuracy: 100,
					pp: 25,
					effect: { kind: "apply-status", status: StatusEffectType.Burn, chance: 0.1 },
				},
			},
			items: {
				HM01: {
					category: ItemCategory.AllMachines,
					attributes: [ItemAttribute.Countable, ItemAttribute.UsableOverworld],
					price: { buy: 1000, sell: 500 },
					teachesMoveId: "TACKLE",
				},
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
		let monoFairyFixture = getSpeciesByNumber(35);
		let dualNormalFairyFixture = getSpeciesByNumber(39);
		let psychicFairyFixture = getSpeciesByNumber(122);
		let electricSteelFixture = getSpeciesByNumber(81);
		let ghostPoisonFixture = getSpeciesByNumber(94);

		expect(monoFairyFixture).toBeDefined();
		expect(dualNormalFairyFixture).toBeDefined();
		expect(psychicFairyFixture).toBeDefined();
		expect(electricSteelFixture).toBeDefined();
		expect(ghostPoisonFixture).toBeDefined();

		if (
			!monoFairyFixture ||
			!dualNormalFairyFixture ||
			!psychicFairyFixture ||
			!electricSteelFixture ||
			!ghostPoisonFixture
		) {
			throw new TypeError("Expected modern-typed Kanto species to be present.");
		}

		expect(monoFairyFixture.types).toEqual([Type.FAIRY]);
		expect(dualNormalFairyFixture.types).toEqual([Type.NORMAL, Type.FAIRY]);
		expect(psychicFairyFixture.types).toEqual([Type.PSYCHIC, Type.FAIRY]);
		expect(electricSteelFixture.types).toEqual([Type.ELECTRIC, Type.STEEL]);
		expect(ghostPoisonFixture.types).toEqual([Type.GHOST, Type.POISON]);
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
					gender: { [Gender.Male]: 87.5, [Gender.Female]: 12.5 },
					eggGroup: [EggGroup.Indeterminate],
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

function getSpeciesByNumber(number: number) {
	for (let species of Object.values(SPECIES)) {
		if (species.number === number) return species;
	}

	throw new ReferenceError(`Expected species #${number} to exist in test content.`);
}
