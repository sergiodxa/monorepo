/**
 * The arithmetic of the classifier: Robinson's smoothed per-token spam probability and Fisher's
 * method for combining the most telling tokens into one probability. Kept free of storage so the
 * numbers can be checked on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { TokenStore } from "./store.js";

/**
 * The distance from 0 and 1 a token probability is held at before taking logarithms, so a
 * `strength` of 0 with a token seen only in one label yields a finite combination.
 */
const PROBABILITY_FLOOR = 1e-6;

/** The knobs of {@link classify}. */
export interface ClassifyOptions {
	/** How many documents of weight the prior carries against a token's own counts. */
	strength: number;
	/** The probability assumed for a token never seen. */
	prior: number;
	/** The most tokens that enter the combination. */
	interestingTokens: number;
	/** How far from 0.5 a token's probability must sit to enter the combination. */
	minDeviation: number;
}

/** One token that entered the combination. */
export interface Clue {
	token: string;
	probability: number;
}

/** The combined verdict and the tokens behind it, most telling first. */
export interface Classification {
	probability: number;
	clues: Clue[];
}

/**
 * Combines the most telling of `tokens` into a spam probability. A token's probability is the
 * ratio of its spam and ham document frequencies, pulled toward `prior` in proportion to how
 * rarely it was seen. With no telling token the answer is 0.5, which no cut acts on.
 *
 * @param tokens - The submission's distinct tokens
 * @param counts - What the store holds for them
 */
export function classify(
	tokens: readonly string[],
	counts: TokenStore.Counts,
	options: ClassifyOptions,
): Classification {
	let clues: Clue[] = [];
	for (let token of tokens) {
		let probability = tokenProbability(counts.tokens.get(token), counts.documents, options);
		if (Math.abs(probability - 0.5) >= options.minDeviation) clues.push({ token, probability });
	}
	clues.sort((a, b) => Math.abs(b.probability - 0.5) - Math.abs(a.probability - 0.5));
	clues = clues.slice(0, options.interestingTokens);
	return { probability: fisher(clues.map((clue) => clue.probability)), clues };
}

/**
 * Robinson's f(w) = (s·x + n·p(w)) / (s + n), where p(w) compares the token's frequency among
 * spam documents with its frequency among ham documents and n is how many documents held it.
 */
function tokenProbability(
	tally: TokenStore.Tally | undefined,
	documents: TokenStore.Tally,
	options: ClassifyOptions,
): number {
	let spam = tally?.spam ?? 0;
	let ham = tally?.ham ?? 0;
	let seen = spam + ham;
	if (seen === 0) return options.prior;
	let spamFrequency = documents.spam > 0 ? Math.min(spam / documents.spam, 1) : 0;
	let hamFrequency = documents.ham > 0 ? Math.min(ham / documents.ham, 1) : 0;
	let ratio = spamFrequency / (spamFrequency + hamFrequency);
	return (options.strength * options.prior + seen * ratio) / (options.strength + seen);
}

/**
 * Fisher's method as SpamBayes applies it: one chi-squared test for "these tokens are spammy"
 * and one for "these tokens are hammy", averaged so disagreement lands near 0.5.
 */
function fisher(probabilities: readonly number[]): number {
	if (probabilities.length === 0) return 0.5;
	let spamLog = 0;
	let hamLog = 0;
	for (let raw of probabilities) {
		let probability = Math.min(Math.max(raw, PROBABILITY_FLOOR), 1 - PROBABILITY_FLOOR);
		spamLog += Math.log(1 - probability);
		hamLog += Math.log(probability);
	}
	let freedom = 2 * probabilities.length;
	let spamminess = 1 - chiSquaredSurvival(-2 * spamLog, freedom);
	let hamminess = 1 - chiSquaredSurvival(-2 * hamLog, freedom);
	return (1 + spamminess - hamminess) / 2;
}

/**
 * The probability that a chi-squared variable with an even `freedom` exceeds `value`, by the
 * closed-form series for even degrees of freedom, clamped to 1 against rounding.
 */
function chiSquaredSurvival(value: number, freedom: number): number {
	let half = value / 2;
	let term = Math.exp(-half);
	let sum = term;
	for (let index = 1; index < freedom / 2; index++) {
		term *= half / index;
		sum += term;
	}
	return Math.min(sum, 1);
}
