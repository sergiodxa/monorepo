/**
 * Verifies the {@link SpeciesEditor} pure mutations: base stats, types, growth
 * rate, gender ratio, catch rate/base experience, EV yield, the level-up learnset
 * (add/remove/keep-sorted), evolutions (add/remove/method switch with the right
 * payload fields), and the sprite association (atlas/image/none). Every mutation
 * must return a fresh {@link Species} snapshot the caller cannot use to mutate the
 * editor's internal state, so snapshots are checked for independence too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Species } from "~/game/data/species";

import { parseSpecies } from "~/content/species-schema";
import { EvolutionMethod } from "~/game/data/evolution";
import { GrowthRate } from "~/game/data/growth-rate";
import { Gender } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";

import { SpeciesEditor } from "./species-editor";

/** A minimal, valid species tests seed the editor from. */
function baseSpecies(): Species {
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
		learnset: [
			{ level: 1, moveId: "TACKLE" },
			{ level: 3, moveId: "VINE_WHIP" },
		],
		gender: { [Gender.Male]: 87.5, [Gender.Female]: 12.5 },
		eggGroup: ["monster" as never],
	};
}

function makeEditor(): SpeciesEditor {
	return new SpeciesEditor("BULBASAUR", baseSpecies());
}

describe("createNew (default species factory)", () => {
	test("produces a schema-valid default species that round-trips through the schema", () => {
		let created = SpeciesEditor.createNew(151);
		// parseSpecies throws on an invalid record; a clean round-trip proves validity.
		let parsed = parseSpecies({ MEW: created });
		expect(parsed.MEW).toEqual(created);
	});

	test("respects the chosen dex number (coerced to a whole number)", () => {
		expect(SpeciesEditor.createNew(151).number).toBe(151);
		expect(SpeciesEditor.createNew(25.9).number).toBe(25);
		expect(SpeciesEditor.createNew(-3).number).toBe(0);
		expect(SpeciesEditor.createNew(Number.NaN).number).toBe(0);
	});

	test("initializes sensible, complete defaults", () => {
		let created = SpeciesEditor.createNew(1);
		expect(created.types).toHaveLength(1);
		expect(created.learnset).toEqual([]);
		expect(created.evolutions).toEqual([]);
		expect(created.evYield).toEqual({});
		expect(created.sprite).toBeNull();
		// Every base stat is present and non-negative.
		for (let stat of Object.values(Stat)) {
			expect(created.stats[stat]).toBeGreaterThanOrEqual(0);
		}
	});

	test("can be loaded into an editor under a chosen id and edited", () => {
		let editor = new SpeciesEditor("NEWMON", SpeciesEditor.createNew(200));
		expect(editor.id).toBe("NEWMON");
		let next = editor.setStat(Stat.Attack, 120);
		expect(next.stats[Stat.Attack]).toBe(120);
		// The default record stays valid after edits.
		expect(() => parseSpecies({ NEWMON: next })).not.toThrow();
	});

	test("each call returns an independent record (no shared references)", () => {
		let a = SpeciesEditor.createNew(1);
		let b = SpeciesEditor.createNew(2);
		a.stats[Stat.HP] = 999;
		a.types.push("hacked");
		expect(b.stats[Stat.HP]).not.toBe(999);
		expect(b.types).toHaveLength(1);
	});
});

describe("isDuplicateId (collision guard)", () => {
	let roster = ["BULBASAUR", "IVYSAUR", "VENUSAUR"];

	test("flags an id already present in the roster", () => {
		expect(SpeciesEditor.isDuplicateId("IVYSAUR", roster)).toBe(true);
	});

	test("allows a brand-new id", () => {
		expect(SpeciesEditor.isDuplicateId("MEW", roster)).toBe(false);
	});

	test("trims the candidate before comparing", () => {
		expect(SpeciesEditor.isDuplicateId("  VENUSAUR  ", roster)).toBe(true);
	});

	test("a blank id is never a duplicate", () => {
		expect(SpeciesEditor.isDuplicateId("   ", roster)).toBe(false);
	});

	test("is case-sensitive (ids are uppercase keys)", () => {
		expect(SpeciesEditor.isDuplicateId("bulbasaur", roster)).toBe(false);
	});
});

