/**
 * Defines the world-level creature model used by this part of the game domain.
 * It centralizes the shape of creature data, exposes the public value object used
 * by the rest of the world layer, and keeps the supported fields for identity,
 * progression, combat state, and size in one place.
 *
 * This module also provides the narrow serialization boundary for creature
 * instances. It preserves a stable contract for constructing creatures, reading
 * their state through accessors, and converting them to and from plain data
 * without coupling callers to internal storage details.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MoveId } from "~/game/data/move";
import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";
import type { StatSet } from "~/game/data/stat";
import type { State } from "~/game/data/status";

export { State } from "~/game/data/status";

export type MoveSet = [MoveId, MoveId | null, MoveId | null, MoveId | null];

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
			poison?: "regular" | "escalating";
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
