/**
 * Thin static wrapper over the Cloudflare Workers KV binding that exposes get, set
 * (with optional TTL), delete, and a `getOrSet` read-through helper. It exists to
 * give the app a small, uniform caching API and to centralize KV access behind one
 * class instead of touching the binding directly across the codebase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

export class Cache {
	static async get(key: string): Promise<string | null> {
		return await env.KV.get(key);
	}

	static async set(key: string, value: string, ttl?: number): Promise<void> {
		await env.KV.put(key, value, { expirationTtl: ttl });
	}

	static async delete(key: string): Promise<void> {
		await env.KV.delete(key);
	}

	static async getOrSet(
		key: string,
		callback: () => Promise<string>,
		opts: {
			waitUntil?(promise: Promise<unknown>): void;
			ttl?: number;
		} = {},
	): Promise<string> {
		let cachedValue = await Cache.get(key);
		if (cachedValue) return cachedValue;
		let value = await callback();
		if (opts.waitUntil) opts.waitUntil(Cache.set(key, value, opts.ttl));
		else await Cache.set(key, value, opts.ttl);
		return value;
	}
}
