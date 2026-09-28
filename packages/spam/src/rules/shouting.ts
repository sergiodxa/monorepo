/**
 * The shouting rule: advertising copy written to grab attention, with text in capitals, runs of
 * one character, a phrase said over and over, and emoji outnumbering words. Each is mild alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

import { extractWords } from "../lib/text.js";

/** The same non-space character six or more times in a row. */
const CHARACTER_RUN = /(\S)\1{5,}/u;

/** One emoji, counting a joined sequence as each of its parts. */
const EMOJI = /\p{Extended_Pictographic}/gu;

/**
 * Scores capitals (over `capsRatio` of at least 20 cased letters), a run of one character, a
 * three-word phrase appearing three times, and at least 8 emoji outnumbering the words.
 *
 * @example shouting({ capsScore: 1 })
 */
export function shouting(options: shouting.Options = {}): SpamCheck {
	let capsRatio = options.capsRatio ?? 0.7;
	let capsScore = options.capsScore ?? 2;
	let runScore = options.runScore ?? 1;
	let repetitionScore = options.repetitionScore ?? 2;
	let emojiScore = options.emojiScore ?? 2;

	return {
		name: "shouting",
		stage: "local",
		check(submission): Signal[] {
			let content = submission.content;
			let signals: Signal[] = [];

			let upper = content.match(/\p{Lu}/gu)?.length ?? 0;
			let lower = content.match(/\p{Ll}/gu)?.length ?? 0;
			if (upper + lower >= 20 && upper / (upper + lower) > capsRatio) {
				signals.push({ check: "shouting.caps", score: capsScore, detail: "written in capitals" });
			}
			let run = content.match(CHARACTER_RUN);
			if (run) {
				signals.push({ check: "shouting.run", score: runScore, detail: `a run of "${run[1]}"` });
			}
			let phrase = repeatedPhrase(extractWords(content.toLowerCase()));
			if (phrase !== null) {
				signals.push({
					check: "shouting.repetition",
					score: repetitionScore,
					detail: `"${phrase}" repeated`,
				});
			}
			let emoji = content.match(EMOJI)?.length ?? 0;
			if (emoji >= 8 && emoji > extractWords(content).length) {
				signals.push({ check: "shouting.emoji", score: emojiScore, detail: `${emoji} emoji` });
			}
			return signals;
		},
	};
}

/** The first three-word phrase that appears three or more times, or `null`. */
function repeatedPhrase(words: string[]): string | null {
	let counts = new Map<string, number>();
	for (let index = 0; index + 3 <= words.length; index++) {
		let phrase = words.slice(index, index + 3).join(" ");
		let count = (counts.get(phrase) ?? 0) + 1;
		if (count >= 3) return phrase;
		counts.set(phrase, count);
	}
	return null;
}

/** The options {@link shouting} takes. */
export namespace shouting {
	/** Limits and weights for the shouting rule. */
	export interface Options {
		/** @default 0.7 */
		capsRatio?: number;
		/** @default 2 */
		capsScore?: number;
		/** @default 1 */
		runScore?: number;
		/** @default 2 */
		repetitionScore?: number;
		/** @default 2 */
		emojiScore?: number;
	}
}
