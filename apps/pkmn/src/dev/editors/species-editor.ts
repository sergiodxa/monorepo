/**
 * State-holding editor for one species-in-progress. Owns every editable field
 * of a {@link Species} and returns the current snapshot from each mutation, so
 * the view re-renders from a single value. Enforces the structural bounds the
 * species schema accepts; roster validation and disk writes stay in the export
 * path.
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

const DEFAULT_STAT_VALUE = 50;

const DEFAULT_TYPE: Type = Type.NORMAL;

const DEFAULT_GROWTH_RATE: GrowthRate = GrowthRate.MediumFast;

const DEFAULT_EGG_GROUP: EggGroup = EggGroup.Monster;

/** Default size for a newly created species: weight in kg, height in m. */
const DEFAULT_SIZE = { weight: 1, height: 1 };

const DEFAULT_BASE_EXPERIENCE = 64;

const DEFAULT_CATCH_RATE = 45;

const DEFAULT_GENDER: { [K in Gender.Male | Gender.Female]?: number } = {
	[Gender.Male]: 50,
	[Gender.Female]: 50,
};

/**
 * Editor for a single species record. Every setter returns the current
 * {@link Species} so the view renders from one snapshot. A species record
 * carries no id, so the loaded id is tracked separately for the export path.
 */
export class SpeciesEditor {
	#id: string;

	/** Deep copy owned by the editor; mutations stay inside it. */
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
	 * Builds a complete, schema-valid default {@link Species} for a brand-new
	 * entry. The record carries no id of its own; the caller pairs it with a
	 * chosen id (see {@link isDuplicateId}) when it seeds the editor.
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
	 * Reports whether a candidate id already exists in a roster, so a new-species
	 * flow can flag a collision before overwriting an entry. The comparison is on
	 * the trimmed id exactly as stored (ids are case-sensitive uppercase keys).
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

	/** The `species.json` key this record is written back to. */
	get id(): string {
		return this.#id;
	}

	/** Count of learnset entries that carry a level. */
	get levelUpMoveCount(): number {
		return this.#species.learnset.filter((entry) => "level" in entry).length;
	}

	get evolutionCount(): number {
		return this.#species.evolutions.length;
	}

	/** Sets the dex number, coerced to a non-negative whole number. */
	setNumber(value: number): Species {
		this.#species.number = this.#whole(value, this.#species.number);
		return this.toSpecies();
	}

	/** Sets the experience awarded on defeat, coerced to a whole number. */
	setBaseExperience(value: number): Species {
		this.#species.baseExperience = this.#whole(value, this.#species.baseExperience);
		return this.toSpecies();
	}

	setCatchRate(value: number): Species {
		this.#species.catchRate = this.#whole(value, this.#species.catchRate);
		return this.toSpecies();
	}

	setGrowthRate(growthRate: GrowthRate): Species {
		this.#species.growthRate = growthRate;
		return this.toSpecies();
	}

	setSize(field: keyof Species["size"], value: number): Species {
		this.#species.size = { ...this.#species.size, [field]: value };
		return this.toSpecies();
	}

	/**
	 * Sets one base stat, coerced to a whole number floored at zero.
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
	 * Sets the primary type. A blank id is a no-op: a species always keeps at
	 * least one type.
	 */
	setPrimaryType(type: string): Species {
		if (type.length === 0) return this.toSpecies();
		let secondary = this.#species.types[1];
		this.#species.types = secondary ? [type, secondary] : [type];
		return this.toSpecies();
	}

	/**
	 * Sets the secondary type. A blank id clears it, leaving the species
	 * single-typed.
	 */
	setSecondaryType(type: string): Species {
		let primary = this.#species.types[0];
		this.#species.types = type.length === 0 ? [primary] : [primary, type];
		return this.toSpecies();
	}

	/** Replaces the male/female split with the genderless sentinel. */
	setGenderless(): Species {
		this.#species.gender = Gender.Genderless;
		return this.toSpecies();
	}

