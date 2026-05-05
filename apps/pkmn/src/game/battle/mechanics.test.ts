/**
 * Verifies the battle mechanics test module for this game engine layer. This
 * module defines focused behavioral checks around deterministic combat-related
 * calculations so the surrounding battle domain can rely on stable, repeatable
 * outcomes during development.
 *
 * It also provides a compact fixture setup for exercising the exported
 * mechanics with representative in-memory data. By keeping these assertions in
 * a dedicated test module, the file documents the expected contract of the
 * mechanics helpers without coupling that contract to any particular content
 * set beyond what is minimally required for execution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { unwrap } from "@pkg/result";

import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";
import type { Species } from "~/game/data/species";

import { TYPE_MATCHUPS } from "~/content/matchups";
import { GameData } from "~/game/data/game-data";
import { GrowthRate } from "~/game/data/growth-rate";
import { EggGroup, Gender } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";
import { Creature } from "~/game/world/creature";

import {
	getCreatureLevel,
	getCreatureSize,
	getCreatureSizeClass,
	getExperienceForLevel,
} from "./mechanics";

let TEST_GAME_DATA = unwrap(
	GameData.create({
		species: {
			FASTMON: createSpecies(GrowthRate.Fast),
			MEDIUMFASTMON: createSpecies(GrowthRate.MediumFast),
			MEDIUMSLOWMON: createSpecies(GrowthRate.MediumSlow),
			SLOWMON: createSpecies(GrowthRate.Slow),
			FLUCTUATINGMON: createSpecies(GrowthRate.Fluctuating),
		},
		moves: {},
		items: {},
		natures: {
			HARDY: { increases: null, decreases: null },
		},
		typeChart: TYPE_MATCHUPS,
	}),
);

test("getExperienceForLevel returns exact experience thresholds", () => {
	expect(getExperienceForLevel(GrowthRate.Fast, 1)).toBe(0);
	expect(getExperienceForLevel(GrowthRate.Fast, 50)).toBe(100000);
	expect(getExperienceForLevel(GrowthRate.Fast, 100)).toBe(800000);

	expect(getExperienceForLevel(GrowthRate.MediumFast, 50)).toBe(125000);
	expect(getExperienceForLevel(GrowthRate.MediumFast, 100)).toBe(1000000);

	expect(getExperienceForLevel(GrowthRate.MediumSlow, 2)).toBe(9);
	expect(getExperienceForLevel(GrowthRate.MediumSlow, 50)).toBe(117360);
	expect(getExperienceForLevel(GrowthRate.MediumSlow, 100)).toBe(1059860);

	expect(getExperienceForLevel(GrowthRate.Slow, 50)).toBe(156250);
	expect(getExperienceForLevel(GrowthRate.Slow, 100)).toBe(1250000);

	expect(getExperienceForLevel(GrowthRate.Fluctuating, 2)).toBe(4);
	expect(getExperienceForLevel(GrowthRate.Fluctuating, 15)).toBe(1980);
	expect(getExperienceForLevel(GrowthRate.Fluctuating, 36)).toBe(46656);
	expect(getExperienceForLevel(GrowthRate.Fluctuating, 50)).toBe(142500);
	expect(getExperienceForLevel(GrowthRate.Fluctuating, 100)).toBe(1640000);
});

test("getCreatureLevel resolves the highest level allowed by experience", () => {
	let cases = [
		{ speciesId: "FASTMON" as SpeciesId, growthRate: GrowthRate.Fast },
		{ speciesId: "MEDIUMFASTMON" as SpeciesId, growthRate: GrowthRate.MediumFast },
		{ speciesId: "MEDIUMSLOWMON" as SpeciesId, growthRate: GrowthRate.MediumSlow },
		{ speciesId: "SLOWMON" as SpeciesId, growthRate: GrowthRate.Slow },
		{ speciesId: "FLUCTUATINGMON" as SpeciesId, growthRate: GrowthRate.Fluctuating },
	];

	for (let { speciesId, growthRate } of cases) {
		let exactThresholdCreature = createCreature(speciesId, getExperienceForLevel(growthRate, 50));
		let beforeNextLevelCreature = createCreature(
			speciesId,
			getExperienceForLevel(growthRate, 51) - 1,
		);
		let cappedCreature = createCreature(speciesId, getExperienceForLevel(growthRate, 100));

		expect(getCreatureLevel(TEST_GAME_DATA, exactThresholdCreature)).toBe(50);
		expect(getCreatureLevel(TEST_GAME_DATA, beforeNextLevelCreature)).toBe(50);
		expect(getCreatureLevel(TEST_GAME_DATA, cappedCreature)).toBe(100);
	}
});

test("getCreatureSize uses Gen 9 scale for height and keeps species weight", () => {
	let mediumCreature = createCreature("FASTMON" as SpeciesId, 1000);
	let tinyCreature = createCreature("FASTMON" as SpeciesId, 1000, { scale: 0, weight: 0 });
	let alphaCreature = createCreature("FASTMON" as SpeciesId, 1000, {
		scale: 255,
		weight: 255,
		alpha: true,
	});

	let mediumSize = getCreatureSize(TEST_GAME_DATA, mediumCreature);
	let alphaSize = getCreatureSize(TEST_GAME_DATA, alphaCreature);
	expect(mediumSize.weight).toBe(10);
	expect(mediumSize.height).toBeCloseTo(1.0007843137254901);
	expect(getCreatureSize(TEST_GAME_DATA, tinyCreature)).toEqual({ weight: 10, height: 0.8 });
	expect(alphaSize.weight).toBe(10);
	expect(alphaSize.height).toBeCloseTo(1.2);
	expect(getCreatureSizeClass(tinyCreature)).toBe("xs");
	expect(getCreatureSizeClass(mediumCreature)).toBe("md");
	expect(getCreatureSizeClass(alphaCreature)).toBe("alpha");
});

function createSpecies(growthRate: GrowthRate): Species {
	return {
		number: 1,
		size: { weight: 10, height: 1 },
		types: [Type.NORMAL],
		baseExperience: 64,
		catchRate: 255,
		growthRate,
		stats: {
			[Stat.HP]: 45,
			[Stat.Attack]: 49,
			[Stat.Defense]: 49,
			[Stat.SpecialAttack]: 65,
			[Stat.SpecialDefense]: 65,
			[Stat.Speed]: 45,
		},
		evolutions: [],
		learnset: [],
		gender: Gender.Genderless,
		eggGroup: [EggGroup.Indeterminate],
	};
}

function createCreature(
	speciesId: SpeciesId,
	experience: number,
	size: Creature.SizeData = { scale: 128, weight: 128 },
) {
	return new Creature({
		species: speciesId,
		nature: "HARDY" as NatureId,
		experience,
		size,
		moveset: ["TACKLE", null, null, null],
		status: {
			state: null,
			damage: 0,
			pp: [35, 0, 0, 0],
		},
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
	});
}
