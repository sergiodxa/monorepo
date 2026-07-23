/**
 * State-holding editor for one species-in-progress, built on the canonical editor
 * class pattern. A plain, DOM-free class that owns ALL editable state for a single
 * {@link Species}: its dex number, size, base stats, types, growth rate, gender
 * ratio, catch rate and base experience, EV yield, level-up learnset, evolutions,
 * and sprite association. The view constructs it once with a loaded species and
 * drives every control through it; each mutation returns the current
 * {@link Species} snapshot so the view re-renders from one value.
 *
 * The class stays pure — it never validates against a live roster or writes to
 * disk. It only enforces the structural bounds the content format cares about
 * (one or two types, valid learnset ordering, coherent evolution payloads per
 * method) so the in-progress state can never drift past what the species schema
 * accepts. The view supplies the real move/species ids, and the export path
 * re-validates the final record before writing.
 *
 * Two static helpers support the create-new flow without touching instance state:
 * {@link SpeciesEditor.createNew} builds a complete, schema-valid default
 * {@link Species} for a fresh entry, and {@link SpeciesEditor.isDuplicateId} flags
 * a chosen id that would collide with an existing roster entry so a new species
 * never silently overwrites one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Evolution } from "~/game/data/evolution";
import type { Species, SpeciesSprite } from "~/game/data/species";
import type { StatSet } from "~/game/data/stat";

import { EvolutionMethod } from "~/game/data/evolution";
import { GrowthRate } from "~/game/data/growth-rate";
import { EggGroup, Gender } from "~/game/data/species";
import { Stat } from "~/game/data/stat";
import { Type } from "~/game/data/type";

/** The elemental types a species carries: one or two type ids. */
export type SpeciesTypes = [string] | [string, string];

/** Default base value used for every stat of a newly created species. */
const DEFAULT_STAT_VALUE = 50;

/** Default type assigned to a newly created species (a single, common type). */
const DEFAULT_TYPE: Type = Type.NORMAL;

/** Default growth rate assigned to a newly created species. */
const DEFAULT_GROWTH_RATE: GrowthRate = GrowthRate.MediumFast;

/** Default egg group assigned to a newly created species. */
const DEFAULT_EGG_GROUP: EggGroup = EggGroup.Monster;

/** Default physical size (weight in kg, height in m) for a newly created species. */
const DEFAULT_SIZE = { weight: 1, height: 1 };

/** Default base experience awarded when a newly created species faints. */
const DEFAULT_BASE_EXPERIENCE = 64;

/** Default catch rate for a newly created species. */
const DEFAULT_CATCH_RATE = 45;

/** Default 50/50 male/female split for a newly created species. */
const DEFAULT_GENDER: { [K in Gender.Male | Gender.Female]?: number } = {
	[Gender.Male]: 50,
	[Gender.Female]: 50,
};

/**
 * Editor for a single species record. Wraps every editable field and exposes
 * pure setters/mutators that each return the current {@link Species} so the view
 * renders from a single snapshot. Seeded from an existing species; the id it was
 * loaded under is tracked separately (a species record carries no id of its own)
 * so the export path knows which `species.json` entry to replace.
 */
export class SpeciesEditor {
	/** The id this species was loaded under (the `species.json` key to replace). */
	#id: string;

	/** Deep-editable copy of the species record. */
	#species: Species;

	/**
	 * @param id The species id being edited (the `species.json` key).
	 * @param initial The species record to seed the editor from.
	 */
	constructor(id: string, initial: Species) {
		this.#id = id;
		this.#species = this.#clone(initial);
	}

	/**
	 * Builds a complete, schema-valid default {@link Species} for a brand-new entry.
	 *
	 * Every field is initialized to a sensible, valid default: the six base stats to
	 * {@link DEFAULT_STAT_VALUE}, a single {@link DEFAULT_TYPE}, a
	 * {@link DEFAULT_GROWTH_RATE}, a 50/50 gender split, a zero EV yield (an empty
	 * partial map), an empty learnset and empty evolutions, and no sprite. The
	 * returned record has no id of its own — the caller pairs it with a chosen id
	 * (see {@link isDuplicateId}) when it seeds the editor via the constructor.
	 *
	 * @param dex The dex number to assign (coerced to a non-negative whole number).
	 * @returns A fresh, valid default species ready to load into a new editor.
	 */
	static createNew(dex: number): Species {
		let number = Number.isFinite(dex) ? Math.max(0, Math.trunc(dex)) : 0;
		return {
			number,
			size: { ...DEFAULT_SIZE },
			types: [DEFAULT_TYPE],
			baseExperience: DEFAULT_BASE_EXPERIENCE,
			catchRate: DEFAULT_CATCH_RATE,
			growthRate: DEFAULT_GROWTH_RATE,
			stats: {
				[Stat.HP]: DEFAULT_STAT_VALUE,
				[Stat.Attack]: DEFAULT_STAT_VALUE,
				[Stat.Defense]: DEFAULT_STAT_VALUE,
				[Stat.SpecialAttack]: DEFAULT_STAT_VALUE,
				[Stat.SpecialDefense]: DEFAULT_STAT_VALUE,
				[Stat.Speed]: DEFAULT_STAT_VALUE,
			},
			evYield: {},
			evolutions: [],
			learnset: [],
			gender: { ...DEFAULT_GENDER },
			eggGroup: [DEFAULT_EGG_GROUP],
			sprite: null,
		};
	}

