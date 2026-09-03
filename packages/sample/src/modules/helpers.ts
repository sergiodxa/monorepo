/**
 * The shapes that turn one generated value into many: picking from a caller's
 * own list, repeating a generator, filling a template, and building a string to
 * a pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random.js";

/** How many draws `uniqueArray` makes per value before giving up. */
const UNIQUE_ATTEMPTS = 100;

/** The characters `replaceSymbols` substitutes, and what each one takes. */
const SYMBOL_DIGIT = "#";
const SYMBOL_LETTER = "?";
const SYMBOL_EITHER = "*";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** Options for picking several distinct elements. */
export interface PickManyOptions {
	count: number;
}

/** Options for repeating a generator. */
export interface MultipleOptions {
	count: number;
}

/** Options for a value that is sometimes absent. */
export interface MaybeOptions {
	/** How often the value is present, half the time by default. */
	chance?: number;
}

/** One choice and how heavily it is weighted against the others. */
export interface WeightedChoice<T> {
	weight: number;
	value: T;
}

/** A count written either as a number or as a range to draw from. */
export type NumberRange = number | { min: number; max: number };

/** Values a mustache template can substitute, by key. */
export type MustacheValues = Record<string, string | (() => string)>;

/** Drawing from a caller's data, repeating a generator, and filling templates. */
export interface HelpersModule {
	/**
	 * One element.
	 *
	 * @throws RangeError when the list is empty.
	 */
	pick<T>(items: readonly T[]): T;
	/**
	 * `count` distinct elements, in a shuffled order.
	 *
	 * @throws RangeError when the list holds fewer than `count` elements.
	 */
	pickMany<T>(items: readonly T[], options: PickManyOptions): T[];
	/** A shuffled copy; the argument keeps its order. */
	shuffle<T>(items: readonly T[]): T[];
	/** `count` values, each built by calling `build` with its index. */
	multiple<T>(build: (index: number) => T, options: MultipleOptions): T[];
	/** The built value, or `null` the rest of the time. */
	maybe<T>(build: () => T, options?: MaybeOptions): T | null;
	/** One choice, each as likely as its weight against the total. */
	weightedPick<T>(choices: readonly WeightedChoice<T>[]): T;
	/**
	 * `count` distinct values from a list or a generator.
	 *
	 * @throws RangeError when the source cannot produce that many distinct values.
	 */
	uniqueArray<T>(source: readonly T[] | (() => T), count: number): T[];
	/** One value of an object used as an enum. */
	enumValue<T extends Record<string, unknown>>(values: T): T[keyof T];
	/** One key of an object. */
	objectKey<T extends Record<string, unknown>>(values: T): keyof T;
	/** One value of an object. */
	objectValue<T extends Record<string, unknown>>(values: T): T[keyof T];
	/** One key and its value, as a pair. */
	objectEntry<T extends Record<string, unknown>>(values: T): [keyof T, T[keyof T]];
	/** A number as given, or one drawn from the range. */
	rangeToNumber(range: NumberRange): number;
	/** Text as a URL slug: lowercase, dashes between words. */
	slugify(text: string): string;
	/** `#` becomes a digit, `?` a letter, `*` either. */
	replaceSymbols(pattern: string): string;
	/**
	 * Like {@link HelpersModule.replaceSymbols} for a card number, with `L`
	 * standing for the Luhn check digit that makes the number well-formed.
	 */
	replaceCreditCardSymbols(pattern?: string): string;
	/** A string matching a pattern of literals, character classes, and counts. */
	fromRegExp(pattern: string): string;
	/** `{{key}}` replaced by the caller's values. */
	mustache(text: string, values: MustacheValues): string;
	/** `{{module.method}}` replaced by what that generator returns. */
	fake(template: string): string;
}

/** Resolves `person.firstName` to what that generator returns. */
export type GeneratorLookup = (path: string) => string;

/**
 * The Luhn check digit that completes a number: the doubling runs from the
 * payload's last digit, since the check digit itself is never doubled.
 */
function luhnCheckDigit(digits: string): number {
	let sum = 0;
	let double = true;
	for (let index = digits.length - 1; index >= 0; index--) {
		let digit = Number(digits.charAt(index));
		if (double) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		double = !double;
		sum += digit;
	}
	return (10 - (sum % 10)) % 10;
}

