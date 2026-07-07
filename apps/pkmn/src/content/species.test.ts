/**
 * Guards the authored species roster's effort value (EV) yields against typos and omissions.
 *
 * Every one of the original 151 species must carry an `evYield` that is a partial stat set of
 * non-negative integers keyed only by valid {@link Stat} values and summing to a small total.
 * These checks fail loudly if a roster entry is added without a yield or with an out-of-range
 * value, keeping the content layer's EV data trustworthy for the experience system.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { isLevelUpMove } from "~/game/data/species";
import { Stat } from "~/game/data/stat";

import { MOVES } from "./moves";
import { SPECIES } from "./species";

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
