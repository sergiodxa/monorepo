/**
 * KV caching for the MCP surface.
 *
 * The reads behind these tools are cheap individually and expensive in aggregate: a search
 * or a list touches every published post's metadata, and an agent asking three questions in
 * a turn repeats that three times. Caching by tool and arguments turns a repeated question
 * into one KV read.
 *
 * Every entry is shared by every caller because this surface is anonymous and identical for
 * everybody — no tool declares `available`. A credential introduced later must become part
 * of the key, or one visitor's answer would be served to another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CallToolResult, ToolMiddleware } from "@pkg/mcp";

import { Hex, sha256 } from "@pkg/crypto";
import { Cache } from "@pkg/kv-cache";
import { isFailure } from "@pkg/result";

import { getEnv } from "~/app/http/middleware/env";

/**
 * How long an entry may be served. Short enough that a correction is never stale for long
 * once the corpus changes, long enough that a conversation's repeated questions are free.
 * Being wrong for that long costs no more than an RSS reader or a CDN already would.
 */
const TTL = "5 minutes";

/** Key prefix, so these entries are recognizable in a namespace shared with other caches. */
const PREFIX = "mcp";

/** Opens the KV-backed store, deferring writes so a miss never waits on KV. */
function store(): Cache.KVStore {
	return new Cache.KVStore(getEnv("CACHE"), getEnv("waitUntil"));
}

/**
 * Builds a cache key from a name and the value that distinguishes one call from another.
 *
 * Hashing the value keeps the key bounded no matter what a caller sends, and argument order
 * stays stable because the validator always emits properties in the schema's declaration order.
 *
 * @param name What is being cached, such as a tool or resource name.
 * @param value The arguments or variables the entry is specific to.
 * @returns A bounded, deterministic key, or `null` when the digest is unavailable.
 */
async function keyFor(name: string, value: unknown): Promise<string | null> {
	let digest = await sha256(JSON.stringify(value ?? null));
	if (isFailure(digest)) return null;
	return `${PREFIX}:${name}:${Hex.encode(digest.data)}`;
}

/**
 * Caches a computed value under a key, as JSON.
 *
 * A `null` result is cached like any other, since a missing resource is a stable answer.
 * Caching here is only an optimization: a call still returns a fresh value when no key exists.
 *
 * @param name What is being cached.
 * @param value The variables the entry is specific to.
 * @param produce Computes the value on a miss.
 * @returns The cached or freshly computed value.
 */
export async function cached<T>(
	name: string,
	value: unknown,
	produce: () => Promise<T>,
): Promise<T> {
	let key = await keyFor(name, value);
	if (key === null) return produce();

	let text = await store().fetch(key, async () => JSON.stringify(await produce()), { ttl: TTL });
	return JSON.parse(text) as T;
}

/**
 * Middleware caching every tool result by tool name and arguments.
 *
 * Only a successful call is cached: `isError` often means a slug that does not exist yet,
 * and storing that would keep answering "not found" for the whole TTL after the post appears.
 *
 * @returns Tool middleware that serves a stored result when one is current.
 */
export function cacheToolResults(): ToolMiddleware {
	return async (ctx, next) => {
		let key = await keyFor(ctx.tool.name, ctx.input);
		if (key === null) return next();

		let cache = store();
		let hit = await cache.read(key);
		if (hit !== null) return JSON.parse(hit) as CallToolResult;

		let result = await next();
		if (!result.isError) await cache.write(key, JSON.stringify(result), { ttl: TTL });
		return result;
	};
}
