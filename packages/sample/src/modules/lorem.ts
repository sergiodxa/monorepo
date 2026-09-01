/**
 * Placeholder prose, for filling a field whose content does not matter but
 * whose length does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

/** Options for a generated paragraph. */
export interface ParagraphOptions {
	/** How many sentences it runs to, 4 by default. */
	sentences?: number;
}

/** Words, sentences, and paragraphs. */
export interface LoremModule {
	/** `count` words joined by spaces. */
	words(count: number): string;
	/** A capitalized sentence of a few words, closed with a period. */
	sentence(): string;
	/** Several sentences joined by spaces. */
	paragraph(options?: ParagraphOptions): string;
}

/** Create the `lorem` module over one stream and dataset. */
export function createLoremModule(random: Random, data: Dataset): LoremModule {
	let lorem: LoremModule = {
		words(count) {
			if (!Number.isSafeInteger(count) || count < 0) {
				throw new RangeError(`words() needs a count of zero or more, received ${count}.`);
			}
			return Array.from({ length: count }, () => random.pick(data.lorem)).join(" ");
		},
		sentence() {
			let words = lorem.words(random.int(4, 12));
			return `${words.charAt(0).toUpperCase()}${words.slice(1)}.`;
		},
		paragraph(options = {}) {
			let sentences = options.sentences ?? 4;
			return Array.from({ length: sentences }, () => lorem.sentence()).join(" ");
		},
	};

	return lorem;
}
