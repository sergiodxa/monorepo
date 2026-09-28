/**
 * The trainable classifier: naive Bayes over content words, linked hosts and the author's email
 * domain, learning from every moderator report. Its counts live behind `TokenStore`, so a site's
 * own moderation history becomes evidence the fixed rules cannot encode.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { TokenStore } from "./bayes/store.js";
import type { Signal, SpamCheck, SpamCheckError } from "./check.js";

import { classify } from "./bayes/classify.js";
import { tokenize } from "./bayes/tokens.js";

export type { SpamTokenRow } from "./bayes/data-table.js";
export type { TokenStore } from "./bayes/store.js";

export { DataTableTokenStore, SPAM_TOKENS_SCHEMA_SQL, spamTokens } from "./bayes/data-table.js";
export { MemoryTokenStore } from "./bayes/memory.js";
export { tokenize } from "./bayes/tokens.js";

/** How many of the most telling tokens a signal's detail names. */
const DETAIL_TOKENS = 5;

/**
 * Scores a submission by what moderators reported before. It runs in the `local` stage because
 * it reads the app's own storage, never a third party, and that read is its only await. Until the
 * store holds `minDocuments` reports of each label it emits nothing, so a fresh install relies on
 * the rules alone. `report` trains it; build it per tenant from that tenant's store.
 *
 * @example createSpamFilter({ checks: [...DEFAULT_RULES, bayes({ store: new DataTableTokenStore(ctx.db) })] })
 */
export function bayes(options: bayes.Options): SpamCheck {
	let store = options.store;
	let minDocuments = options.minDocuments ?? 20;
	let spamCut = options.spamCut ?? 0.9;
	let hamCut = options.hamCut ?? 0.2;
	let spamScore = options.spamScore ?? 6;
	let hamScore = options.hamScore ?? -4;
	let classifyOptions = {
		strength: options.strength ?? 1,
		prior: options.prior ?? 0.5,
		interestingTokens: options.interestingTokens ?? 15,
		minDeviation: options.minDeviation ?? 0.1,
	};

	return {
		name: "bayes",
		stage: "local",

		/**
		 * Emits `bayes.spam` above `spamCut`, `bayes.ham` below `hamCut`, and nothing between them
		 * or before the cold-start gate opens. A failed store read is a failure, never a verdict.
		 */
		async check(submission): Promise<Result<Signal[], SpamCheckError>> {
			let tokens = tokenize(submission, options);
			let read = await store.read(tokens);
			if (isFailure(read)) return read;
			let counts = read.data;
			if (counts.documents.spam < minDocuments || counts.documents.ham < minDocuments) {
				return success([]);
			}

			let { probability, clues } = classify(tokens, counts, classifyOptions);
			let isSpam = probability >= spamCut;
			if (!isSpam && probability > hamCut) return success([]);

			let named = clues
				.filter((clue) => (isSpam ? clue.probability > 0.5 : clue.probability < 0.5))
				.slice(0, DETAIL_TOKENS)
				.map((clue) => clue.token);
			return success([
				{
					check: isSpam ? "bayes.spam" : "bayes.ham",
					score: isSpam ? spamScore : hamScore,
					detail: `spam probability ${probability.toFixed(3)}; tokens: ${named.join(", ")}`,
				},
			]);
		},

		/** Counts the submission's tokens under `label`, tokenized exactly as `check` reads them. */
		async report(submission, label) {
			return await store.increment(tokenize(submission, options), label);
		},
	};
}

/** The types {@link bayes} reads. */
export namespace bayes {
	/** Where counts live, when the classifier speaks, and how much its verdicts weigh. */
	export interface Options extends tokenize.Options {
		/** One per tenant in a multi-tenant app, so training never crosses tenants. */
		store: TokenStore;
		/** Reports of each label required before any signal. @default 20 */
		minDocuments?: number;
		/** The spam probability at or above which `bayes.spam` is emitted. @default 0.9 */
		spamCut?: number;
		/** The spam probability at or below which `bayes.ham` is emitted. @default 0.2 */
		hamCut?: number;
		/** @default 6 */
		spamScore?: number;
		/** Negative, so a submission the site's history calls ham is pulled down. @default -4 */
		hamScore?: number;
		/** How many documents of weight the prior carries against a rarely seen token. @default 1 */
		strength?: number;
		/** The probability assumed for a token never seen. @default 0.5 */
		prior?: number;
		/** The most telling tokens that enter the combination. @default 15 */
		interestingTokens?: number;
		/** How far from 0.5 a token must sit to enter the combination. @default 0.1 */
		minDeviation?: number;
	}
}
