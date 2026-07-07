/**
 * Guards the species roster loaded from `species.json` and the migration that put
 * it there.
 *
 * Every one of the original 151 species must carry an `evYield` that is a partial
 * stat set of non-negative integers keyed only by valid {@link Stat} values and
 * summing to a small total, so a data-file typo or omission fails loudly here.
 * The migration checks pin the roster count and a few well-known species' stats,
 * types, growth rate, gender, evolution, and learnset so the JSON re-typed through
 * {@link parseSpecies} keeps its exact values; a final group proves the loader
 * rejects malformed data instead of shipping a broken roster.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { EvolutionMethod } from "~/game/data/evolution";
import { GrowthRate } from "~/game/data/growth-rate";
import { EggGroup, Gender, isLevelUpMove } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";

import { MOVES } from "./moves";
import { SPECIES } from "./species";
import { parseSpecies } from "./species-schema";

/** Valid stat keys an EV yield is allowed to use. */
let STAT_VALUES = Object.values(Stat);

/** Highest combined EV a single species may yield on faint. */
let MAX_YIELD_TOTAL = 3;

/**
 * Species whose level-up learnsets were authored so wild-caught creatures learn
 * moves in normal play. These must each carry a non-empty, ascending level-up
 * learnset that references only real move ids.
 */
let AUTHORED_LEARNSET_SPECIES = ["RATICATE", "ARBOK", "PIKACHU", "RAICHU"];

test("the roster still holds the original 151 species", () => {
	expect(Object.keys(SPECIES)).toHaveLength(151);
});

describe("every species has a valid EV yield", () => {
	for (let [id, species] of Object.entries(SPECIES)) {
		test(`${id} yields a small partial stat set of non-negative integers`, () => {
			// The content layer guarantees a yield even though the contract type is optional.
			expect(species.evYield).toBeDefined();
			let yieldEntries = Object.entries(species.evYield ?? {});

			// A yield must award at least one effort value.
			expect(yieldEntries.length).toBeGreaterThan(0);

			let total = 0;
			for (let [stat, value] of yieldEntries) {
				expect(STAT_VALUES).toContain(stat as Stat);
				expect(Number.isInteger(value)).toBe(true);
				expect(value).toBeGreaterThan(0);
				total += value;
			}

			expect(total).toBeLessThanOrEqual(MAX_YIELD_TOTAL);
		});
	}
});

describe("newly-authored species have valid level-up learnsets", () => {
	for (let id of AUTHORED_LEARNSET_SPECIES) {
		test(`${id} learns moves by level-up`, () => {
			let species = SPECIES[id];
			expect(species).toBeDefined();

			let levelUpMoves = species!.learnset.filter(isLevelUpMove);

			// A wild-caught creature of this species must be able to learn moves.
			expect(levelUpMoves.length).toBeGreaterThan(0);

			let previousLevel = -1;
			for (let entry of levelUpMoves) {
				// Entries are sorted ascending by level (ties allowed).
				expect(entry.level).toBeGreaterThanOrEqual(previousLevel);
				previousLevel = entry.level;

				// Every referenced move id resolves in the move roster.
				expect(MOVES).toHaveProperty(entry.moveId);
			}
		});
	}
});

describe("the JSON migration preserves known species", () => {
	test("BULBASAUR keeps its stats, types, growth rate, gender, evolution, and learnset", () => {
		let bulbasaur = SPECIES.BULBASAUR;
		expect(bulbasaur).toBeDefined();
		expect(bulbasaur!.number).toBe(1);
		expect(bulbasaur!.types).toEqual([Type.GRASS, Type.POISON]);
		expect(bulbasaur!.growthRate).toBe(GrowthRate.MediumFast);
		expect(bulbasaur!.stats).toEqual({
			[Stat.HP]: 45,
			[Stat.Attack]: 49,
			[Stat.Defense]: 49,
			[Stat.SpecialAttack]: 65,
			[Stat.SpecialDefense]: 65,
			[Stat.Speed]: 45,
		});
		expect(bulbasaur!.gender).toEqual({ [Gender.Male]: 87.5, [Gender.Female]: 12.5 });
		expect(bulbasaur!.evolutions).toEqual([
			{ method: EvolutionMethod.Level, speciesId: "IVYSAUR", level: 16 },
		]);
		expect(bulbasaur!.learnset[0]).toEqual({ level: 1, moveId: "GROWL" });
	});

	test("CHARIZARD keeps its dual typing and stats", () => {
		let charizard = SPECIES.CHARIZARD;
		expect(charizard).toBeDefined();
		expect(charizard!.number).toBe(6);
		expect(charizard!.types).toEqual([Type.FIRE, Type.FLYING]);
		expect(charizard!.stats[Stat.Speed]).toBe(100);
	});

	test("MEW keeps its single typing, growth rate, and empty evolutions", () => {
		let mew = SPECIES.MEW;
		expect(mew).toBeDefined();
		expect(mew!.number).toBe(151);
		expect(mew!.types).toEqual([Type.PSYCHIC]);
		expect(mew!.growthRate).toBe(GrowthRate.MediumFast);
		expect(mew!.evolutions).toEqual([]);
	});
});

describe("parseSpecies rejects malformed data", () => {
	/** A minimal, valid single-species map the cases below mutate to break one rule. */
	function validIndex(): unknown {
		return {
			BULBASAUR: {
				number: 1,
				size: { weight: 6.9, height: 0.7 },
				types: [Type.GRASS, Type.POISON],
				baseExperience: 64,
				catchRate: 45,
				growthRate: GrowthRate.MediumFast,
				stats: {
					[Stat.HP]: 45,
					[Stat.Attack]: 49,
					[Stat.Defense]: 49,
					[Stat.SpecialAttack]: 65,
					[Stat.SpecialDefense]: 65,
					[Stat.Speed]: 45,
				},
				evYield: { [Stat.SpecialAttack]: 1 },
				evolutions: [{ method: EvolutionMethod.Level, speciesId: "IVYSAUR", level: 16 }],
				learnset: [{ level: 1, moveId: "GROWL" }],
				gender: { [Gender.Male]: 87.5, [Gender.Female]: 12.5 },
				eggGroup: [EggGroup.Monster, EggGroup.Plant],
			},
		};
	}

	test("accepts a well-formed index", () => {
		expect(() => parseSpecies(validIndex())).not.toThrow();
	});

	let cases: Array<[label: string, mutate: (index: any) => void]> = [
		["a non-object value", () => undefined],
		["an unknown type value", (index) => (index.BULBASAUR.types = ["sparkle"])],
		["a missing stat key", (index) => delete index.BULBASAUR.stats[Stat.Speed]],
		["an unknown growth rate", (index) => (index.BULBASAUR.growthRate = "warp-speed")],
		["a fractional dex number", (index) => (index.BULBASAUR.number = 1.5)],
		["an unknown evolution method", (index) => (index.BULBASAUR.evolutions[0].method = "wish")],
		["an unknown egg group", (index) => (index.BULBASAUR.eggGroup = ["clouds"])],
		["a missing required field", (index) => delete index.BULBASAUR.stats],
	];

	for (let [label, mutate] of cases) {
		test(`rejects ${label}`, () => {
			let index = validIndex();
			if (label === "a non-object value") index = null;
			else mutate(index);
			expect(() => parseSpecies(index)).toThrow();
		});
	}
});
