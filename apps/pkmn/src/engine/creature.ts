import type { MoveId } from "~/domain/move";
import type { Nature } from "~/domain/nature";
import type { Species } from "~/domain/species";

import type { StatSet } from "../domain/stat";

export type MoveSet = [MoveId, MoveId | null, MoveId | null, MoveId | null];

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

	get speciesId() {
		return this.args.species;
	}

	get name() {
		return this.args.nickname || this.args.species;
	}

	get natureId() {
		return this.args.nature;
	}

	get experience() {
		return this.args.experience;
	}

	get moveset() {
		return this.args.moveset;
	}

	get status() {
		return this.args.status;
	}

	get iv() {
		return this.args.iv;
	}

	get ev() {
		return this.args.ev;
	}

	toJSON(): Creature.Arguments {
		return structuredClone(this.args);
	}

	static fromJSON(json: Creature.Arguments): Creature {
		return new Creature(json);
	}
}
