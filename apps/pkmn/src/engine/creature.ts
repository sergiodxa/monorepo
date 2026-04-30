import type { Nature } from "~/domain/nature";
import type { Species } from "~/domain/species";

import { LEVEL_CAP } from "~/constant";

import type { StatSet } from "../domain/stat";

import { MOVES } from "../content/moves";
import { NATURES } from "../content/natures";
import { GrowthRate } from "../domain/growth-rate";
import { Stat } from "../domain/stat";

import { Bestiary } from "./bestiary";

export type MoveSet = [
	keyof typeof MOVES,
	keyof typeof MOVES | null,
	keyof typeof MOVES | null,
	keyof typeof MOVES | null,
];

export enum State {
	Burned,
	Paralyzed,
	Poisoned,
	Asleep,
	Frozen,
}

export namespace Creature {
	export interface Arguments {
		species: Species.Symbol;
		nickname?: string;
		nature: Nature.Symbol;
		experience: number;
		moveset: MoveSet;
		status: {
			state: State | null;
			damage: number;
			pp: [number, number, number, number];
		};
		iv: StatSet;
		ev: StatSet;
	}
}

export class Creature {
	constructor(private readonly args: Creature.Arguments) {}

	get species() {
		let species = Bestiary.species.get(this.args.species);
		if (species) return species;
		throw new ReferenceError(
			`Species with symbol ${String(this.args.species)} not found in bestiary.`,
		);
	}

	get name() {
		return this.args.nickname || this.args.species;
	}

	get nature() {
		if (this.args.nature in NATURES) return NATURES[this.args.nature]!;
		throw new ReferenceError(`Nature with symbol ${String(this.args.nature)} not found.`);
	}

	get experience() {
		return this.args.experience;
	}

	get moveset() {
		return this.args.moveset;
	}

	get level(): number {
		let { growthRate } = this.species;
		switch (growthRate) {
			case GrowthRate.Fast: {
				return Math.min(LEVEL_CAP, Math.floor(Math.cbrt(this.experience) * 5));
			}
			case GrowthRate.MediumFast: {
				return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(this.experience) * 10));
			}
			case GrowthRate.MediumSlow: {
				return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(this.experience) * 10));
			}
			case GrowthRate.Slow: {
				return Math.min(LEVEL_CAP, Math.floor(Math.cbrt(this.experience) * 5));
			}
			case GrowthRate.Fluctuating: {
				if (this.experience < 500000) {
					return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(this.experience) * 10));
				} else if (this.experience < 1000000) {
					return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(this.experience) * 10));
				} else {
					return Math.min(LEVEL_CAP, Math.floor(Math.sqrt(this.experience) * 10));
				}
			}
			default: {
				throw new Error(`Unknown growth rate: ${growthRate}`);
			}
		}
	}

	get hp() {
		return this.calculateStat(Stat.HP);
	}

	get currentHP() {
		return this.hp - this.status.damage;
	}

	get attack() {
		return this.calculateStat(Stat.Attack);
	}

	get defense() {
		return this.calculateStat(Stat.Defense);
	}

	get specialAttack() {
		return this.calculateStat(Stat.SpecialAttack);
	}

	get specialDefense() {
		return this.calculateStat(Stat.SpecialDefense);
	}

	get speed() {
		return this.calculateStat(Stat.Speed);
	}

	get status() {
		return this.args.status;
	}

	toJSON(): Creature.Arguments {
		return structuredClone(this.args);
	}

	static fromJSON(json: Creature.Arguments): Creature {
		return new Creature(json);
	}

	private calculateStat(stat: Stat): number {
		let baseStatValue =
			this.species.stats[stat] * 2 + this.args.iv[stat] + Math.floor(this.args.ev[stat] / 4);

		if (stat === Stat.HP) {
			return Math.floor((baseStatValue * this.level) / 100) + this.level + 10;
		}

		let statValue = Math.floor((baseStatValue * this.level) / 100) + 5;

		if (this.nature.increases === stat) {
			return Math.floor(statValue * 1.1);
		} else if (this.nature.decreases === stat) {
			return Math.floor(statValue * 0.9);
		} else {
			return statValue;
		}
	}
}
