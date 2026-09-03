/**
 * The vocabulary a generator draws from. A dataset is plain data with no
 * behavior, so an application can hand in its own lists and get values in its
 * own language without touching the generators.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A country, its ISO 3166-1 alpha-2 code, and the cities that belong to it. */
export interface Country {
	name: string;
	code: string;
	cities: readonly string[];
}

/** Given names, split so a caller can ask for one of a particular sex. */
export interface FirstNames {
	female: readonly string[];
	male: readonly string[];
}

/** Every list the built-in modules read. */
export interface Dataset {
	firstNames: FirstNames;
	lastNames: readonly string[];
	/** Titles that open a name, such as `"Dr."`. */
	namePrefixes: readonly string[];
	/** Titles that close a name, such as `"Jr."`. */
	nameSuffixes: readonly string[];
	/** The words a sex is named by, in the order female, male. */
	sexes: readonly string[];
	/** Gender identities, a longer list than {@link Dataset.sexes}. */
	genders: readonly string[];
	zodiacSigns: readonly string[];
	/** Fields of work, such as `"Accounts"`. */
	jobAreas: readonly string[];
	/** Words that qualify a job title, such as `"Regional"`. */
	jobDescriptors: readonly string[];
	/** Kinds of role, such as `"Architect"`. */
	jobTypes: readonly string[];

	/**
	 * Cities live under their country, which is what lets a city be asked for
	 * by country and keeps a generated address internally consistent.
	 */
	countries: readonly Country[];
	continents: readonly string[];
	/** First-level divisions, paired with the abbreviation an address uses. */
	states: readonly { name: string; abbreviation: string }[];
	counties: readonly string[];
	streetNames: readonly string[];
	/** Words that close a street name, such as `"Avenue"`. */
	streetSuffixes: readonly string[];
	/** Words naming a unit within a building, such as `"Apt."`. */
	secondaryAddressPrefixes: readonly string[];
	/** Compass directions, in the order north, east, south, west, then the four between. */
	directions: readonly string[];
	languages: readonly string[];
	timeZones: readonly string[];
	/** Month names, January first. */
	months: readonly string[];
	/** Weekday names, Sunday first. */
	weekdays: readonly string[];

	/** Distinctive words a company name is built from, such as `"Meridian"`. */
	companyWords: readonly string[];
	/** Words that close a company name, such as `"Labs"`. */
	companySuffixes: readonly string[];
	buzzAdjectives: readonly string[];
	buzzNouns: readonly string[];
	buzzVerbs: readonly string[];
	catchPhraseAdjectives: readonly string[];
	catchPhraseDescriptors: readonly string[];
	catchPhraseNouns: readonly string[];

	/** The vocabulary placeholder prose is assembled from. */
	lorem: readonly string[];
	emojis: readonly string[];
	/** Color names a person would use, such as `"teal"`. */
	colorNames: readonly string[];

	hackerAbbreviations: readonly string[];
	hackerAdjectives: readonly string[];
	hackerNouns: readonly string[];
	hackerVerbs: readonly string[];
	/** Verbs in their `-ing` form, such as `"quantifying"`. */
	hackerIngverbs: readonly string[];

	/** Words a commit message is built from, in verb-then-object order. */
	commitVerbs: readonly string[];
	commitObjects: readonly string[];

	/** File extensions in everyday use, such as `"pdf"`. */
	commonFileExtensions: readonly string[];
	/** Broad file kinds in everyday use, such as `"image"`. */
	commonFileTypes: readonly string[];
	/** The full extension list, wider than {@link Dataset.commonFileExtensions}. */
	fileExtensions: readonly string[];
	mimeTypes: readonly string[];
	/** Absolute directories a file path is built under. */
	directoryPaths: readonly string[];
	/** Words a file name is built from. */
	fileWords: readonly string[];
}
