/**
 * The storage contract behind the classifier: per-token counts of the spam and ham documents a
 * token appeared in, plus how many documents of each label were reported. Keeping it to one read
 * and one increment lets any backend implement it with single statements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import type { Label, SpamCheckError } from "../check.js";

/**
 * Where the classifier keeps what moderators taught it. A multi-tenant app builds one store per
 * tenant database, so each tenant's reports shape only that tenant's verdicts.
 */
export interface TokenStore {
	/**
	 * Loads the counts for `tokens` and the document totals. A token never reported is absent
	 * from the returned map, which the classifier reads as zero of each label.
	 */
	read(tokens: readonly string[]): Promise<Result<TokenStore.Counts, SpamCheckError>>;

	/**
	 * Adds one `label` document: every token's count for that label and the label's document
	 * total each rise by one. Callers pass distinct tokens.
	 */
	increment(tokens: readonly string[], label: Label): Promise<Result<void, SpamCheckError>>;
}

/** The types a {@link TokenStore} returns. */
export namespace TokenStore {
	/** How many documents of each label an entry covers. */
	export interface Tally {
		spam: number;
		ham: number;
	}

	/** The answer to {@link TokenStore.read}. */
	export interface Counts {
		/** Every document ever reported, by label. */
		documents: Tally;
		/** The requested tokens that have been reported at least once. */
		tokens: Map<string, Tally>;
	}
}