	/**
	 * Reports whether a candidate id already exists in a roster of species ids, so a
	 * new-species flow can flag a collision before overwriting an existing entry. The
	 * comparison is on the trimmed id exactly as stored (ids are case-sensitive
	 * uppercase keys).
	 *
	 * @param id The candidate species id.
	 * @param existingIds The ids already present in the roster.
	 * @returns `true` when `id` (trimmed) collides with an existing id.
	 */
	static isDuplicateId(id: string, existingIds: Iterable<string>): boolean {
		let candidate = id.trim();
		if (candidate.length === 0) return false;
		for (let existing of existingIds) {
			if (existing === candidate) return true;
		}
		return false;
	}

	/** The id this species is edited under. */
	get id(): string {
		return this.#id;
	}

	/** Current number of level-up moves in the learnset. */
	get levelUpMoveCount(): number {
		return this.#species.learnset.filter((entry) => "level" in entry).length;
	}

	/** Current number of evolutions. */
	get evolutionCount(): number {
		return this.#species.evolutions.length;
	}

	/** Sets the dex number (coerced to a whole number) and returns the snapshot. */
	setNumber(value: number): Species {
		this.#species.number = this.#whole(value, this.#species.number);
		return this.toSpecies();
	}

	/** Sets the base experience awarded on defeat and returns the snapshot. */
	setBaseExperience(value: number): Species {
		this.#species.baseExperience = this.#whole(value, this.#species.baseExperience);
		return this.toSpecies();
	}

	/** Sets the catch rate and returns the snapshot. */
	setCatchRate(value: number): Species {
		this.#species.catchRate = this.#whole(value, this.#species.catchRate);
		return this.toSpecies();
	}

	/** Sets the growth rate and returns the snapshot. */
	setGrowthRate(growthRate: GrowthRate): Species {
		this.#species.growthRate = growthRate;
		return this.toSpecies();
	}

	/** Sets one physical dimension (weight or height) and returns the snapshot. */
	setSize(field: keyof Species["size"], value: number): Species {
		this.#species.size = { ...this.#species.size, [field]: value };
		return this.toSpecies();
	}

	/**
	 * Sets one base stat (clamped to a whole number, floored at zero) and returns
	 * the snapshot.
	 *
	 * @param stat The stat to set.
	 * @param value The desired value (truncated/floored to a valid whole number).
	 */
	setStat(stat: Stat, value: number): Species {
		let whole = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
		this.#species.stats = { ...this.#species.stats, [stat]: whole } as StatSet;
		return this.toSpecies();
	}

	/**
	 * Sets the species' primary type and returns the snapshot. A blank id is a
	 * no-op (a species must always keep at least one type).
	 */
	setPrimaryType(type: string): Species {
		if (type.length === 0) return this.toSpecies();
		let secondary = this.#species.types[1];
		this.#species.types = secondary ? [type, secondary] : [type];
		return this.toSpecies();
	}

	/**
	 * Sets the species' secondary type, or clears it with a blank id (making the
	 * species single-typed), and returns the snapshot.
	 */
	setSecondaryType(type: string): Species {
		let primary = this.#species.types[0];
		this.#species.types = type.length === 0 ? [primary] : [primary, type];
		return this.toSpecies();
	}

	/**
	 * Replaces the gender distribution with the genderless sentinel and returns the
	 * snapshot.
	 */
	setGenderless(): Species {
		this.#species.gender = Gender.Genderless;
		return this.toSpecies();
	}

