/**
 * The Unicode obfuscation rule: characters that look like ordinary text to a reader but not to a
 * keyword filter. Spam uses them to slip a brand name or a banned word past naive matching.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Signal, SpamCheck } from "../check.js";

/**
 * A word mixing Latin letters with Cyrillic or Greek ones, the shape of a homoglyph substitution
 * such as a Cyrillic `а` inside `Paypal`.
 */
const MIXED_SCRIPT_WORD =
	/(?=[\p{L}]*\p{Script=Latin})(?=[\p{L}]*[\p{Script=Cyrillic}\p{Script=Greek}])[\p{L}]+/u;

/**
 * An invisible character between two letters or digits. Zero-width joiners and non-joiners count
 * only between Latin letters, since emoji sequences and several scripts use them legitimately.
 */
const HIDDEN_SEPARATOR = /[\p{L}\p{N}][​⁠﻿­][\p{L}\p{N}]|\p{Script=Latin}[‌‍]\p{Script=Latin}/u;

/** Mathematical alphanumeric symbols and fullwidth Latin letters, which render as styled text. */
const STYLED_LETTER = /[\u{1D400}-\u{1D7FF}Ａ-Ｚａ-ｚ]/gu;

/** Five or more combining marks stacked on one character, as "Zalgo" text does. */
const MARK_STACK = /\p{M}{5,}/u;

/**
 * Scores homoglyph words, invisible separators, styled letters (at least `minStyledLetters` of
 * them) and stacked combining marks. Each kind scores once.
 *
 * @example unicode({ mixedScriptScore: 3 })
 */
export function unicode(options: unicode.Options = {}): SpamCheck {
	let mixedScriptScore = options.mixedScriptScore ?? 5;
	let hiddenScore = options.hiddenScore ?? 5;
	let styledScore = options.styledScore ?? 5;
	let minStyledLetters = options.minStyledLetters ?? 3;
	let markStackScore = options.markStackScore ?? 3;

	return {
		name: "unicode",
		stage: "local",
		check(submission): Signal[] {
			let content = submission.content;
			let signals: Signal[] = [];
			let mixed = content.match(MIXED_SCRIPT_WORD);
			if (mixed) {
				signals.push({
					check: "unicode.mixed-script",
					score: mixedScriptScore,
					detail: `"${mixed[0]}" mixes Latin with Cyrillic or Greek letters`,
				});
			}
			if (HIDDEN_SEPARATOR.test(content)) {
				signals.push({
					check: "unicode.hidden",
					score: hiddenScore,
					detail: "invisible characters inside words",
				});
			}
			let styled = content.match(STYLED_LETTER)?.length ?? 0;
			if (styled >= minStyledLetters) {
				signals.push({
					check: "unicode.styled",
					score: styledScore,
					detail: `${styled} mathematical or fullwidth letters`,
				});
			}
			if (MARK_STACK.test(content)) {
				signals.push({
					check: "unicode.mark-stack",
					score: markStackScore,
					detail: "stacked combining marks",
				});
			}
			return signals;
		},
	};
}

/** The options {@link unicode} takes. */
export namespace unicode {
	/** Limits and weights for the Unicode obfuscation rule. */
	export interface Options {
		/** @default 5 */
		mixedScriptScore?: number;
		/** @default 5 */
		hiddenScore?: number;
		/** @default 5 */
		styledScore?: number;
		/** @default 3 */
		minStyledLetters?: number;
		/** @default 3 */
		markStackScore?: number;
	}
}
