/**
 * Places. A city can be asked for on its own or from a named country, and the
 * two stay consistent because the dataset stores cities under the country they
 * belong to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

/** Options for a generated city. */
export interface CityOptions {
	/** Restricts the city to one country, matched by its name in the dataset. */
	country?: string;
}

/** Cities and countries. */
export interface LocationModule {
	/**
	 * A city, from `country` when one is named.
	 *
	 * @throws RangeError when the dataset carries no country by that name, so a
	 * typo surfaces instead of quietly returning a city from somewhere else.
	 */
	city(options?: CityOptions): string;
	country(): string;
}

/** Create the `location` module over one stream and dataset. */
export function createLocationModule(random: Random, data: Dataset): LocationModule {
	return {
		city(options = {}) {
			if (options.country === undefined) {
				return random.pick(random.pick(data.countries).cities);
			}
			let country = data.countries.find((candidate) => candidate.name === options.country);
			if (country === undefined) {
				throw new RangeError(`city() found no country named "${options.country}" in the dataset.`);
			}
			return random.pick(country.cities);
		},
		country() {
			return random.pick(data.countries).name;
		},
	};
}
