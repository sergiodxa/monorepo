import type { GameData } from "~/content/game-data";
import type { Species } from "~/domain/species";

import { LEVEL_CAP } from "~/constant";

import { GrowthRate } from "../domain/growth-rate";
import { Stat } from "../domain/stat";

import type { Creature } from "./creature";

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
	switch (growthRate) {
		case GrowthRate.Fast: {
			return Math.min(LEVEL_CAP, Math.floor(Math.cbrt(creature.experience) * 5));
		}
		case GrowthRate.MediumFast: {
			return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(creature.experience) * 10));
		}
		case GrowthRate.MediumSlow: {
			return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(creature.experience) * 10));
		}
		case GrowthRate.Slow: {
			return Math.min(LEVEL_CAP, Math.floor(Math.cbrt(creature.experience) * 5));
		}
		case GrowthRate.Fluctuating: {
			if (creature.experience < 500000) {
				return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(creature.experience) * 10));
			}

			if (creature.experience < 1000000) {
				return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(creature.experience) * 10));
			}

			return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(creature.experience) * 10));
		}
		default: {
			throw new Error(`Unknown growth rate: ${growthRate}`);
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

/** Returns the current remaining HP for a creature. */
export function getCreatureCurrentHP(gameData: GameData, creature: Creature): number {
	return getCreatureStat(gameData, creature, Stat.HP) - creature.status.damage;
}