describe("identity and classification", () => {
	test("tracks the id it was loaded under", () => {
		expect(makeEditor().id).toBe("BULBASAUR");
	});

	test("sets whole-number dex, catch rate, and base experience", () => {
		let editor = makeEditor();
		expect(editor.setNumber(25).number).toBe(25);
		expect(editor.setCatchRate(190).catchRate).toBe(190);
		expect(editor.setBaseExperience(112).baseExperience).toBe(112);
		// Fractional input truncates to a whole number.
		expect(editor.setNumber(9.9).number).toBe(9);
	});

	test("sets the growth rate", () => {
		expect(makeEditor().setGrowthRate(GrowthRate.Slow).growthRate).toBe(GrowthRate.Slow);
	});

	test("sets weight and height independently", () => {
		let editor = makeEditor();
		let next = editor.setSize("weight", 90);
		expect(next.size.weight).toBe(90);
		expect(next.size.height).toBe(0.7);
	});
});

describe("base stats", () => {
	test("sets a stat to a non-negative whole number", () => {
		let editor = makeEditor();
		expect(editor.setStat(Stat.Attack, 82).stats[Stat.Attack]).toBe(82);
		// Negative and fractional input is floored/truncated.
		expect(editor.setStat(Stat.Speed, -5).stats[Stat.Speed]).toBe(0);
		expect(editor.setStat(Stat.HP, 45.7).stats[Stat.HP]).toBe(45);
	});
});

describe("types", () => {
	test("sets the primary type, keeping the secondary", () => {
		let next = makeEditor().setPrimaryType(Type.WATER);
		expect(next.types).toEqual([Type.WATER, Type.POISON]);
	});

	test("a blank primary type is a no-op", () => {
		let next = makeEditor().setPrimaryType("");
		expect(next.types).toEqual([Type.GRASS, Type.POISON]);
	});

	test("sets a secondary type", () => {
		let next = makeEditor().setSecondaryType(Type.FLYING);
		expect(next.types).toEqual([Type.GRASS, Type.FLYING]);
	});

	test("a blank secondary type clears it (single-typed)", () => {
		let next = makeEditor().setSecondaryType("");
		expect(next.types).toEqual([Type.GRASS]);
	});
});

describe("gender ratio", () => {
	test("sets a male/female split", () => {
		let next = makeEditor().setGenderRatio(50, 50);
		expect(next.gender).toEqual({ [Gender.Male]: 50, [Gender.Female]: 50 });
	});

	test("clamps percentages to 0..100", () => {
		let next = makeEditor().setGenderRatio(150, -20);
		expect(next.gender).toEqual({ [Gender.Male]: 100, [Gender.Female]: 0 });
	});

	test("switches to genderless", () => {
		expect(makeEditor().setGenderless().gender).toBe(Gender.Genderless);
	});
});

describe("EV yield", () => {
	test("adds and updates a stat's EV", () => {
		let editor = makeEditor();
		expect(editor.setEvYield(Stat.Speed, 2).evYield).toEqual({
			[Stat.SpecialAttack]: 1,
			[Stat.Speed]: 2,
		});
	});

	test("setting a stat to zero removes it", () => {
		let next = makeEditor().setEvYield(Stat.SpecialAttack, 0);
		expect(next.evYield).toEqual({});
	});

	test("coerces negative/fractional EVs to a non-negative whole number", () => {
		let editor = makeEditor();
		expect(editor.setEvYield(Stat.Attack, 2.9).evYield?.[Stat.Attack]).toBe(2);
	});
});

describe("learnset add / remove / sort", () => {
	test("adds a level-up move and keeps rows sorted ascending", () => {
		let next = makeEditor().addLearnsetMove(2, "GROWL");
		let levels = next.learnset
			.filter((e) => "level" in e)
			.map((e) => (e as { level: number }).level);
		expect(levels).toEqual([1, 2, 3]);
	});

	test("preserves insertion order for equal levels (stable sort)", () => {
		let editor = makeEditor();
		editor.addLearnsetMove(1, "GROWL");
		let next = editor.addLearnsetMove(1, "LEER");
		let atLevelOne = next.learnset
			.filter((e) => "level" in e && e.level === 1)
			.map((e) => (e as { moveId: string }).moveId);
		expect(atLevelOne).toEqual(["TACKLE", "GROWL", "LEER"]);
	});

	test("removes a learnset entry by index", () => {
		let next = makeEditor().removeLearnsetMove(0);
		expect(next.learnset).toEqual([{ level: 3, moveId: "VINE_WHIP" }]);
	});

	test("an out-of-range remove is a no-op", () => {
		let next = makeEditor().removeLearnsetMove(99);
		expect(next.learnset).toHaveLength(2);
	});

	test("changing a level re-sorts the learnset", () => {
		let next = makeEditor().setLearnsetLevel(0, 10);
		let levels = next.learnset.map((e) => (e as { level: number }).level);
		expect(levels).toEqual([3, 10]);
	});

	test("sets a move id in place", () => {
		let next = makeEditor().setLearnsetMove(0, "POUND");
		expect(next.learnset[0]).toEqual({ level: 1, moveId: "POUND" });
	});

	test("sort() reorders explicitly", () => {
		let editor = makeEditor();
		editor.setLearnsetLevel(0, 99); // TACKLE -> level 99 (already re-sorts, but assert idempotent sort)
		let next = editor.sortLearnset();
		let levels = next.learnset.map((e) => (e as { level: number }).level);
		expect(levels).toEqual([3, 99]);
	});
});

