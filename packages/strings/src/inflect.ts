/**
 * English inflection: plural and singular forms plus the identifier casings
 * (camel, underscore, dash) and the display casings (sentence case, ordinals).
 * Rules are owned by an inflector instance instead of a global registry, so a
 * product adds its own vocabulary without making every other caller's results
 * depend on import order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { lowerFirst, upperFirst } from "./segment";

/** A single rewrite rule: the first pattern that matches a word wins. */
interface InflectionRule {
	pattern: RegExp;
	replacement: string;
}

/** A singular form paired with its plural form. */
export type IrregularPair = readonly [singular: string, plural: string];

/** Vocabulary an inflector adds on top of the default English rules. */
export interface InflectorOptions {
	/** Word pairs whose plural cannot be derived, e.g. `["person", "people"]`. */
	irregular?: ReadonlyArray<IrregularPair>;
	/** Words that are identical in both numbers, e.g. `"uptime"`. */
	uncountable?: ReadonlyArray<string>;
}

/** Options for {@link camelize}. */
export interface CamelizeOptions {
	/** Uppercase the first letter, turning `"cron_job"` into `"CronJob"`. */
	upperFirst?: boolean;
}

/** Options for {@link humanize}. */
export interface HumanizeOptions {
	/** Uppercase the first letter of the sentence. Defaults to `true`. */
	capitalize?: boolean;
}

/** An inflector bound to one vocabulary, returned by {@link createInflector}. */
export interface Inflector {
	/** Plural form of a word, or the singular form when `count` is exactly 1. */
	pluralize(word: string, count?: number): string;
	/** Singular form of a word. */
	singularize(word: string): string;
	/** camelCase form of an identifier. */
	camelize(value: string, options?: CamelizeOptions): string;
	/** snake_case form of an identifier. */
	underscore(value: string): string;
	/** kebab-case form of an underscored identifier. */
	dasherize(value: string): string;
	/** Sentence-cased human label for an identifier. */
	humanize(value: string, options?: HumanizeOptions): string;
	/** Ordinal form of a number, e.g. `3` to `"3rd"`. */
	ordinalize(value: number): string;
}

/**
 * Plural rules in priority order: the most specific patterns come first and the
 * bare `/$/` catch-all that appends an `s` comes last.
 */
const PLURAL_RULES: ReadonlyArray<InflectionRule> = [
	{ pattern: /(quiz)$/i, replacement: "$1zes" },
	{ pattern: /^(oxen)$/i, replacement: "$1" },
	{ pattern: /^(ox)$/i, replacement: "$1en" },
	{ pattern: /^(m|l)ice$/i, replacement: "$1ice" },
	{ pattern: /^(m|l)ouse$/i, replacement: "$1ice" },
	{ pattern: /(matr|vert|ind)(?:ix|ex)$/i, replacement: "$1ices" },
	{ pattern: /(x|ch|ss|sh)$/i, replacement: "$1es" },
	{ pattern: /([^aeiouy]|qu)y$/i, replacement: "$1ies" },
	{ pattern: /(hive)$/i, replacement: "$1s" },
	{ pattern: /(?:([^f])fe|([lr])f)$/i, replacement: "$1$2ves" },
	{ pattern: /sis$/i, replacement: "ses" },
	{ pattern: /([ti])a$/i, replacement: "$1a" },
	{ pattern: /([ti])um$/i, replacement: "$1a" },
	{ pattern: /(buffal|tomat)o$/i, replacement: "$1oes" },
	{ pattern: /(bu)s$/i, replacement: "$1ses" },
	{ pattern: /(alias|status)$/i, replacement: "$1es" },
	{ pattern: /(octop|vir)i$/i, replacement: "$1i" },
	{ pattern: /(octop|vir)us$/i, replacement: "$1i" },
	{ pattern: /^(ax|test)is$/i, replacement: "$1es" },
	{ pattern: /s$/i, replacement: "s" },
	{ pattern: /$/, replacement: "s" },
];

/**
 * Singular rules in priority order, mirroring {@link PLURAL_RULES}; the final
 * `/s$/` rule strips the trailing `s` when nothing more specific applied.
 */