	/**
	 * Sets the male/female split as percentages and returns the snapshot. Converts
	 * a genderless species to a gendered one. Percentages are clamped to `0..100`.
	 *
	 * @param male Male percentage (clamped to 0..100).
	 * @param female Female percentage (clamped to 0..100).
	 */
	setGenderRatio(male: number, female: number): Species {
		this.#species.gender = {
			[Gender.Male]: this.#percent(male),
			[Gender.Female]: this.#percent(female),
		};
		return this.toSpecies();
	}

	/**
	 * Sets the EV value for one stat, or removes it when the value is zero, and
	 * returns the snapshot. Values are coerced to non-negative whole numbers.
	 *
	 * @param stat The stat to award EVs for.
	 * @param value The EV amount (0 removes the entry).
	 */
	setEvYield(stat: Stat, value: number): Species {
		let whole = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
		let next: Partial<StatSet> = { ...this.#species.evYield };
		if (whole === 0) delete next[stat];
		else next[stat] = whole;
		this.#species.evYield = next;
		return this.toSpecies();
	}

	/**
	 * Appends a level-up move to the learnset, keeps the level-up rows sorted
	 * ascending by level (ties preserved in insertion order), and returns the
	 * snapshot. Non-level-up entries (TM/HM, tutor, egg) keep their relative order
	 * after the sorted level-up block.
	 *
	 * @param level The level the move is learned at (floored at zero).
	 * @param moveId The move id learned.
	 */
	addLearnsetMove(level: number, moveId: string): Species {
		let whole = Number.isFinite(level) ? Math.max(0, Math.trunc(level)) : 0;
		this.#species.learnset = [...this.#species.learnset, { level: whole, moveId }];
		this.#sortLearnset();
		return this.toSpecies();
	}

	/**
	 * Removes the learnset entry at `index` (a no-op for an out-of-range index) and
	 * returns the snapshot.
	 *
	 * @param index Zero-based position in the learnset array.
	 */
	removeLearnsetMove(index: number): Species {
		if (index >= 0 && index < this.#species.learnset.length) {
			this.#species.learnset.splice(index, 1);
		}
		return this.toSpecies();
	}

	/**
	 * Sets the level of the level-up entry at `index`, re-sorts the learnset, and
	 * returns the snapshot. A no-op for an out-of-range index or a non-level entry.
	 *
	 * @param index Zero-based position in the learnset array.
	 * @param level The new level (floored at zero).
	 */
	setLearnsetLevel(index: number, level: number): Species {
		let entry = this.#species.learnset[index];
		if (entry && "level" in entry) {
			entry.level = Number.isFinite(level) ? Math.max(0, Math.trunc(level)) : 0;
			this.#sortLearnset();
		}
		return this.toSpecies();
	}

	/**
	 * Sets the move id of the entry at `index` and returns the snapshot. A no-op for
	 * an out-of-range index or an entry with no move id (a TM/HM entry).
	 *
	 * @param index Zero-based position in the learnset array.
	 * @param moveId The move id to assign.
	 */
	setLearnsetMove(index: number, moveId: string): Species {
		let entry = this.#species.learnset[index];
		if (entry && "moveId" in entry) entry.moveId = moveId;
		return this.toSpecies();
	}

	/** Re-sorts the learnset by ascending level and returns the snapshot. */
	sortLearnset(): Species {
		this.#sortLearnset();
		return this.toSpecies();
	}

	/**
	 * Appends a level-up evolution to `targetId` at `level` and returns the snapshot.
	 * The view can change the method afterward with {@link setEvolutionMethod}.
	 *
	 * @param targetId The species id evolved into.
	 * @param level The level the evolution triggers at (floored at one).
	 */
	addEvolution(targetId: string, level: number = 1): Species {
		let whole = Number.isFinite(level) ? Math.max(1, Math.trunc(level)) : 1;
		this.#species.evolutions = [
			...this.#species.evolutions,
			{ method: EvolutionMethod.Level, speciesId: targetId, level: whole },
		];
		return this.toSpecies();
	}

	/**
	 * Removes the evolution at `index` (a no-op for an out-of-range index) and
	 * returns the snapshot.
	 *
	 * @param index Zero-based position in the evolutions array.
	 */
	removeEvolution(index: number): Species {
		if (index >= 0 && index < this.#species.evolutions.length) {
			this.#species.evolutions.splice(index, 1);
		}
		return this.toSpecies();
	}

	/**
	 * Sets the target species of the evolution at `index` and returns the snapshot.
	 * A no-op for an out-of-range index.
	 *
	 * @param index Zero-based position in the evolutions array.
	 * @param targetId The species id evolved into.
	 */
	setEvolutionTarget(index: number, targetId: string): Species {
		let evolution = this.#species.evolutions[index];
		if (evolution) evolution.speciesId = targetId;
		return this.toSpecies();
	}

	/**
	 * Switches the method of the evolution at `index`, rebuilding it with the fields
	 * that method requires (dropping fields the previous method carried), and returns
	 * the snapshot. Level/friendship keep any existing level; item keeps any existing
	 * item; place keeps any existing place. A no-op for an out-of-range index.
	 *
	 * @param index Zero-based position in the evolutions array.
	 * @param method The evolution method to switch to.
	 */
	setEvolutionMethod(index: number, method: EvolutionMethod): Species {
		let current = this.#species.evolutions[index];
		if (!current) return this.toSpecies();

		let speciesId = current.speciesId;
		let level = "level" in current ? current.level : 1;
		let itemId = "itemId" in current ? current.itemId : "";
		let placeId = "placeId" in current ? current.placeId : 0;

		let next: Evolution;
		switch (method) {
			case EvolutionMethod.Level:
				next = { method, speciesId, level };
				break;
			case EvolutionMethod.Friendship:
				next = { method, speciesId, level };
				break;
			case EvolutionMethod.Item:
				next = { method, speciesId, itemId };
				break;
			case EvolutionMethod.Place:
				next = { method, speciesId, placeId };
				break;
			case EvolutionMethod.Trade:
				next = { method, speciesId };
				break;
		}
		this.#species.evolutions[index] = next;
		return this.toSpecies();
	}

	/**
	 * Sets the level of the evolution at `index` (for level/friendship methods) and
	 * returns the snapshot. A no-op for an out-of-range index or a method without a
	 * level.
	 *
	 * @param index Zero-based position in the evolutions array.
	 * @param level The trigger level (floored at one).
	 */
	setEvolutionLevel(index: number, level: number): Species {
		let evolution = this.#species.evolutions[index];
		if (evolution && "level" in evolution) {
			evolution.level = Number.isFinite(level) ? Math.max(1, Math.trunc(level)) : 1;
		}
		return this.toSpecies();
	}

	/**
	 * Sets the required item of the evolution at `index` (for the item method) and
	 * returns the snapshot. A no-op for an out-of-range index or a non-item method.
	 *
	 * @param index Zero-based position in the evolutions array.
	 * @param itemId The item id required to evolve.
	 */
	setEvolutionItem(index: number, itemId: string): Species {
		let evolution = this.#species.evolutions[index];
		if (evolution && "itemId" in evolution) evolution.itemId = itemId;
		return this.toSpecies();
	}

	/**
	 * Clears the sprite association and returns the snapshot.
	 */
	clearSprite(): Species {
		this.#species.sprite = null;
		return this.toSpecies();
	}

	/**
	 * Associates an atlas region sprite and returns the snapshot.
	 *
	 * @param atlas The manifest atlas id.
	 * @param region The named region inside that atlas.
	 */
	setAtlasSprite(atlas: string, region: string): Species {
		this.#species.sprite = { atlas, region };
		return this.toSpecies();
	}

	/**
	 * Associates a standalone manifest image sprite and returns the snapshot.
	 *
	 * @param image The manifest image id.
	 */
	setImageSprite(image: string): Species {
		this.#species.sprite = { image };
		return this.toSpecies();
	}

	/**
	 * Serializes the current editor state to a fresh {@link Species}. Returns deep
	 * copies of every nested value so callers cannot mutate the editor's internal
	 * state through the snapshot.
	 *
	 * @returns The current species record.
	 */
	toSpecies(): Species {
		return this.#clone(this.#species);
	}

	/** Sorts the learnset's level-up entries ascending by level (stable for ties). */
	#sortLearnset(): void {
		this.#species.learnset = [...this.#species.learnset].sort((a, b) => {
			let levelA = "level" in a ? a.level : Number.POSITIVE_INFINITY;
			let levelB = "level" in b ? b.level : Number.POSITIVE_INFINITY;
			return levelA - levelB;
		});
	}

	/** Coerces a value to a non-negative whole number, falling back on invalid input. */
	#whole(value: number, fallback: number): number {
		if (!Number.isFinite(value)) return fallback;
		return Math.max(0, Math.trunc(value));
	}

	/** Clamps a percentage to `0..100`, coercing invalid input to zero. */
	#percent(value: number): number {
		if (!Number.isFinite(value)) return 0;
		return Math.min(100, Math.max(0, value));
	}

	/** Returns a deep copy of a species record so snapshots never share references. */
	#clone(species: Species): Species {
		let copy: Species = {
			number: species.number,
			size: { ...species.size },
			types: [...species.types] as SpeciesTypes,
			baseExperience: species.baseExperience,
			catchRate: species.catchRate,
			growthRate: species.growthRate,
			stats: { ...species.stats },
			evolutions: species.evolutions.map((evolution) => ({ ...evolution })),
			learnset: species.learnset.map((entry) => ({ ...entry })),
			gender: species.gender === Gender.Genderless ? Gender.Genderless : { ...species.gender },
			eggGroup: [...species.eggGroup] as Species["eggGroup"],
		};
		if (species.evYield) copy.evYield = { ...species.evYield };
		if (species.sprite !== undefined) copy.sprite = this.#cloneSprite(species.sprite);
		return copy;
	}

	/** Returns a copy of a sprite reference (or the `null`/value as-is). */
	#cloneSprite(sprite: SpeciesSprite): SpeciesSprite {
		if (sprite === null) return null;
		return { ...sprite } as SpeciesSprite;
	}
}
