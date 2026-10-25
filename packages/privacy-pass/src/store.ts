/**
 * The state an origin keeps to stop a token being spent twice: the challenges it issued
 * with a fresh redemption context, and the nonces of tokens spent against a shared one.
 * An app backs it with KV or a Durable Object; the memory store serves tests and one isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Double-spend state. Every key is lowercase hex, and every entry may be dropped once its
 * `ttl` (in seconds) has passed, since the challenge or nonce is refused by then anyway.
 */
export interface RedemptionStore {
	/**
	 * Remembers a challenge this origin sent, by its digest.
	 *
	 * @param digest - `SHA-256` of the TokenChallenge
	 * @param ttl - Seconds the challenge is accepted for
	 */
	saveChallenge(digest: string, ttl: number): Promise<void>;
	/**
	 * Forgets a challenge and answers whether it was still remembered, so a challenge
	 * answers one token at most.
	 *
	 * @param digest - The `challenge_digest` a token carries
	 * @returns `true` only to the first caller for an unexpired, saved digest
	 */
	takeChallenge(digest: string): Promise<boolean>;
	/**
	 * Records a token's nonce and answers whether it was new.
	 *
	 * @param nonce - The token's nonce
	 * @param ttl - Seconds to remember it for
	 * @returns `true` the first time a nonce is spent, `false` for every replay
	 */
	spendNonce(nonce: string, ttl: number): Promise<boolean>;
}

/**
 * A {@link RedemptionStore} in one isolate's memory. Its state stops at the isolate, so a
 * deployment answering from many isolates backs the interface with shared storage instead.
 *
 * @example new PrivacyPass({ issuer, store: new MemoryRedemptionStore() })
 */
export class MemoryRedemptionStore implements RedemptionStore {
	#challenges = new Map<string, number>();
	#nonces = new Map<string, number>();

	/** @inheritdoc */
	async saveChallenge(digest: string, ttl: number): Promise<void> {
		this.#sweep();
		this.#challenges.set(digest, Date.now() + ttl * 1000);
	}

	/** @inheritdoc */
	async takeChallenge(digest: string): Promise<boolean> {
		this.#sweep();
		return this.#challenges.delete(digest);
	}

	/** @inheritdoc */
	async spendNonce(nonce: string, ttl: number): Promise<boolean> {
		this.#sweep();
		if (this.#nonces.has(nonce)) return false;
		this.#nonces.set(nonce, Date.now() + ttl * 1000);
		return true;
	}

	/** Drops every expired entry, so memory stays bounded by what is still live. */
	#sweep(): void {
		let now = Date.now();
		for (let entries of [this.#challenges, this.#nonces]) {
			for (let [key, expiresAt] of entries) if (expiresAt <= now) entries.delete(key);
		}
	}
}
