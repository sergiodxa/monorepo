import type { SpeciesId } from "~/domain/species";

export namespace Bestiary {
	export interface Arguments {
		sight: Array<SpeciesId>;
		caught: Array<SpeciesId>;
	}
}

export class Bestiary {
	/** Set of species that have been sighted */
	readonly sight = new Set<SpeciesId>();

	/** Set of species that have been caught */
	readonly caught = new Set<SpeciesId>();

	constructor(args: Bestiary.Arguments) {
		args.sight.forEach((species) => this.sight.add(species));
		args.caught.forEach((species) => {
			this.caught.add(species);
			// If a species is caught, it must have been sighted as well
			if (this.sight.has(species) === false) this.sight.add(species);
		});
	}

	/**
	 * Marks a species as sighted. If the species was not previously sighted, it will be added to the sight set.
	 * @param species - The species to mark as sighted, represented as a key of the SPECIES constant.
	 */
	markAsSighted(species: SpeciesId) {
		this.sight.add(species);
	}

	/**
	 * Marks a species as caught. If the species was not previously caught, it will be added to the caught set. Additionally, if
	 * the species was not previously sighted, it will also be added to the sight set.
	 * @param species - The species to mark as caught, represented as a key of the SPECIES constant.
	 */
	markAsCaught(species: SpeciesId) {
		this.caught.add(species);
		if (this.sight.has(species) === false) this.sight.add(species);
	}

	/**
	 * Serializes the bestiary to a JSON-compatible format. The sight and caught sets are converted to arrays for serialization.
	 * @returns An object containing the sight and caught arrays, which can be serialized to JSON.
	 */
	toJSON() {
		return { sight: Array.from(this.sight), caught: Array.from(this.caught) };
	}

	/**
	 * Revives a bestiary from a JSON-compatible format. The sight and caught arrays are converted back to sets for use in the
	 * Bestiary class.
	 * @param input - An object containing the sight and caught arrays, typically obtained from parsing a JSON string.
	 * @returns A new instance of the Bestiary class with the sight and caught sets populated based on the input arrays.
	 */
	static fromJSON(input: ReturnType<Bestiary["toJSON"]>) {
		return new Bestiary({ sight: input.sight, caught: input.caught });
	}
}