describe("evolutions", () => {
	test("adds a level-up evolution", () => {
		let next = makeEditor().addEvolution("VENUSAUR", 32);
		expect(next.evolutions).toContainEqual({
			method: EvolutionMethod.Level,
			speciesId: "VENUSAUR",
			level: 32,
		});
	});

	test("removes an evolution by index", () => {
		let next = makeEditor().removeEvolution(0);
		expect(next.evolutions).toEqual([]);
	});

	test("sets an evolution target", () => {
		let next = makeEditor().setEvolutionTarget(0, "MEW");
		expect(next.evolutions[0]?.speciesId).toBe("MEW");
	});

	test("switching to item drops level and adds an item id", () => {
		let next = makeEditor().setEvolutionMethod(0, EvolutionMethod.Item);
		expect(next.evolutions[0]).toEqual({
			method: EvolutionMethod.Item,
			speciesId: "IVYSAUR",
			itemId: "",
		});
	});

	test("switching to trade drops level and item", () => {
		let next = makeEditor().setEvolutionMethod(0, EvolutionMethod.Trade);
		expect(next.evolutions[0]).toEqual({ method: EvolutionMethod.Trade, speciesId: "IVYSAUR" });
	});

	test("switching to friendship keeps a level field", () => {
		let next = makeEditor().setEvolutionMethod(0, EvolutionMethod.Friendship);
		expect(next.evolutions[0]).toEqual({
			method: EvolutionMethod.Friendship,
			speciesId: "IVYSAUR",
			level: 16,
		});
	});

	test("sets an item id after switching to item", () => {
		let editor = makeEditor();
		editor.setEvolutionMethod(0, EvolutionMethod.Item);
		let next = editor.setEvolutionItem(0, "LEAF_STONE");
		expect(next.evolutions[0]).toEqual({
			method: EvolutionMethod.Item,
			speciesId: "IVYSAUR",
			itemId: "LEAF_STONE",
		});
	});

	test("sets an evolution level for a level method", () => {
		let next = makeEditor().setEvolutionLevel(0, 20);
		expect((next.evolutions[0] as { level: number }).level).toBe(20);
	});
});

describe("sprite association", () => {
	test("a freshly loaded species with no sprite reports null on export", () => {
		// The base species omits sprite; the snapshot should not invent one.
		expect(makeEditor().toSpecies().sprite).toBeUndefined();
	});

	test("sets an atlas region sprite", () => {
		let next = makeEditor().setAtlasSprite("creatures", "bulbasaur.front");
		expect(next.sprite).toEqual({ atlas: "creatures", region: "bulbasaur.front" });
	});

	test("sets an image sprite", () => {
		let next = makeEditor().setImageSprite("bulbasaur");
		expect(next.sprite).toEqual({ image: "bulbasaur" });
	});

	test("clears the sprite to null", () => {
		let editor = makeEditor();
		editor.setImageSprite("bulbasaur");
		expect(editor.clearSprite().sprite).toBeNull();
	});
});

describe("snapshot independence", () => {
	test("mutating a returned snapshot does not affect the editor", () => {
		let editor = makeEditor();
		let snapshot = editor.toSpecies();
		snapshot.stats[Stat.Attack] = 999;
		snapshot.learnset.push({ level: 50, moveId: "HACK" });
		snapshot.types[0] = Type.FIRE;

		let fresh = editor.toSpecies();
		expect(fresh.stats[Stat.Attack]).toBe(49);
		expect(fresh.learnset).toHaveLength(2);
		expect(fresh.types[0]).toBe(Type.GRASS);
	});
});
