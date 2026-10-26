/**
 * A redemption store in Workers KV, so a challenge one isolate issues can be answered at any
 * other. KV is eventually consistent, so two requests racing with one token can both pass;
 * use it where a rare double spend is tolerable, and a Durable Object where it is not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RedemptionStore } from "./store.js";

/** Shortest `expirationTtl` Workers KV accepts; shorter lifetimes are written with it. */
const MINIMUM_EXPIRATION_TTL_SECONDS = 60;

/** Key prefix used when a call site does not choose one. */
const DEFAULT_PREFIX = "privacy-pass:";

/**
 * The part of a KV namespace the store uses, satisfied by a real `KVNamespace` binding.
 */
export interface RedemptionKVNamespace {
	/**
	 * Reads an entry as text.
	 *
	 * @param key - Full KV entry key
	 * @returns The stored text, or `null` when the entry is absent or expired
	 */
	get(key: string): Promise<string | null>;
	/**
	 * Writes an entry that KV removes after `expirationTtl` seconds.
	 *
	 * @param key - Full KV entry key
	 * @param value - Text to store
	 * @param options - Write options
	 */
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	/**
	 * Removes an entry.
	 *
	 * @param key - Full KV entry key
	 */
	delete(key: string): Promise<void>;
}

/** How a {@link KVRedemptionStore} names its entries. */
export interface KVRedemptionStoreOptions {
	/**
	 * Put in front of every entry key, so the store can share a namespace with other data.
	 *
	 * @default "privacy-pass:"
	 */
	prefix?: string;
}

/**
 * Fresh challenges and spent nonces as KV entries, each expiring with the lifetime the
 * `PrivacyPass` instance gives it, raised to KV's one-minute minimum.
 *
 * @example new PrivacyPass({ issuer, store: new KVRedemptionStore(env.CACHE) })
 */
export class KVRedemptionStore implements RedemptionStore {
	/** Put in front of every entry key. */
	readonly prefix: string;

	#kv: RedemptionKVNamespace;

	/**
	 * @param kv - The namespace entries are written to, e.g. `env.CACHE`
	 * @param options - The key prefix
	 */
	constructor(kv: RedemptionKVNamespace, options: KVRedemptionStoreOptions = {}) {
		this.#kv = kv;
		this.prefix = options.prefix ?? DEFAULT_PREFIX;
	}

	/**
	 * Remembers a challenge the origin issued until `ttl` seconds pass.
	 *
	 * @param digest - The challenge's digest, in hex
	 * @param ttl - Seconds the challenge stays answerable
	 */
	async saveChallenge(digest: string, ttl: number): Promise<void> {
		await this.#kv.put(this.#key("challenge", digest), "1", { expirationTtl: expirationTtl(ttl) });
	}

	/**
	 * Consumes a saved challenge, so each one is answered once.
	 *
	 * @param digest - The challenge's digest, in hex
	 * @returns Whether the challenge was saved and unanswered
	 */
	async takeChallenge(digest: string): Promise<boolean> {
		let key = this.#key("challenge", digest);
		if ((await this.#kv.get(key)) === null) return false;
		await this.#kv.delete(key);
		return true;
	}

	/**
	 * Records a token's nonce as spent.
	 *
	 * @param nonce - The token's nonce, in hex
	 * @param ttl - Seconds the nonce stays recorded
	 * @returns `true` the first time a nonce is spent, `false` after
	 */
	async spendNonce(nonce: string, ttl: number): Promise<boolean> {
		let key = this.#key("nonce", nonce);
		if ((await this.#kv.get(key)) !== null) return false;
		await this.#kv.put(key, "1", { expirationTtl: expirationTtl(ttl) });
		return true;
	}

	/** The entry key for a challenge digest or a nonce: `prefix` + `kind:value`. */
	#key(kind: "challenge" | "nonce", value: string): string {
		return `${this.prefix}${kind}:${value}`;
	}
}

/** A lifetime in seconds, raised to the shortest one KV accepts. */
function expirationTtl(ttl: number): number {
	return Math.max(Math.ceil(ttl), MINIMUM_EXPIRATION_TTL_SECONDS);
}
