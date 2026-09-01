/**
 * The vocabulary a generator draws from. A dataset is plain data with no
 * behavior, so an application can hand in its own lists and get values in its
 * own language without touching the generators.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A country and the cities that belong to it. */
export interface Country {
	name: string;
	cities: readonly string[];
}

/** Every list the built-in modules read. */
export interface Dataset {
	firstNames: readonly string[];
	lastNames: readonly string[];
	/**
	 * Cities live under their country, which is what lets a city be asked for
	 * by country and keeps a generated address internally consistent.
	 */
	countries: readonly Country[];
	/** Distinctive words a company name is built from, such as `"Meridian"`. */
	companyWords: readonly string[];
	/** Words that close a company name, such as `"Labs"`. */
	companySuffixes: readonly string[];
	/** The vocabulary placeholder prose is assembled from. */
	lorem: readonly string[];
}