/** Create the `helpers` module over one stream and a generator lookup. */
export function createHelpersModule(random: Random, lookup: GeneratorLookup): HelpersModule {
	/** Expand one character class, `[a-z0-9_]`, into the characters it admits. */
	function expandClass(body: string): string {
		let characters = "";
		for (let index = 0; index < body.length; index++) {
			let current = body.charAt(index);
			let next = body.charAt(index + 1);
			let after = body.charAt(index + 2);
			if (next === "-" && after !== "") {
				for (let code = current.charCodeAt(0); code <= after.charCodeAt(0); code++) {
					characters += String.fromCharCode(code);
				}
				index += 2;
				continue;
			}
			characters += current;
		}
		return characters;
	}

	/** Draw distinct values from a list, or by calling a generator repeatedly. */
	function unique<T>(source: readonly T[] | (() => T), count: number): T[] {
		if (!Number.isSafeInteger(count) || count < 0) {
			throw new RangeError(`uniqueArray() needs a count of zero or more, received ${count}.`);
		}
		if (Array.isArray(source)) return helpers.pickMany(source as readonly T[], { count });
		let build = source as () => T;
		let seen = new Set<unknown>();
		let picked: T[] = [];
		for (let attempt = 0; attempt < count * UNIQUE_ATTEMPTS && picked.length < count; attempt++) {
			let value = build();
			let key = typeof value === "object" ? JSON.stringify(value) : value;
			if (seen.has(key)) continue;
			seen.add(key);
			picked.push(value);
		}
		if (picked.length < count) {
			throw new RangeError(
				`uniqueArray() drew ${picked.length} distinct values where ${count} were asked for.`,
			);
		}
		return picked;
	}

	let helpers: HelpersModule = {
		pick(items) {
			return random.pick(items);
		},
		pickMany(items, options) {
			if (!Number.isSafeInteger(options.count) || options.count < 0) {
				throw new RangeError(
					`pickMany() needs a count of zero or more, received ${options.count}.`,
				);
			}
			if (options.count > items.length) {
				throw new RangeError(
					`pickMany() needs ${options.count} items to pick from, the list holds ${items.length}.`,
				);
			}
			return random.shuffle(items).slice(0, options.count);
		},
		shuffle(items) {
			return random.shuffle(items);
		},
		multiple(build, options) {
			if (!Number.isSafeInteger(options.count) || options.count < 0) {
				throw new RangeError(
					`multiple() needs a count of zero or more, received ${options.count}.`,
				);
			}
			return Array.from({ length: options.count }, (_, index) => build(index));
		},
		maybe(build, options = {}) {
			return random.bool(options.chance ?? 0.5) ? build() : null;
		},
		weightedPick(choices) {
			if (choices.length === 0) {
				throw new RangeError("weightedPick() needs at least one choice.");
			}
			let total = choices.reduce((sum, choice) => sum + choice.weight, 0);
			if (total <= 0)
				throw new RangeError("weightedPick() needs the weights to add up above zero.");
			let target = random.float(0, total);
			let running = 0;
			for (let choice of choices) {
				running += choice.weight;
				if (target < running) return choice.value;
			}
			return (choices[choices.length - 1] as WeightedChoice<(typeof choices)[number]["value"]>)
				.value;
		},
		uniqueArray: unique,
		enumValue(values) {
			return helpers.objectValue(values);
		},
		objectKey(values) {
			let keys = Object.keys(values);
			if (keys.length === 0) throw new RangeError("objectKey() needs an object with a key.");
			return random.pick(keys);
		},
		objectValue(values) {
			return values[helpers.objectKey(values)];
		},
		objectEntry(values) {
			let key = helpers.objectKey(values);
			return [key, values[key]];
		},
		rangeToNumber(range) {
			if (typeof range === "number") return range;
			return random.int(range.min, range.max);
		},
		slugify(text) {
			return text
				.normalize("NFKD")
				.replace(/\p{M}+/gu, "")
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "");
		},
		replaceSymbols(pattern) {
			// oxlint-disable-next-line typescript/no-misused-spread -- ASCII only
			return [...pattern]
				.map((character) => {
					if (character === SYMBOL_DIGIT) return String(random.int(0, 9));
					if (character === SYMBOL_LETTER) return LETTERS.charAt(random.int(0, 25));
					if (character === SYMBOL_EITHER) {
						return random.bool() ? String(random.int(0, 9)) : LETTERS.charAt(random.int(0, 25));
					}
					return character;
				})
				.join("");
		},
		replaceCreditCardSymbols(pattern = "6453-####-####-####-###L") {
			let filled = helpers.replaceSymbols(pattern.replace(/L/g, ""));
			let digits = filled.replace(/\D/g, "");
			return `${filled}${luhnCheckDigit(digits)}`;
		},
		fromRegExp(pattern) {
			let output = "";
			let index = 0;
			while (index < pattern.length) {
				let characters: string;
				let current = pattern.charAt(index);
				if (current === "\\") {
					let escaped = pattern.charAt(index + 1);
					characters =
						escaped === "d"
							? "0123456789"
							: escaped === "w"
								? `${LETTERS}${LETTERS.toUpperCase()}0123456789_`
								: escaped === "s"
									? " "
									: escaped;
					index += 2;
				} else if (current === "[") {
					let close = pattern.indexOf("]", index);
					if (close === -1) throw new RangeError(`fromRegExp() found no "]" in ${pattern}.`);
					characters = expandClass(pattern.slice(index + 1, close));
					index = close + 1;
				} else {
					characters = current;
					index += 1;
				}

				let repeat = 1;
				let quantifier = pattern.charAt(index);
				if (quantifier === "{") {
					let close = pattern.indexOf("}", index);
					if (close === -1) throw new RangeError(`fromRegExp() found no "}" in ${pattern}.`);
					let body = pattern.slice(index + 1, close);
					let [min, max] = body.split(",");
					repeat =
						max === undefined
							? Number(min)
							: random.int(Number(min), Number(max === "" ? Number(min) + 10 : max));
					index = close + 1;
				} else if (quantifier === "?") {
					repeat = random.int(0, 1);
					index += 1;
				} else if (quantifier === "+") {
					repeat = random.int(1, 10);
					index += 1;
				} else if (quantifier === "*") {
					repeat = random.int(0, 10);
					index += 1;
				}

				if (Number.isNaN(repeat)) throw new RangeError(`fromRegExp() could not read ${pattern}.`);
				for (let count = 0; count < repeat; count++) {
					output += characters.charAt(random.int(0, characters.length - 1));
				}
			}
			return output;
		},
		mustache(text, values) {
			return text.replace(/\{\{([^{}]+)\}\}/g, (whole, key: string) => {
				let value = values[key.trim()];
				if (value === undefined) return whole;
				return typeof value === "function" ? value() : value;
			});
		},
		fake(template) {
			return template.replace(/\{\{([^{}]+)\}\}/g, (_, path: string) => lookup(path.trim()));
		},
	};

	return helpers;
}
