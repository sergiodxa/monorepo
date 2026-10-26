/**
 * The Privacy Pass double-spend state, kept in the `CACHE` KV namespace so a challenge one
 * isolate issues can be answered at any other. KV is eventually consistent, so two racing
 * requests may spend one token twice; an attestation only lowers a spam score, which tolerates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RedemptionStore } from "@sdxc/privacy-pass";

/** Namespaces every entry, so the shared `CACHE` namespace keeps them apart from cached pages. */
const PREFIX = "privacy-pass:";

/** KV refuses an `expirationTtl` under a minute, so shorter lifetimes round up to it. */
const MIN_TTL_SECONDS = 60;

/** Fresh challenges and spent nonces, each expiring with the lifetime the caller gives it. */
export class KVRedemptionStore implements RedemptionStore {
	/** @param kv The namespace entries are written to. */
	constructor(private kv: KVNamespace) {}

	/**
	 * Remembers a challenge the origin issued until `ttl` seconds pass.
	 *
	 * @param digest The challenge's digest, in hex.
	 * @param ttl Seconds the challenge stays answerable.
	 */
	async saveChallenge(digest: string, ttl: number): Promise<void> {
		await this.kv.put(`${PREFIX}challenge:${digest}`, "1", {
			expirationTtl: Math.max(ttl, MIN_TTL_SECONDS),
		});
	}

	/**
	 * Consumes a saved challenge, so each one is answered once.
	 *
	 * @param digest The challenge's digest, in hex.
	 * @returns Whether the challenge was saved and unanswered.
	 */
	async takeChallenge(digest: string): Promise<boolean> {
		let key = `${PREFIX}challenge:${digest}`;
		if ((await this.kv.get(key)) === null) return false;
		await this.kv.delete(key);
		return true;
	}

	/**
	 * Records a token's nonce as spent.
	 *
	 * @param nonce The token's nonce, in hex.
	 * @param ttl Seconds the nonce stays recorded.
	 * @returns `true` the first time a nonce is spent, `false` after.
	 */
	async spendNonce(nonce: string, ttl: number): Promise<boolean> {
		let key = `${PREFIX}nonce:${nonce}`;
		if ((await this.kv.get(key)) !== null) return false;
		await this.kv.put(key, "1", { expirationTtl: Math.max(ttl, MIN_TTL_SECONDS) });
		return true;
	}
}
