/**
 * A `SeenActivities` store over any `@sdxc/cache` `Cache`, so an app whose remote-document
 * cache already sits on Workers KV can remember processed activity ids in the same place.
 * Best effort by contract: every handler is idempotent, so a lost claim only costs work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";

import type { SeenActivities } from "./store.js";

/** Keeps the claims apart from anything else the cache holds. */
const KEY_PREFIX = "activitypub:seen:";

/** Workers KV refuses an expiration under a minute, so a shorter claim is held for one. */
const MIN_TTL_SECONDS = 60;

/**
 * Claims activity ids in a `Cache` under `activitypub:seen:<id>`. A claim reads the key and
 * writes it when missing, so two deliveries racing through different isolates can both win;
 * the handlers' idempotency covers that.
 *
 * @example new CacheSeenActivities(new WorkerKVCache(env.CACHE))
 */
export class CacheSeenActivities implements SeenActivities {
	readonly #cache: Cache;

	/** @param cache Where claims are held until their TTL passes. */
	constructor(cache: Cache) {
		this.#cache = cache;
	}

	/**
	 * `true` when `id` was not claimed within its TTL, held from now for `ttl` rounded up to
	 * whole seconds and at least a minute. A cache that cannot be read is a failure; one that
	 * refuses the write still answers `true`, since processing again is harmless.
	 */
	async claim(id: string, ttl: DurationInput): Promise<Result<boolean, Error>> {
		let ms = toMs(ttl);
		if (!Number.isFinite(ms) || ms <= 0) {
			return failure(new RangeError(`"${String(ttl)}" is not a duration a claim can last.`));
		}

		let key = `${KEY_PREFIX}${id}`;
		let held = await this.#cache.read<number>(key);
		if (isFailure(held)) return held;
		if (held.data !== null) return success(false);

		let seconds = Math.max(MIN_TTL_SECONDS, Math.ceil(ms / 1000));
		await this.#cache.write(key, Date.now(), { ttl: seconds });
		return success(true);
	}
}
