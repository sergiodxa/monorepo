/**
 * Verifies the species export: the pure shaper replaces exactly one entry inside
 * the whole `species.json` map (preserving every other species) and re-serializes
 * tab-indented with a trailing newline; it rejects invalid ids before any file
 * work. The server handler {@link runSpeciesExport} is exercised end to end with a
 * real `Bun.write` into a scratch entry of the real `species.json` (removed after),
 * and guards that malformed payloads and invalid ids fail without corrupting the
 * file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { isFailure, isSuccess } from "@pkg/result";

import type { Species, SpeciesId } from "~/game/data/species";

import { parseSpecies } from "~/content/species-schema";
import { EvolutionMethod } from "~/game/data/evolution";
import { GrowthRate } from "~/game/data/growth-rate";
import { Gender } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";

import { validateWritePath } from "./path-safety";
import {
	APP_ROOT,
	runSpeciesExport,
	shapeSpeciesExport,
	SPECIES_CONTENT_PATH,
	SpeciesIdError,
	validateSpeciesId,
} from "./species-export";

/** A minimal, valid species record tests clone and mutate. */
function validSpecies(): Species {
	return {
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
		eggGroup: ["monster" as never],
	};
}

/** Loads the current on-disk species index the same way the handler does. */
async function currentIndex(): Promise<Record<SpeciesId, Species>> {
	let current = await Bun.file(resolve(APP_ROOT, SPECIES_CONTENT_PATH)).json();
	return parseSpecies(current);
}

describe("validateSpeciesId", () => {
	let valid = ["BULBASAUR", "NIDORAN_F", "MR_MIME", "A", "PORYGON2"];
	for (let id of valid) {
		test(`accepts ${id}`, () => {
			expect(isSuccess(validateSpeciesId(id))).toBe(true);
		});
	}

	let invalid: Array<[label: string, id: string]> = [
		["blank", ""],
		["lowercase", "bulbasaur"],
		["hyphen", "MR-MIME"],
		["space", "MR MIME"],
		["leading underscore", "_PIKACHU"],
		["trailing underscore", "PIKACHU_"],
		["dot / extension", "PIKACHU.json"],
		["slash / traversal", "../PIKACHU"],
		["over 64 chars", "A".repeat(65)],
	];
	for (let [label, id] of invalid) {
		test(`rejects ${label}`, () => {
			let result = validateSpeciesId(id);
			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(SpeciesIdError);
		});
	}
});

describe("shapeSpeciesExport", () => {
	test("targets the single species.json path", () => {
		let result = shapeSpeciesExport({}, "PIKACHU", validSpecies());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.path).toBe(SPECIES_CONTENT_PATH);
	});

	test("replaces one entry while preserving all others", () => {
		let existing: Record<SpeciesId, Species> = {
			BULBASAUR: { ...validSpecies(), number: 1 },
			IVYSAUR: { ...validSpecies(), number: 2 },
		};
		let replacement: Species = { ...validSpecies(), number: 999 };
		let result = shapeSpeciesExport(existing, "IVYSAUR", replacement);
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let parsed = JSON.parse(result.data.contents) as Record<string, Species>;
			// Both species remain.
			expect(Object.keys(parsed).sort()).toEqual(["BULBASAUR", "IVYSAUR"]);
			// The replaced entry has the new value; the untouched one is unchanged.
			expect(parsed.IVYSAUR!.number).toBe(999);
			expect(parsed.BULBASAUR!.number).toBe(1);
		}
	});

	test("adds a brand-new entry to the map", () => {
		let existing: Record<SpeciesId, Species> = { BULBASAUR: validSpecies() };
		let result = shapeSpeciesExport(existing, "MEW", { ...validSpecies(), number: 151 });
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let parsed = JSON.parse(result.data.contents) as Record<string, Species>;
			expect(Object.keys(parsed).sort()).toEqual(["BULBASAUR", "MEW"]);
		}
	});

	test("serializes tab-indented with a trailing newline", () => {
		let result = shapeSpeciesExport({}, "PIKACHU", validSpecies());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.contents.endsWith("\n")).toBe(true);
			expect(result.data.contents).toContain("\t");
		}
	});

	test("the derived path always passes the path-safety guard", () => {
		let result = shapeSpeciesExport({}, "PIKACHU", validSpecies());
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(isSuccess(validateWritePath(result.data.path))).toBe(true);
	});

	test("rejects an invalid id before shaping", () => {
		let result = shapeSpeciesExport({}, "bad id", validSpecies());
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SpeciesIdError);
	});
});

describe("runSpeciesExport", () => {
	// A scratch id written into the real species.json, removed after the suite.
	let SCRATCH_ID = "EXPORT_TEST_SPECIES";

	afterAll(async () => {
		// Restore species.json to just its real entries (drop the scratch entry).
		let index = await currentIndex();
		if (SCRATCH_ID in index) {
			delete index[SCRATCH_ID];
			let contents = `${JSON.stringify(index, null, "\t")}\n`;
			await Bun.write(resolve(APP_ROOT, SPECIES_CONTENT_PATH), contents);
		}
	});

	test("rejects a non-object payload", async () => {
		let result = await runSpeciesExport(null);
		expect(isFailure(result)).toBe(true);
	});

	test("rejects a payload missing an id", async () => {
		let result = await runSpeciesExport({ species: validSpecies() });
		expect(isFailure(result)).toBe(true);
	});

	test("rejects an invalid id with a SpeciesIdError", async () => {
		let result = await runSpeciesExport({ id: "bad id", species: validSpecies() });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SpeciesIdError);
	});

	test("rejects a malformed species record without corrupting the file", async () => {
		let before = await currentIndex();
		let malformed = { ...validSpecies(), types: ["sparkle"] };
		let result = await runSpeciesExport({ id: "PIKACHU", species: malformed });
		expect(isFailure(result)).toBe(true);
		// The file still parses to the same set of ids (untouched).
		let after = await currentIndex();
		expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
	});

	test("writes a valid species entry and preserves the rest of the roster", async () => {
		let before = await currentIndex();
		let result = await runSpeciesExport({
			id: SCRATCH_ID,
			species: { ...validSpecies(), number: 1 },
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.path).toBe(SPECIES_CONTENT_PATH);
			expect(result.data.id).toBe(SCRATCH_ID);
			expect(result.data.bytesWritten).toBeGreaterThan(0);

			let after = await currentIndex();
			// Every original species is still present, plus the new scratch entry.
			expect(Object.keys(after)).toHaveLength(Object.keys(before).length + 1);
			expect(after[SCRATCH_ID]).toBeDefined();
			// A known original entry is unchanged.
			expect(after.BULBASAUR).toEqual(before.BULBASAUR!);
		}
	});
});
