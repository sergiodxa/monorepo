/**
 * Battle mechanics helpers for resolving creature-derived values from the game data layer.
 *
 * This module centralizes the stateless calculations and lookups that turn stored creature
 * state into runtime battle values, such as species data, nature data, experience thresholds,
 * levels, and computed stats.
 *
 * By keeping these rules in a single module, the battle engine can depend on a consistent set
 * of formulas and guards without coupling those decisions to rendering, persistence, or other
 * gameplay systems.
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

/** Returns the loaded species record for a creature. */
export function getCreatureSpecies(gameData: GameData, creature: Creature): Species {
	let species = gameData.species.get(creature.speciesId);
	if (species) return species;
	throw new ReferenceError(`Species with symbol ${String(creature.speciesId)} not found.`);
}

/** Returns the loaded nature record for a creature. */
export function getCreatureNature(gameData: GameData, creature: Creature) {
	let nature = gameData.natures.get(creature.natureId);
	if (nature) return nature;
	throw new ReferenceError(`Nature with symbol ${String(creature.natureId)} not found.`);
}

/** Computes a creature level from its current experience and growth rate. */
export function getCreatureLevel(gameData: GameData, creature: Creature): number {
	let { growthRate } = getCreatureSpecies(gameData, creature);

	for (let level = LEVEL_CAP; level > 1; level -= 1) {
		if (creature.experience >= getExperienceForLevel(growthRate, level)) return level;
	}

	return 1;
}

/** Returns the total experience required for a growth rate at a given level. */
export function getExperienceForLevel(growthRate: GrowthRate, level: number): number {
	let normalizedLevel = Math.max(1, Math.min(level, LEVEL_CAP));
	if (normalizedLevel === 1) return 0;

	switch (growthRate) {
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
			throw new RangeError(`Unknown growth rate: ${growthRate}`);
		}
	}
}

/** Computes one stat value for a creature using loaded species and nature data. */
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

/** Returns physical dimensions after applying the creature's individual size class. */
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

/** Returns the current remaining HP for a creature. */
export function getCreatureCurrentHP(gameData: GameData, creature: Creature): number {
	return getCreatureStat(gameData, creature, Stat.HP) - creature.status.damage;
}
