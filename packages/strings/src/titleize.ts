/**
 * Headline-style capitalization following the Chicago Manual of Style: every
 * word is capitalized except articles, coordinating conjunctions, prepositions
 * of any length, `as`, and infinitive `to`, with the first and last word and the
 * word after a colon always capitalized. A `special` list renders names whose
 * casing cannot be derived (`iOS`, `npm`, a lowercase brand) exactly as written,
 * and identifiers and inline code keep the form the author typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Vocabulary } from "./casing.js";

import { recase, toVocabulary } from "./casing.js";
import { upperFirst } from "./segment.js";

/** Options for {@link titleize}. */
export interface TitleizeOptions {
	/**
	 * Words and multi-word names rendered exactly as written whenever they appear,
	 * matched case-insensitively. Entries extend the built-in set and override it,
	 * and they beat every other rule including the small-word list.
	 */
	special?: ReadonlyArray<string>;
}

/** A titleizer bound to one vocabulary, returned by {@link createTitleizer}. */
export interface Titleizer {
	/** Applies headline-style capitalization to a title. */
	(value: string): string;
}

/** Articles, which Chicago lowercases inside a title. */
const ARTICLES: ReadonlyArray<string> = ["a", "an", "the"];

/** Coordinating conjunctions, which Chicago lowercases inside a title. */
const COORDINATING_CONJUNCTIONS: ReadonlyArray<string> = [
	"and",
	"but",
	"for",
	"nor",
	"or",
	"so",
	"yet",
];

/**
 * Prepositions, which Chicago lowercases regardless of length — the rule that
 * separates Chicago style from AP. The list can't be exhaustive, so an
 * unlisted preposition renders capitalized instead of lowercase.
 */
const PREPOSITIONS: ReadonlyArray<string> = [
	"aboard",
	"about",
	"above",
	"absent",
	"across",
	"afore",
	"after",
	"against",
	"along",
	"alongside",
	"amid",
	"amidst",
	"among",
	"amongst",
	"around",
	"as",
	"aside",
	"astride",
	"at",
	"athwart",
	"atop",
	"barring",
	"before",
	"behind",
	"below",
	"beneath",
	"beside",
	"besides",
	"between",
	"beyond",
	"by",
	"circa",
	"concerning",
	"considering",
	"despite",
	"down",
	"during",
	"except",
	"excepting",
	"excluding",
	"failing",
	"following",
	"from",
	"given",
	"in",
	"including",
	"inside",
	"into",
	"like",
	"mid",
	"midst",
	"minus",
	"near",
	"notwithstanding",
	"of",
	"off",
	"on",
	"onto",
	"opposite",
	"out",
	"outside",
	"over",
	"pace",
	"past",
	"pending",
	"per",
	"plus",
	"pro",
	"qua",
	"regarding",
	"respecting",
	"round",
	"sans",
	"save",
	"saving",
	"since",
	"than",
	"through",
	"throughout",
	"thru",
	"till",
	"times",
	"to",
	"toward",
	"towards",
	"under",
	"underneath",
	"unlike",
	"until",
	"unto",
	"up",
	"upon",
	"versus",
	"via",
	"vs",
	"vice",
	"with",
	"within",
	"without",
	"worth",
];

/**
 * Every word lowercased inside a title. `to` is here for the infinitive case
 * (`"How to Write"`) as much as for the preposition.
 */
const SMALL_WORDS: ReadonlySet<string> = new Set([
	...ARTICLES,
	...COORDINATING_CONJUNCTIONS,
	...PREPOSITIONS,
]);

/**
 * Capitalizes one word unless it is a small word, with `force` used for the
 * positions Chicago always capitalizes: the first word, the last word, and the
 * word right after a colon. A `special` entry short-circuits both.
 */
function renderWord(word: string, vocabulary: Vocabulary, force: boolean): string {
	let match = vocabulary.word(word);
	if (match !== undefined) return match;
	if (force) return upperFirst(word);
	if (SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
	return upperFirst(word);
}

/**
 * Capitalizes a hyphenated compound element by element. The first element is
 * always capitalized, later elements follow the small-word rule, and the final
 * element is capitalized when the compound closes the title.
 */
function renderCompound(core: string, vocabulary: Vocabulary, last: boolean): string {
	let elements = core.split("-");

	return elements
		.map((element, index) => {
			if (element.length === 0) return element;
			let force = index === 0 || (last && index === elements.length - 1);
			return renderWord(element, vocabulary, force);
		})
		.join("-");
}

/**
 * Applies the Chicago rules across a title, capitalizing the first and last word
 * and the word after a subtitle colon even when it is a small word.
 */
function applyRules(value: string, vocabulary: Vocabulary): string {
	return recase(value, vocabulary, (core, { first, last, afterColon }) =>
		core.includes("-")
			? renderCompound(core, vocabulary, last)
			: renderWord(core, vocabulary, first || last || afterColon),
	);
}

/**
 * Creates a titleizer bound to a vocabulary, so an app declares the names it
 * publishes once instead of repeating `special` at every call site.
 *
 * @param options - Words rendered exactly as written
 * @returns A function applying headline-style capitalization
 * @example createTitleizer({ special: ["Remix"] })("getting started with remix")
 */
export function createTitleizer(options: TitleizeOptions = {}): Titleizer {
	let vocabulary = toVocabulary(options.special ?? []);
	return (value: string) => applyRules(value, vocabulary);
}

/** The titleizer backing {@link titleize} when no `special` list is passed. */
const DEFAULT_TITLEIZER = createTitleizer();

/**
 * Headline-style capitalization per the Chicago Manual of Style, meant for
 * headings an author writes in English. Headline case is an English-specific
 * convention, so localized copy follows its own capitalization rules.
 *
 * @param value - Title to capitalize
 * @param options - Words rendered exactly as written
 * @example titleize("the state of javascript in 2026")
 * @example titleize("FaCEbook is great", { special: ["facebook"] })
 */
export function titleize(value: string, options?: TitleizeOptions): string {
	if (options?.special === undefined) return DEFAULT_TITLEIZER(value);
	return createTitleizer(options)(value);
}