	/**
	 * Sets the male/female split as percentages clamped to `0..100`, converting a
	 * genderless species to a gendered one.
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
	 * Sets the EV value for one stat, coerced to a non-negative whole number. A
	 * value of zero removes the entry.
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
	 * Appends a level-up move and keeps the level-up rows sorted ascending by
	 * level, ties in insertion order. Other entry kinds (TM/HM, tutor, egg) keep
	 * their relative order after the sorted level-up block.
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
	 * Removes the learnset entry at `index`; an out-of-range index is a no-op.
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
	 * Sets the level of the level-up entry at `index` and re-sorts the learnset.
	 * An out-of-range index or a non-level entry is a no-op.
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
	 * Sets the move id of the entry at `index`. An out-of-range index or an entry
	 * with no move id (a TM/HM entry) is a no-op.
	 *
	 * @param index Zero-based position in the learnset array.
	 * @param moveId The move id to assign.
	 */
	setLearnsetMove(index: number, moveId: string): Species {
		let entry = this.#species.learnset[index];
		if (entry && "moveId" in entry) entry.moveId = moveId;
		return this.toSpecies();
	}

	/** Re-sorts the learnset by ascending level. */
	sortLearnset(): Species {
		this.#sortLearnset();
		return this.toSpecies();
	}

	/**
	 * Appends a level-up evolution to `targetId`. The method can be switched
	 * afterward with {@link setEvolutionMethod}.
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
	 * Removes the evolution at `index`; an out-of-range index is a no-op.
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
	 * Sets the target species of the evolution at `index`. An out-of-range index
	 * is a no-op.
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
	 * Switches the method of the evolution at `index`, rebuilding it with the
	 * fields that method requires: level and friendship keep an existing level,
	 * item keeps an item, place keeps a place. An out-of-range index is a no-op.
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
	 * Sets the trigger level of the evolution at `index`, for the level and
	 * friendship methods. Any other method or an out-of-range index is a no-op.
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
	 * Sets the required item of the evolution at `index`, for the item method.
	 * Any other method or an out-of-range index is a no-op.
	 *
	 * @param index Zero-based position in the evolutions array.
	 * @param itemId The item id required to evolve.
	 */
	setEvolutionItem(index: number, itemId: string): Species {
		let evolution = this.#species.evolutions[index];
		if (evolution && "itemId" in evolution) evolution.itemId = itemId;
		return this.toSpecies();
	}

	clearSprite(): Species {
		this.#species.sprite = null;
		return this.toSpecies();
	}

	/**
	 * Associates a sprite stored as a named region of an atlas.
	 *
	 * @param atlas The manifest atlas id.
	 * @param region The named region inside that atlas.
	 */
	setAtlasSprite(atlas: string, region: string): Species {
		this.#species.sprite = { atlas, region };
		return this.toSpecies();
	}

	/**
	 * Associates a sprite stored as a standalone manifest image.
	 *
	 * @param image The manifest image id.
	 */
	setImageSprite(image: string): Species {
		this.#species.sprite = { image };
		return this.toSpecies();
	}

	/**
	 * Serializes the current state to a fresh {@link Species}. Every nested value
	 * is deep-copied, so the editor's state stays isolated from the snapshot.
	 *
	 * @returns The current species record.
	 */
	toSpecies(): Species {
		return this.#clone(this.#species);
	}

	#sortLearnset(): void {
		this.#species.learnset = [...this.#species.learnset].sort((a, b) => {
			let levelA = "level" in a ? a.level : Number.POSITIVE_INFINITY;
			let levelB = "level" in b ? b.level : Number.POSITIVE_INFINITY;
			return levelA - levelB;
		});
	}

	#whole(value: number, fallback: number): number {
		if (!Number.isFinite(value)) return fallback;
		return Math.max(0, Math.trunc(value));
	}

	#percent(value: number): number {
		if (!Number.isFinite(value)) return 0;
		return Math.min(100, Math.max(0, value));
	}

	/** Deep copy, so snapshots stay independent of the editor's state. */
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

	#cloneSprite(sprite: SpeciesSprite): SpeciesSprite {
		if (sprite === null) return null;
		return { ...sprite } as SpeciesSprite;
	}
}
