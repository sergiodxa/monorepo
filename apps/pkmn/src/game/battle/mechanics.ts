/**
 * Stateless calculations that turn stored creature state into runtime battle
 * values — species and nature lookups, experience thresholds, levels, stats, and
 * size — so the whole engine shares one set of formulas and guards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { Size, Species } from "~/game/data/species";
import type { Creature } from "~/game/world/creature";

import { LEVEL_CAP } from "~/game/constant";
import { GrowthRate } from "~/game/data/growth-rate";
import { Stat } from "~/game/data/stat";

/** @throws ReferenceError When the species id is absent from the loaded data. */
export function getCreatureSpecies(gameData: GameData, creature: Creature): Species {
	let species = gameData.species.get(creature.speciesId);
	if (species) return species;
	throw new ReferenceError(`Species with symbol ${String(creature.speciesId)} not found.`);
}

/** @throws ReferenceError When the nature id is absent from the loaded data. */
export function getCreatureNature(gameData: GameData, creature: Creature) {
	let nature = gameData.natures.get(creature.natureId);
	if (nature) return nature;
	throw new ReferenceError(`Nature with symbol ${String(creature.natureId)} not found.`);
}

/** Highest level the creature's experience reaches, capped at {@link LEVEL_CAP}. */
export function getCreatureLevel(gameData: GameData, creature: Creature): number {
	let { growthRate } = getCreatureSpecies(gameData, creature);

	for (let level = LEVEL_CAP; level > 1; level -= 1) {
		if (creature.experience >= getExperienceForLevel(growthRate, level)) return level;
	}

	return 1;
}

/**
 * Cumulative experience needed to reach a level under a growth rate; the level is
 * clamped to the 1..{@link LEVEL_CAP} range first.
 *
 * @throws RangeError When the growth rate has no curve.
 */
export function getExperienceForLevel(growthRate: GrowthRate, level: number): number {
	let normalizedLevel = Math.max(1, Math.min(level, LEVEL_CAP));
	if (normalizedLevel === 1) return 0;

	switch (growthRate) {
		case GrowthRate.Erratic: {
			if (normalizedLevel <= 50) {
				return Math.floor((normalizedLevel ** 3 * (100 - normalizedLevel)) / 50);
			}

			if (normalizedLevel <= 68) {
				return Math.floor((normalizedLevel ** 3 * (150 - normalizedLevel)) / 100);
			}

			if (normalizedLevel <= 98) {
				return Math.floor(
					(normalizedLevel ** 3 * Math.floor((1911 - 10 * normalizedLevel) / 3)) / 500,
				);
			}

			return Math.floor((normalizedLevel ** 3 * (160 - normalizedLevel)) / 100);
		}
		case GrowthRate.Fast: {
			return Math.floor((4 * normalizedLevel ** 3) / 5);
		}
		case GrowthRate.MediumFast: {
			return normalizedLevel ** 3;
		}
		case GrowthRate.MediumSlow: {
			return Math.floor(
				(6 * normalizedLevel ** 3) / 5 - 15 * normalizedLevel ** 2 + 100 * normalizedLevel - 140,
			);
		}
		case GrowthRate.Slow: {
			return Math.floor((5 * normalizedLevel ** 3) / 4);
		}
		case GrowthRate.Fluctuating: {
			if (normalizedLevel <= 15) {
				return Math.floor((normalizedLevel ** 3 * (normalizedLevel + 73)) / 150);
			}

			if (normalizedLevel <= 36) {
				return Math.floor((normalizedLevel ** 3 * (normalizedLevel + 14)) / 50);
			}

			return Math.floor((normalizedLevel ** 3 * (normalizedLevel + 64)) / 100);
		}
		default: {
			throw new RangeError(`Unknown growth rate: ${String(growthRate)}`);
		}
	}
}

/** Full stat value at the creature's current level, with its nature applied. */
export function getCreatureStat(gameData: GameData, creature: Creature, stat: Stat): number {
	let species = getCreatureSpecies(gameData, creature);
	let nature = getCreatureNature(gameData, creature);
	let level = getCreatureLevel(gameData, creature);
	let baseStatValue =
		species.stats[stat] * 2 + creature.iv[stat] + Math.floor(creature.ev[stat] / 4);

	if (stat === Stat.HP) {
		return Math.floor((baseStatValue * level) / 100) + level + 10;
	}

	let statValue = Math.floor((baseStatValue * level) / 100) + 5;

	if (nature.increases === stat) return Math.floor(statValue * 1.1);
	if (nature.decreases === stat) return Math.floor(statValue * 0.9);
	return statValue;
}

/**
 * Species dimensions with the creature's own scale applied to height; alpha
 * creatures always scale at the maximum.
 */
export function getCreatureSize(gameData: GameData, creature: Creature): Size {
	let species = getCreatureSpecies(gameData, creature);
	let scale = creature.size.alpha ? 255 : creature.size.scale;
	let heightMultiplier = (scale / 255) * 0.4 + 0.8;

	return {
		weight: species.size.weight,
		height: species.size.height * heightMultiplier,
	};
}

/** Buckets one creature's saved scale into the broad size classes used by this game. */
export function getCreatureSizeClass(creature: Creature): Creature.SizeClass {
	if (creature.size.alpha) return "alpha";
	if (creature.size.scale <= 59) return "xs";
	if (creature.size.scale <= 99) return "sm";
	if (creature.size.scale <= 155) return "md";
	if (creature.size.scale <= 195) return "lg";
	return "xl";
}

/** Max HP at the creature's current level minus its accumulated damage. */
export function getCreatureCurrentHP(gameData: GameData, creature: Creature): number {
	return getCreatureStat(gameData, creature, Stat.HP) - creature.status.damage;
}
