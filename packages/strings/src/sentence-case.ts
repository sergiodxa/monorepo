/**
 * Sentence-style capitalization: the first word capitalized and every other word
 * lowercased, with the names a caller lists, identifiers and inline code kept as
 * written. Meant for titles read as part of running text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { recase, toVocabulary } from "./casing.js";
import { upperFirst } from "./segment.js";

/** Options for {@link sentenceCase}. */
export interface SentenceCaseOptions {
	/**
	 * Proper nouns rendered exactly as written whenever they appear, single words
	 * (`Remix`) or phrases (`React Router`), matched case-insensitively. Entries
	 * extend the built-in set (`API`, `GitHub`, `I`, `JavaScript`…) and override it.
	 */
	special?: ReadonlyArray<string>;
}

/** A sentence caser bound to one vocabulary, returned by {@link createSentenceCaser}. */
export interface SentenceCaser {
	/** Applies sentence-style capitalization to a title. */
	(value: string): string;
}

/**
 * Creates a sentence caser bound to a vocabulary, so an app declares the proper
 * nouns it publishes once instead of repeating `special` at every call site.
 *
 * @param options - Proper nouns rendered exactly as written
 * @returns A function applying sentence-style capitalization
 * @example createSentenceCaser({ special: ["React Router"] })("Testing React Router Loaders")
 */
export function createSentenceCaser(options: SentenceCaseOptions = {}): SentenceCaser {
	let vocabulary = toVocabulary(options.special ?? []);

	return (value: string) =>
		recase(value, vocabulary, (core, { first }) => {
			let lower = core.toLowerCase();
			return first ? upperFirst(lower) : lower;
		});
}

/** The sentence caser backing {@link sentenceCase} when no `special` list is passed. */
const DEFAULT_SENTENCE_CASER = createSentenceCaser();

/**
 * Sentence-style capitalization for an English title. A word with no casing of
 * its own is lowercased, so a proper noun stays capitalized only when it is listed
 * in `special` or is an identifier such as `GraphQL`, `HTTP` or `v3`.
 *
 * @param value - Title to capitalize
 * @param options - Proper nouns rendered exactly as written
 * @example sentenceCase("Make Regional HTTP Requests with Durable Objects", { special: ["Durable Objects"] })
 * @example sentenceCase("everything I know about good API design")
 */
export function sentenceCase(value: string, options?: SentenceCaseOptions): string {
	if (options?.special === undefined) return DEFAULT_SENTENCE_CASER(value);
	return createSentenceCaser(options)(value);
}
