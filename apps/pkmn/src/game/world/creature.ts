/**
 * World-level creature model: a stable value object and serialization
 * boundary for identity, progression, combat state, and size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ItemId } from "~/game/data/item";
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
		/**
		 * Item this creature is carrying, or null/undefined when it holds nothing.
		 * Optional so persisted creatures and fixtures that predate held items build
		 * unchanged; absence reads the same as holding nothing.
		 */
		heldItemId?: ItemId | null;
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

	get heldItemId() {
		return this.args.heldItemId ?? null;
	}

	toJSON(): Creature.Arguments {
		return structuredClone(this.args);
	}

	static fromJSON(json: Creature.Arguments): Creature {
		return new Creature(json);
	}
}
