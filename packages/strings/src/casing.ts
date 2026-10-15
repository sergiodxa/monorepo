/**
 * The word walk shared by headline and sentence casing: splits a title into words,
 * renders `special` names and phrases as written, keeps identifiers and inline code
 * as typed, and hands every other word to the casing style with its position.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Names whose casing cannot be derived from the word itself. Deliberately kept
 * small: product and technology vocabulary belongs to the app that publishes it,
 * declared once through a `special` list.
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
	"I",
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

/** A digit (`v3`, `i18next`) or code and path punctuation (`entry.client`, `client_id`). */
const CODE_CHARACTERS = /\p{N}|[._/#@()[\]{}<>=$\\]/u;

/** An uppercase letter past the first one, as in `GraphQL` or `useEffect`. */
const INNER_CAPITAL = /^.+\p{Lu}/su;

/** An apostrophe ending the name a possessive or contraction is built on (`Remix's`, `I'm`). */
const APOSTROPHE = /['’]/u;

/** A whitespace-delimited chunk of a title, split from its punctuation shell. */
interface Part {
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

/** Where a word sits in the title, for the styles that treat those positions specially. */
export interface WordPosition {
	first: boolean;
	last: boolean;
	/** The word follows a colon, which opens a subtitle. */
	afterColon: boolean;
}

/**
 * The `special` names of one casing style, matched case-insensitively and with a
 * possessive or contraction (`Remix's`, `I'm`) still matching its name.
 */
export interface Vocabulary {
	/** The name as written for one word, or `undefined` when it is not special. */
	word(core: string): string | undefined;
	/** Multi-word names (`React Router`), longest first so the longest match wins. */
	phrases: ReadonlyArray<ReadonlyArray<string>>;
}

/**
 * Builds a vocabulary from the built-in names plus the caller's, which are added
 * last so they override the built-in set.
 *
 * @param special - The caller's names, single words or phrases
 */
export function toVocabulary(special: ReadonlyArray<string>): Vocabulary {
	let words = new Map<string, string>();
	let phrases: string[][] = [];

	for (let entry of [...DEFAULT_SPECIAL, ...special]) {
		let parts = entry.trim().split(/\s+/u);
		if (parts.length > 1) phrases.push(parts);
		else words.set(entry.toLowerCase(), entry);
	}

	phrases.sort((a, b) => b.length - a.length);

	return {
		word(core) {
			let whole = words.get(core.toLowerCase());
			if (whole !== undefined) return whole;
			let [base, suffix] = splitSuffix(core);
			let match = suffix === "" ? undefined : words.get(base.toLowerCase());
			return match === undefined ? undefined : match + suffix;
		},
		phrases,
	};
}

/**
 * Re-cases a title word by word. A `special` name or phrase renders as written,
 * inline code between backticks and identifiers keep the form typed, and every
 * other word is rendered by the style.
 *
 * @param value - Title to re-case
 * @param vocabulary - The style's `special` names
 * @param render - Cases one word, hyphenated compounds included, given its position
 */
export function recase(
	value: string,
	vocabulary: Vocabulary,
	render: (core: string, position: WordPosition) => string,
): string {
	let parts = toParts(value);
	let wordIndexes: number[] = [];

	for (let [index, part] of parts.entries()) {
		if (part.isWord) wordIndexes.push(index);
	}

	let firstIndex = wordIndexes.at(0);
	let lastIndex = wordIndexes.at(-1);
	let afterColon = false;
	let inCode = false;
	let result: string[] = [];

	for (let index = 0; index < parts.length; index++) {
		let part = parts[index] as Part;
		let backticks = part.raw.split("`").length - 1;
		let code = inCode || backticks > 0;
		if (backticks % 2 === 1) inCode = !inCode;

		if (!part.isWord) {
			result.push(part.raw);
			if (!code && part.raw.includes(":")) afterColon = true;
			continue;
		}

		let phrase = code ? undefined : matchPhrase(parts, index, vocabulary.phrases);
		if (phrase !== undefined) {
			result.push(phrase.text);
			index = phrase.end;
			afterColon = (parts[index] as Part).trailing.includes(":");
			continue;
		}

		let position = { first: index === firstIndex, last: index === lastIndex, afterColon };
		let core =
			code || isVerbatim(part.core)
				? (vocabulary.word(part.core) ?? part.core)
				: (vocabulary.word(part.core) ?? render(part.core, position));

		result.push(part.leading + core + part.trailing);
		afterColon = part.trailing.includes(":");
	}

	return result.join("");
}

/**
 * Whether a word is an identifier whose exact form carries meaning. A capital past
 * the first letter counts per hyphenated element, so `Non-Blocking` is still a word.
 */
function isVerbatim(core: string): boolean {
	if (CODE_CHARACTERS.test(core)) return true;
	return core.split("-").some((element) => INNER_CAPITAL.test(element));
}

/** Splits `Remix's` into `Remix` and `'s`; a word without an apostrophe has no suffix. */
function splitSuffix(core: string): [string, string] {
	let match = APOSTROPHE.exec(core);
	if (match === null || match.index === 0) return [core, ""];
	return [core.slice(0, match.index), core.slice(match.index)];
}

/**
 * Matches the longest phrase starting at `start`. Its words must be separated by
 * whitespace alone, and only the last may carry a possessive or trailing punctuation.
 *
 * @returns The rendered text and the index of the phrase's last part
 */
function matchPhrase(
	parts: ReadonlyArray<Part>,
	start: number,
	phrases: ReadonlyArray<ReadonlyArray<string>>,
): { text: string; end: number } | undefined {
	for (let phrase of phrases) {
		let text = (parts[start] as Part).leading;
		let index = start;
		let matched = phrase.every((name, offset) => {
			let part = parts[index];
			if (part === undefined || !part.isWord) return false;
			let lastWord = offset === phrase.length - 1;
			if (offset > 0 && part.leading !== "") return false;
			if (!lastWord && part.trailing !== "") return false;
			let [base, suffix] = lastWord ? splitSuffix(part.core) : [part.core, ""];
			if (base.toLowerCase() !== name.toLowerCase()) return false;
			text += name + suffix + (lastWord ? part.trailing : (parts[index + 1]?.raw ?? ""));
			if (!lastWord) index += 2;
			return true;
		});
		if (matched) return { text, end: index };
	}

	return undefined;
}

/**
 * Splits a title into words and separators, keeping punctuation out of the word
 * so `"v3:"` matches the `special` list as `"v3"` while its colon still marks the
 * start of a subtitle.
 */
function toParts(value: string): Part[] {
	let parts: Part[] = [];

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
