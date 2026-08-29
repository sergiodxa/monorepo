/**
 * Delivery-id deduplication: the store contract `verify()` consults, plus the
 * Workers KV implementation whose expiry semantics match it exactly.
 *
 * Timestamp tolerance narrows the window in which a captured request can be
 * replayed; remembering the ids already accepted closes it. Storage stays out of
 * this package so an app can instead keep deliveries in a table it can inspect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { toSeconds } from "@pkg/duration";

/** Key prefix used when a caller leaves the option unset. */
const DEFAULT_PREFIX = "webhook-replay:";

/** Shortest expiry Workers KV accepts; anything smaller is rejected by the binding. */
const MIN_TTL_SECONDS = 60;

/** Value written for a remembered id: presence is the whole signal. */
const SEEN_MARKER = "1";

/**
 * Records which delivery ids have already been accepted.
 *
 * Implementations need only presence and expiry, so a KV namespace or a table
 * with a TTL column both fit; a false positive here rejects a genuine delivery.
 */
export interface ReplayStore {
	/**
	 * Whether this delivery id was already accepted.
	 *
	 * @param id Delivery id from the `webhook-id` header.
	 * @returns `true` when the id is still remembered.
	 */
	seen(id: string): Promise<boolean>;

	/**
	 * Records a delivery id for at least the given duration.
	 *
	 * @param id Delivery id to remember.
	 * @param ttl How long the id must stay remembered.
	 */
	remember(id: string, ttl: DurationInput): Promise<void>;
}

/**
 * The part of a Workers KV binding this store uses.
 *
 * Naming only the methods actually called lets a real `KVNamespace` binding
 * satisfy it with no cast, and lets a test stand in a two-method fake.
 */
export interface ReplayKVNamespace {
	/** Reads a key as text, resolving `null` when it is absent or expired. */
	get(key: string): Promise<string | null>;

	/** Writes a key, expiring it after `expirationTtl` seconds. */
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * How a `KVReplayStore` names its keys.
 */
export interface KVReplayStoreOptions {
	/**
	 * Prefix put in front of every delivery id.
	 *
	 * Keep one prefix per sender when several share a namespace, so two senders
	 * cannot collide on the same delivery id.
	 *
	 * @default "webhook-replay:"
	 */
	prefix?: string;
}

/**
 * A `ReplayStore` backed by Workers KV, storing each id as a one-byte value
 * that expires on its own. KV reads are eventually consistent, so a duplicate
 * arriving within seconds, from another location, can still be missed.
 *
 * @example
 * let store = new Webhooks.KVReplayStore(env.WEBHOOKS);
 * await Webhooks.verify(request, { secret, store });
 */
export class KVReplayStore implements ReplayStore {
	/** Namespace the ids are written to. */
	#kv: ReplayKVNamespace;

	/** Prefix applied to every key this store touches. */
	#prefix: string;

	/**
	 * @param kv Workers KV binding to store delivery ids in.
	 * @param options Key naming; the default prefix suits a namespace used only for this.
	 */
	constructor(kv: ReplayKVNamespace, options: KVReplayStoreOptions = {}) {
		this.#kv = kv;
		this.#prefix = options.prefix ?? DEFAULT_PREFIX;
	}

	/**
	 * Whether the id is still remembered.
	 *
	 * @param id Delivery id to look up.
	 * @returns `true` while the id's key exists in the namespace.
	 */
	async seen(id: string): Promise<boolean> {
		return (await this.#kv.get(this.#key(id))) !== null;
	}

	/**
	 * Remembers an id until its expiry passes, raising the TTL to KV's
	 * one-minute minimum when a shorter duration is asked for, so a small
	 * tolerance still results in a write KV accepts.
	 *
	 * @param id Delivery id to remember.
	 * @param ttl How long to remember it, raised to one minute when shorter.
	 */
	async remember(id: string, ttl: DurationInput): Promise<void> {
		await this.#kv.put(this.#key(id), SEEN_MARKER, { expirationTtl: this.#expiration(ttl) });
	}

	/** Namespaced key for a delivery id. */
	#key(id: string): string {
		return `${this.#prefix}${id}`;
	}

	/** TTL in whole seconds, never below what the binding accepts. */
	#expiration(ttl: DurationInput): number {
		let seconds = toSeconds(ttl);
		if (!Number.isFinite(seconds)) return MIN_TTL_SECONDS;
		return Math.max(MIN_TTL_SECONDS, seconds);
	}
}
