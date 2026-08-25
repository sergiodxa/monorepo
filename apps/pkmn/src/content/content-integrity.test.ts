/**
 * Content-integrity regression net for the authored data collections.
 *
 * Each invariant is its own `test(...)` naming the offending id, so an authoring
 * mistake points at the bad record instead of surfacing deep inside the engine.
 * Coverage spans collection structure and cross-collection references.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Item } from "~/game/data/item";
import type { Move, MoveEffect } from "~/game/data/move";
import type { Species } from "~/game/data/species";

import { GrowthRate } from "~/game/data/growth-rate";
import { DamageClass } from "~/game/data/move";
import { Stat } from "~/game/data/stat";
import { State } from "~/game/data/status";
import { Type } from "~/game/data/type";

import { ITEMS } from "./items";
import { TYPE_MATCHUPS } from "./matchups";
import { MOVES } from "./moves";
import { SPECIES } from "./species";

const EXPECTED_SPECIES_COUNT = 151;

/** Highest combined EV a single species may award on faint (Gen 3 rule). */
const MAX_EV_YIELD_TOTAL = 3;

/**
 * Damaging moves shipping with `power: 0` and a `none` effect, so they resolve
 * to a no-op while they await engine support (per-party-member hits, random
 * heal-or-damage, a Stockpile counter). Shrink-only baseline: a rise is a bug.
 */
const KNOWN_STRANDED_DAMAGING_MOVES = new Set(["BEAT_UP", "PRESENT", "SPIT_UP"]);

/** Collections re-typed by arbitrary string id for iteration in tests. */
let speciesById = SPECIES as Record<string, Species>;
let movesById = MOVES as Record<string, Move>;
let itemsById = ITEMS as Record<string, Item>;

let STAT_VALUES = new Set<string>(Object.values(Stat));
let TYPE_VALUES = new Set<string>(Object.values(Type));
let GROWTH_RATE_VALUES = new Set<string>(Object.values(GrowthRate));
let DAMAGE_CLASS_VALUES = new Set<string>(Object.values(DamageClass));
let STATE_VALUES = new Set<string>(Object.values(State));

/** Attacking types the authored type chart provides a matchup row for. */
let TYPE_CHART_TYPES = new Set<string>(Object.keys(TYPE_MATCHUPS));

let ALLOWED_ITEM_CATEGORIES = new Set<string>([
	"standard-balls",
	"medicine",
	"stat-boosts",
	"held-items",
	"all-machines",
	"evolution",
	"loot",
	"gameplay",
	"plot-advancement",
]);

function learnsetMoveIds(species: Species): string[] {
	let ids: string[] = [];
	for (let entry of species.learnset) {
		if ("moveId" in entry) ids.push(entry.moveId);
	}
	return ids;
}

/** Flattens a (possibly compound) move effect into its leaf effect kinds. */
function effectKinds(effect: MoveEffect): string[] {
	if (effect.kind === "compound") return effect.effects.flatMap(effectKinds);
	return [effect.kind];
}

describe("species roster", () => {
	test("ships exactly the expected number of species", () => {
		expect(Object.keys(speciesById)).toHaveLength(EXPECTED_SPECIES_COUNT);
	});

	test("assigns every species a unique dex number in range", () => {
		let seen = new Map<number, string>();
		for (let [id, species] of Object.entries(speciesById)) {
			expect(Number.isInteger(species.number), `${id} number should be an integer`).toBe(true);
			expect(species.number, `${id} number should be >= 1`).toBeGreaterThanOrEqual(1);
			expect(
				species.number,
				`${id} number should be <= ${EXPECTED_SPECIES_COUNT}`,
			).toBeLessThanOrEqual(EXPECTED_SPECIES_COUNT);

			let previous = seen.get(species.number);
			expect(
				previous,
				`${id} reuses dex number ${species.number} already held by ${previous}`,
			).toBe(undefined);
			seen.set(species.number, id);
		}
	});

	test("gives every species positive base stats for all six stats", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			for (let stat of Object.values(Stat)) {
				let value = species.stats[stat];
				expect(Number.isInteger(value), `${id} ${stat} base stat should be an integer`).toBe(true);
				expect(value, `${id} ${stat} base stat should be positive`).toBeGreaterThan(0);
			}
		}
	});

	test("gives every species a valid growth rate", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			expect(
				GROWTH_RATE_VALUES.has(species.growthRate),
				`${id} has unknown growth rate ${species.growthRate}`,
			).toBe(true);
		}
	});

	test("gives every species one or two valid types", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			expect(species.types.length, `${id} should have 1-2 types`).toBeGreaterThanOrEqual(1);
			expect(species.types.length, `${id} should have 1-2 types`).toBeLessThanOrEqual(2);
			for (let type of species.types) {
				expect(TYPE_VALUES.has(type), `${id} has unknown type ${type}`).toBe(true);
			}
			if (species.types.length === 2) {
				expect(species.types[0], `${id} should not repeat a type`).not.toBe(species.types[1]);
			}
		}
	});

	test("gives every species a non-negative base experience", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			expect(
				species.baseExperience,
				`${id} base experience should be non-negative`,
			).toBeGreaterThanOrEqual(0);
		}
	});

	/** The content layer guarantees a yield even where the contract marks it optional. */
	test("gives every species an EV yield within the Gen 3 range", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			expect(species.evYield, `${id} should carry an EV yield`).toBeDefined();

			let total = 0;
			for (let [stat, value] of Object.entries(species.evYield ?? {})) {
				expect(STAT_VALUES.has(stat), `${id} EV yield uses unknown stat ${stat}`).toBe(true);
				expect(value, `${id} EV yield for ${stat} should be non-negative`).toBeGreaterThanOrEqual(
					0,
				);
				total += value;
			}
			expect(total, `${id} EV yield total should be <= ${MAX_EV_YIELD_TOTAL}`).toBeLessThanOrEqual(
				MAX_EV_YIELD_TOTAL,
			);
		}
	});

	test("points every evolution at a species that exists", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			for (let evolution of species.evolutions) {
				expect(
					speciesById[evolution.speciesId],
					`${id} evolves into unknown species ${evolution.speciesId}`,
				).toBeDefined();
			}
		}
	});
});