const SINGULAR_RULES: ReadonlyArray<InflectionRule> = [
	{ pattern: /(database)s$/i, replacement: "$1" },
	{ pattern: /(quiz)zes$/i, replacement: "$1" },
	{ pattern: /(matr)ices$/i, replacement: "$1ix" },
	{ pattern: /(vert|ind)ices$/i, replacement: "$1ex" },
	{ pattern: /^(ox)en/i, replacement: "$1" },
	{ pattern: /(alias|status)(es)?$/i, replacement: "$1" },
	{ pattern: /(octop|vir)(us|i)$/i, replacement: "$1us" },
	{ pattern: /^(a)x[ie]s$/i, replacement: "$1xis" },
	{ pattern: /(cris|test)(is|es)$/i, replacement: "$1is" },
	{ pattern: /(shoe)s$/i, replacement: "$1" },
	{ pattern: /(o)es$/i, replacement: "$1" },
	{ pattern: /(bus)(es)?$/i, replacement: "$1" },
	{ pattern: /^(m|l)ice$/i, replacement: "$1ouse" },
	{ pattern: /(x|ch|ss|sh)es$/i, replacement: "$1" },
	{ pattern: /(m)ovies$/i, replacement: "$1ovie" },
	{ pattern: /(s)eries$/i, replacement: "$1eries" },
	{ pattern: /([^aeiouy]|qu)ies$/i, replacement: "$1y" },
	{ pattern: /([lr])ves$/i, replacement: "$1f" },
	{ pattern: /(tive)s$/i, replacement: "$1" },
	{ pattern: /(hive)s$/i, replacement: "$1" },
	{ pattern: /([^f])ves$/i, replacement: "$1fe" },
	{ pattern: /(^analy)(sis|ses)$/i, replacement: "$1sis" },
	{
		pattern: /((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(sis|ses)$/i,
		replacement: "$1sis",
	},
	{ pattern: /([ti])a$/i, replacement: "$1um" },
	{ pattern: /(n)ews$/i, replacement: "$1ews" },
	{ pattern: /(ss)$/i, replacement: "$1" },
	{ pattern: /s$/i, replacement: "" },
];

/** English pairs whose plural is not derivable from a suffix rule. */
const DEFAULT_IRREGULAR: ReadonlyArray<IrregularPair> = [
	["zombie", "zombies"],
	["move", "moves"],
	["sex", "sexes"],
	["child", "children"],
	["man", "men"],
	["person", "people"],
];

/** English words that never change between singular and plural. */
const DEFAULT_UNCOUNTABLE: ReadonlyArray<string> = [
	"equipment",
	"information",
	"rice",
	"money",
	"species",
	"series",
	"fish",
	"sheep",
	"jeans",
	"police",
];

/** Runs of characters that separate the parts of an identifier. */
const SEPARATORS = /[_\s-]+/;

/** Escapes a literal so it can be embedded in a generated pattern. */
function escapePattern(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a case-insensitive pattern for a literal without the `i` flag, so the
 * flag can stay off and the first letter's case be captured separately.
 */
function anyCasePattern(value: string): string {
	return Array.from(value)
		.map((char) => {
			let upper = char.toUpperCase();
			let lower = char.toLowerCase();
			if (upper === lower) return escapePattern(char);
			return `(?:${escapePattern(upper)}|${escapePattern(lower)})`;
		})
		.join("");
}

/**
 * Expands one irregular pair into the rules that map either form to the plural
 * and either form to the singular, preserving the first letter's case. Pairs
 * that share a first letter capture it, pairs that do not get one rule per case
 * because the replacement's first letter is fixed.
 */
function irregularRules(pair: IrregularPair): {
	plural: InflectionRule[];
	singular: InflectionRule[];
} {
	let [singular, plural] = pair;
	let singularHead = singular.slice(0, 1);
	let singularRest = singular.slice(1);
	let pluralHead = plural.slice(0, 1);
	let pluralRest = plural.slice(1);

	if (singularHead.toUpperCase() === pluralHead.toUpperCase()) {
		return {
			plural: [
				{
					pattern: new RegExp(
						`(${escapePattern(singularHead)})${escapePattern(singularRest)}$`,
						"i",
					),
					replacement: `$1${pluralRest}`,
				},
				{
					pattern: new RegExp(`(${escapePattern(pluralHead)})${escapePattern(pluralRest)}$`, "i"),
					replacement: `$1${pluralRest}`,
				},
			],
			singular: [
				{
					pattern: new RegExp(
						`(${escapePattern(singularHead)})${escapePattern(singularRest)}$`,
						"i",
					),
					replacement: `$1${singularRest}`,
				},
				{
					pattern: new RegExp(`(${escapePattern(pluralHead)})${escapePattern(pluralRest)}$`, "i"),
					replacement: `$1${singularRest}`,
				},
			],
		};
	}

	let singularRestAnyCase = anyCasePattern(singularRest);
	let pluralRestAnyCase = anyCasePattern(pluralRest);

	return {
		plural: [
			{
				pattern: new RegExp(`${escapePattern(singularHead.toUpperCase())}${singularRestAnyCase}$`),
				replacement: pluralHead.toUpperCase() + pluralRest,
			},
			{
				pattern: new RegExp(`${escapePattern(singularHead.toLowerCase())}${singularRestAnyCase}$`),
				replacement: pluralHead.toLowerCase() + pluralRest,
			},
			{
				pattern: new RegExp(`${escapePattern(pluralHead.toUpperCase())}${pluralRestAnyCase}$`),
				replacement: pluralHead.toUpperCase() + pluralRest,
			},
			{
				pattern: new RegExp(`${escapePattern(pluralHead.toLowerCase())}${pluralRestAnyCase}$`),
				replacement: pluralHead.toLowerCase() + pluralRest,
			},
		],
		singular: [
			{
				pattern: new RegExp(`${escapePattern(singularHead.toUpperCase())}${singularRestAnyCase}$`),
				replacement: singularHead.toUpperCase() + singularRest,
			},
			{
				pattern: new RegExp(`${escapePattern(singularHead.toLowerCase())}${singularRestAnyCase}$`),
				replacement: singularHead.toLowerCase() + singularRest,
			},
			{
				pattern: new RegExp(`${escapePattern(pluralHead.toUpperCase())}${pluralRestAnyCase}$`),
				replacement: singularHead.toUpperCase() + singularRest,
			},
			{
				pattern: new RegExp(`${escapePattern(pluralHead.toLowerCase())}${pluralRestAnyCase}$`),
				replacement: singularHead.toLowerCase() + singularRest,
			},
		],
	};
}

/**
 * Applies the first matching rule, after short-circuiting on words whose last
 * word is uncountable so `"police"` and `"fish"` survive untouched.
 */
function applyRules(
	word: string,
	rules: ReadonlyArray<InflectionRule>,
	uncountable: ReadonlySet<string>,
): string {
	if (word.length === 0) return word;

	let lastWord = /\b\w+$/.exec(word.toLowerCase());
	if (lastWord && uncountable.has(lastWord[0])) return word;

	for (let rule of rules) {
		if (rule.pattern.test(word)) return word.replace(rule.pattern, rule.replacement);
	}

	return word;
}

/**
 * Creates an inflector whose plural and singular rules include the given
 * vocabulary. Custom pairs and uncountables take priority over the defaults,
 * and nothing here mutates shared state, so two inflectors never interfere.
 *
 * @param options - Extra irregular pairs and uncountable words
 * @returns An inflector exposing the full inflection surface
 * @example createInflector({ uncountable: ["uptime"] }).pluralize("uptime")
 */
export function createInflector(options: InflectorOptions = {}): Inflector {
	let pairs = [...(options.irregular ?? []), ...DEFAULT_IRREGULAR];
	let pluralRules: InflectionRule[] = [];
	let singularRules: InflectionRule[] = [];

	for (let pair of pairs) {
		let rules = irregularRules(pair);
		pluralRules.push(...rules.plural);
		singularRules.push(...rules.singular);
	}

	pluralRules.push(...PLURAL_RULES);
	singularRules.push(...SINGULAR_RULES);

	let uncountable = new Set(
		[...DEFAULT_UNCOUNTABLE, ...(options.uncountable ?? [])].map((word) => word.toLowerCase()),
	);

	return {
		pluralize(word, count) {
			if (count === 1) return applyRules(word, singularRules, uncountable);
			return applyRules(word, pluralRules, uncountable);
		},
		singularize(word) {
			return applyRules(word, singularRules, uncountable);
		},
		camelize,
		underscore,
		dasherize,
		humanize,
		ordinalize,
	};
}

/** The inflector backing the standalone functions, built from English defaults. */
const DEFAULT_INFLECTOR = createInflector();

/**
 * Plural form of an English word, returning the singular form when `count` is
 * exactly 1 so the same call site can label both cases.
 *
 * @param word - Word to inflect
 * @param count - Quantity the label describes
 * @example pluralize("monitor") // "monitors"
 * @example pluralize("monitor", 1) // "monitor"
 */
export function pluralize(word: string, count?: number): string {
	return DEFAULT_INFLECTOR.pluralize(word, count);
}

/**
 * Singular form of an English word, left untouched when the word is
 * uncountable.
 *
 * @param word - Word to inflect
 * @example singularize("monitors") // "monitor"
 */
export function singularize(word: string): string {
	return DEFAULT_INFLECTOR.singularize(word);
}

/**
 * camelCase form of an identifier written with underscores, dashes, or spaces.
 * Only the first letter of each part is touched, so an acronym an author
 * already cased survives.
 *
 * @param value - Identifier to convert
 * @param options - Whether to uppercase the first letter
 * @example camelize("cron_job_monitor") // "cronJobMonitor"
 * @example camelize("cron_job_monitor", { upperFirst: true }) // "CronJobMonitor"
 */
export function camelize(value: string, options: CamelizeOptions = {}): string {
	let parts = value.split(SEPARATORS).filter((part) => part.length > 0);
	return parts
		.map((part, index) => {
			if (index > 0) return upperFirst(part);
			return options.upperFirst ? upperFirst(part) : lowerFirst(part);
		})
		.join("");
}

/**
 * snake_case form of an identifier, splitting camelCase boundaries and folding
 * dashes and whitespace into underscores.
 *
 * @param value - Identifier to convert
 * @example underscore("cronJobMonitor") // "cron_job_monitor"
 * @example underscore("HTTPRequest") // "http_request"
 */
export function underscore(value: string): string {
	return value
		.replace(/([A-Z\d]+)([A-Z][a-z])/g, "$1_$2")
		.replace(/([a-z\d])([A-Z])/g, "$1_$2")
		.replace(/[\s-]+/g, "_")
		.toLowerCase();
}

/**
 * kebab-case form of an underscored identifier. Case is preserved, so pass
 * camelCase input through {@link underscore} first.
 *
 * @param value - Underscored identifier to convert
 * @example dasherize("cron_job_monitor") // "cron-job-monitor"
 */
export function dasherize(value: string): string {
	return value.replace(/[_\s]+/g, "-");
}

/**
 * Sentence-cased label for an identifier: a trailing `_id` is dropped,
 * separators become spaces, and the result is lowercased except for the first
 * letter. Use `titleize` when a heading needs headline-style capitalization.
 *
 * @param value - Identifier to convert
 * @param options - Whether to capitalize the first letter
 * @example humanize("cron_job_monitor") // "Cron job monitor"
 * @example humanize("monitor_id") // "Monitor"
 */
export function humanize(value: string, options: HumanizeOptions = {}): string {
	let result = underscore(value).replace(/_id$/, "").replace(/_+/g, " ").trim();

	if (options.capitalize === false) return result;
	return upperFirst(result);
}

/**
 * English ordinal suffix for a number, following the teens exception where 11,
 * 12, and 13 all take `th`.
 */
function ordinalSuffix(value: number): string {
	let absolute = Math.abs(value);
	let mod100 = absolute % 100;
	if (mod100 === 11 || mod100 === 12 || mod100 === 13) return "th";

	switch (absolute % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}

/**
 * Ordinal form of a number, suffixed with the English ordinal indicator.
 *
 * @param value - Number to inflect
 * @example ordinalize(3) // "3rd"
 * @example ordinalize(112) // "112th"
 */
export function ordinalize(value: number): string {
	return `${value}${ordinalSuffix(value)}`;
}
