/**
 * Headline-style capitalization following the Chicago Manual of Style: every
 * word is capitalized except articles, coordinating conjunctions, prepositions
 * of any length, `as`, and infinitive `to`, with the first and last word and the
 * word after a colon always capitalized. A `special` list renders names whose
 * casing cannot be derived (`iOS`, `npm`, a lowercase brand) exactly as written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { upperFirst } from "./segment";

/** Options for {@link titleize}. */
export interface TitleizeOptions {
	/**
	 * Words rendered exactly as written whenever they appear, matched
	 * case-insensitively. Entries extend the built-in set and override it, and
	 * they beat every other rule including the small-word list.
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
 * Prepositions, which Chicago lowercases regardless of length. This is the rule
 * that separates Chicago from AP style, and the list is the part of this module
 * most likely to be incomplete: English has well over a hundred prepositions,
 * and an unlisted one is capitalized when it should not be.
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
 * Names whose casing cannot be derived from the word itself. Deliberately kept
 * small: product and technology vocabulary belongs to the app that publishes it,
 * declared once through {@link createTitleizer}.
 */
const DEFAULT_SPECIAL: ReadonlyArray<string> = [
	"API",
	"APIs",
	"CDN",
	"CLI",
	"CSS",
	"CSV",
	"DNS",
	"GitHub",
	"GitLab",
	"HTML",
	"HTTP",
	"HTTPS",
	"iMac",
	"iOS",
	"iPad",
	"iPadOS",
	"iPhone",
	"JavaScript",
	"JSON",
	"JWT",
	"macOS",
	"MySQL",
	"Node.js",
	"npm",
	"OAuth",
	"OpenID",
	"PDF",
	"PostgreSQL",
	"RSS",
	"SDK",
	"SQL",
	"SQLite",
	"SVG",
	"TypeScript",
	"UI",
	"URL",
	"URLs",
	"UX",
	"XML",
	"YAML",
];

/** Characters that are neither a letter nor a number, anchored at the start. */
const LEADING_SYMBOLS = /^[^\p{L}\p{N}]*/u;

/** Characters that are neither a letter nor a number, anchored at the end. */
const TRAILING_SYMBOLS = /[^\p{L}\p{N}]*$/u;

/** A run of whitespace, used to tell separators from words. */
const WHITESPACE = /^\s+$/u;

/** A whitespace-delimited chunk of a title, split from its punctuation shell. */
interface TitlePart {
	/** The chunk exactly as it appeared in the input. */
	raw: string;
	/** Punctuation before the word, such as an opening quote or bracket. */
	leading: string;
	/** The word itself, which may still contain hyphens and apostrophes. */
	core: string;
	/** Punctuation after the word, such as a comma or the subtitle colon. */
	trailing: string;
	/** False for whitespace runs and for chunks that are punctuation only. */
	isWord: boolean;
}

/**
 * Splits a title into words and separators, keeping punctuation out of the word
 * so `"v3:"` matches the small-word and `special` lists as `"v3"` while its
 * colon still marks the start of a subtitle.
 */
function toParts(value: string): TitlePart[] {
	let parts: TitlePart[] = [];

	for (let raw of value.split(/(\s+)/u)) {
		if (raw.length === 0) continue;

		if (WHITESPACE.test(raw)) {
			parts.push({ raw, leading: "", core: "", trailing: "", isWord: false });
			continue;
		}

		let leading = LEADING_SYMBOLS.exec(raw)?.[0] ?? "";
		let rest = raw.slice(leading.length);
		let trailing = TRAILING_SYMBOLS.exec(rest)?.[0] ?? "";
		let core = rest.slice(0, rest.length - trailing.length);

		parts.push({ raw, leading, core, trailing, isWord: core.length > 0 });
	}

	return parts;
}

/**
 * Builds the `special` lookup, keyed by the lowercased word so matching ignores
 * how the author typed it. Caller entries are added last so they override the
 * built-in set.
 */
function toSpecialMap(special: ReadonlyArray<string>): Map<string, string> {
	let map = new Map<string, string>();
	for (let entry of [...DEFAULT_SPECIAL, ...special]) map.set(entry.toLowerCase(), entry);
	return map;
}

/**
 * Capitalizes one word unless it is a small word, with `force` used for the
 * positions Chicago always capitalizes: the first word, the last word, and the
 * word right after a colon. A `special` entry short-circuits both.
 */
function renderWord(word: string, special: Map<string, string>, force: boolean): string {
	let match = special.get(word.toLowerCase());
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
function renderCompound(core: string, special: Map<string, string>, last: boolean): string {
	let elements = core.split("-");

	return elements
		.map((element, index) => {
			if (element.length === 0) return element;
			let force = index === 0 || (last && index === elements.length - 1);
			return renderWord(element, special, force);
		})
		.join("-");
}

/**
 * Applies the Chicago rules across a whole title, tracking the subtitle colon so
 * the word that starts a subtitle is capitalized even when it is a small word.
 */
function applyRules(value: string, special: Map<string, string>): string {
	let parts = toParts(value);
	let wordIndexes: number[] = [];

	for (let [index, part] of parts.entries()) {
		if (part.isWord) wordIndexes.push(index);
	}

	let firstIndex = wordIndexes.at(0);
	let lastIndex = wordIndexes.at(-1);
	let afterColon = false;
	let result: string[] = [];

	for (let [index, part] of parts.entries()) {
		if (!part.isWord) {
			result.push(part.raw);
			if (part.raw.includes(":")) afterColon = true;
			continue;
		}

		let first = index === firstIndex;
		let last = index === lastIndex;
		let force = first || last || afterColon;
		// A `special` entry is matched against the whole word first, so a
		// hyphenated entry survives instead of being split into elements.
		let core =
			special.get(part.core.toLowerCase()) ??
			(part.core.includes("-")
				? renderCompound(part.core, special, last)
				: renderWord(part.core, special, force));

		result.push(part.leading + core + part.trailing);
		afterColon = part.trailing.includes(":");
	}

	return result.join("");
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
	let special = toSpecialMap(options.special ?? []);
	return (value: string) => applyRules(value, special);
}

/** The titleizer backing {@link titleize} when no `special` list is passed. */
const DEFAULT_TITLEIZER = createTitleizer();

/**
 * Headline-style capitalization per the Chicago Manual of Style. Intended for
 * authored English headings, not for text a user typed, and not for localized
 * copy: headline case is an English convention.
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
