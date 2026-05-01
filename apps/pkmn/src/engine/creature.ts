import type { MoveId } from "~/domain/move";
import type { NatureId } from "~/domain/nature";
import type { SpeciesId } from "~/domain/species";

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
	export type SizeClass = "xs" | "sm" | "md" | "lg" | "xl" | "alpha";

	export interface SizeData {
		scale: number;
		weight: number;
		alpha?: boolean;
	}

	export interface Arguments {
		species: SpeciesId;
		nickname?: string;
		nature: NatureId;
		experience: number;
		moveset: MoveSet;
		status: {
			state: State | null;
			damage: number;
			pp: [number, number, number, number];
		};
		iv: StatSet;
		ev: StatSet;
		size?: SizeData;
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

	get size() {
		return this.args.size ?? { scale: 128, weight: 128 };
	}

	toJSON(): Creature.Arguments {
		return structuredClone(this.args);
	}

	static fromJSON(json: Creature.Arguments): Creature {
		return new Creature(json);
	}
}
