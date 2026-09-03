/**
 * Placeholder prose, for filling a field whose content does not matter but
 * whose length does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset.js";
import type { Random } from "../random.js";

/** How many words a generated sentence runs to. */
const SENTENCE_MIN_WORDS = 4;
const SENTENCE_MAX_WORDS = 12;

/** Options for a count of things. */
export interface CountOptions {
	count?: number;
}

/** Options for a generated paragraph. */
export interface ParagraphOptions {
	/** How many sentences it runs to, 4 by default. */
	sentences?: number;
}

/** Options for several paragraphs. */
export interface ParagraphsOptions extends ParagraphOptions {
	/** How many paragraphs, 3 by default. */
	count?: number;
	/** What joins them, a blank line by default. */
	separator?: string;
}

/** Words, sentences, paragraphs, and the shapes built from them. */
export interface LoremModule {
	/** One word. */
	word(): string;
	/** `count` words joined by spaces. */
	words(count: number): string;
	/** A capitalized sentence of a few words, closed with a period. */
	sentence(): string;
	/** `count` sentences joined by spaces. */
	sentences(count: number): string;
	/** Several sentences joined by spaces, 4 by default. */
	paragraph(options?: ParagraphOptions): string;
	/** Several paragraphs, separated by blank lines. */
	paragraphs(options?: ParagraphsOptions): string;
	/** `count` sentences, one per line. */
	lines(count: number): string;
	/** A few words joined by dashes, as a URL slug. */
	slug(count?: number): string;
	/** Prose of a paragraph or so, for a field that just needs filling. */
	text(): string;
}

/** Reject a count that is not a count, naming the tool that was asked. */
function checkCount(count: number, name: string): void {
	if (!Number.isSafeInteger(count) || count < 0) {
		throw new RangeError(`${name}() needs a count of zero or more, received ${count}.`);
	}
}

/** Create the `lorem` module over one stream and dataset. */
export function createLoremModule(random: Random, data: Dataset): LoremModule {
	let lorem: LoremModule = {
		word() {
			return random.pick(data.lorem);
		},
		words(count) {
			checkCount(count, "words");
			return Array.from({ length: count }, () => random.pick(data.lorem)).join(" ");
		},
		sentence() {
			let words = lorem.words(random.int(SENTENCE_MIN_WORDS, SENTENCE_MAX_WORDS));
			return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
		},
		sentences(count) {
			checkCount(count, "sentences");
			return Array.from({ length: count }, () => lorem.sentence()).join(" ");
		},
		paragraph(options = {}) {
			return lorem.sentences(options.sentences ?? 4);
		},
		paragraphs(options = {}) {
			let count = options.count ?? 3;
			checkCount(count, "paragraphs");
			return Array.from({ length: count }, () => lorem.paragraph(options)).join(
				options.separator ?? "\n\n",
			);
		},
		lines(count) {
			checkCount(count, "lines");
			return Array.from({ length: count }, () => lorem.sentence()).join("\n");
		},
		slug(count = 3) {
			checkCount(count, "slug");
			return Array.from({ length: count }, () => random.pick(data.lorem)).join("-");
		},
		text() {
			return lorem.paragraph({ sentences: random.int(2, 6) });
		},
	};

	return lorem;
}
