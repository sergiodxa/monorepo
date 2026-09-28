/**
 * An in-process token store for tests and local development. It is the reference for the counts
 * a persistent store keeps, with state that lives and dies with the instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { Label, SpamCheckError } from "../check.js";

import type { TokenStore } from "./store.js";

/** Keeps counts in a `Map` owned by the instance, so two instances never share training. */
export class MemoryTokenStore implements TokenStore {
	#documents: TokenStore.Tally = { spam: 0, ham: 0 };

	#tokens = new Map<string, TokenStore.Tally>();

	/** Answers copies, so a caller mutating the result leaves the stored counts intact. */
	async read(tokens: readonly string[]): Promise<Result<TokenStore.Counts, SpamCheckError>> {
		let found = new Map<string, TokenStore.Tally>();
		for (let token of tokens) {
			let tally = this.#tokens.get(token);
			if (tally !== undefined) found.set(token, { ...tally });
		}
		return success({ documents: { ...this.#documents }, tokens: found });
	}

	/** Counts each distinct token once, however often `tokens` repeats it. */
	async increment(tokens: readonly string[], label: Label): Promise<Result<void, SpamCheckError>> {
		for (let token of new Set(tokens)) {
			let tally = this.#tokens.get(token) ?? { spam: 0, ham: 0 };
			tally[label] += 1;
			this.#tokens.set(token, tally);
		}
		this.#documents[label] += 1;
		return success(undefined);
	}
}