describe("move catalog", () => {
	test("gives every move a non-negative power", () => {
		for (let [id, move] of Object.entries(movesById)) {
			expect(move.power, `${id} power should be non-negative`).toBeGreaterThanOrEqual(0);
		}
	});

	test("keeps every move accuracy within 0..100 (0 = always hits)", () => {
		for (let [id, move] of Object.entries(movesById)) {
			expect(move.accuracy, `${id} accuracy should be >= 0`).toBeGreaterThanOrEqual(0);
			expect(move.accuracy, `${id} accuracy should be <= 100`).toBeLessThanOrEqual(100);
		}
	});

	test("gives every move positive PP", () => {
		for (let [id, move] of Object.entries(movesById)) {
			expect(move.pp, `${id} PP should be positive`).toBeGreaterThan(0);
		}
	});

	test("gives every move a valid type", () => {
		for (let [id, move] of Object.entries(movesById)) {
			expect(TYPE_VALUES.has(move.type), `${id} has unknown type ${move.type}`).toBe(true);
		}
	});

	test("gives every move a valid damage class", () => {
		for (let [id, move] of Object.entries(movesById)) {
			expect(
				DAMAGE_CLASS_VALUES.has(move.damageClass),
				`${id} has unknown damage class ${move.damageClass}`,
			).toBe(true);
		}
	});

	/** An OHKO resolves through its effect, so the damage formula must see power 0. */
	test("marks every one-hit-KO move with power 0", () => {
		for (let [id, move] of Object.entries(movesById)) {
			if (effectKinds(move.effect).includes("ohko")) {
				expect(move.power, `OHKO move ${id} should carry power 0`).toBe(0);
			}
		}
	});

	test("keeps stranded power-0 damaging moves at or below the known baseline", () => {
		let stranded = Object.entries(movesById)
			.filter(
				([, move]) =>
					(move.damageClass === DamageClass.Physical || move.damageClass === DamageClass.Special) &&
					move.power === 0 &&
					move.effect.kind === "none",
			)
			.map(([id]) => id);

		for (let id of stranded) {
			expect(
				KNOWN_STRANDED_DAMAGING_MOVES.has(id),
				`${id} is a damaging move with power 0 and no effect (silent no-op) not in the known baseline`,
			).toBe(true);
		}
	});
});

describe("item catalog", () => {
	test("gives every item a category from the allowed set", () => {
		for (let [id, item] of Object.entries(itemsById)) {
			expect(
				ALLOWED_ITEM_CATEGORIES.has(item.category),
				`${id} has unexpected category ${item.category}`,
			).toBe(true);
		}
	});

	test("gives every priced item non-negative buy and sell values", () => {
		for (let [id, item] of Object.entries(itemsById)) {
			if (!item.price) continue;
			expect(item.price.buy, `${id} buy price should be non-negative`).toBeGreaterThanOrEqual(0);
			expect(item.price.sell, `${id} sell price should be non-negative`).toBeGreaterThanOrEqual(0);
		}
	});

	/** Medicine and battle payloads carry a `kind`; capture effects are skipped. */
	test("references only valid states from medicine cure effects", () => {
		for (let [id, item] of Object.entries(itemsById)) {
			if (!("effect" in item)) continue;
			let effect = item.effect;
			if (!("kind" in effect)) continue;
			if (
				(effect.kind === "cure-status" || effect.kind === "heal-hp-and-cure-status") &&
				Array.isArray(effect.status)
			) {
				for (let state of effect.status) {
					expect(STATE_VALUES.has(state), `${id} cures unknown state ${state}`).toBe(true);
				}
			}
		}
	});
});

describe("cross-references", () => {
	test("resolves every learnset move to a real move", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			for (let moveId of learnsetMoveIds(species)) {
				expect(movesById[moveId], `${id} learnset references unknown move ${moveId}`).toBeDefined();
			}
		}
	});

	test("resolves every TM/HM taught move to a real move", () => {
		for (let [id, item] of Object.entries(itemsById)) {
			if (!("teachesMoveId" in item)) continue;
			expect(
				movesById[item.teachesMoveId],
				`${id} teaches unknown move ${item.teachesMoveId}`,
			).toBeDefined();
		}
	});

	test("resolves every move type against the type chart", () => {
		for (let [id, move] of Object.entries(movesById)) {
			expect(
				TYPE_CHART_TYPES.has(move.type),
				`${id} uses type ${move.type} that is missing from the type chart`,
			).toBe(true);
		}
	});

	test("resolves every species type against the type chart", () => {
		for (let [id, species] of Object.entries(speciesById)) {
			for (let type of species.types) {
				expect(
					TYPE_CHART_TYPES.has(type),
					`${id} uses type ${type} that is missing from the type chart`,
				).toBe(true);
			}
		}
	});
});
