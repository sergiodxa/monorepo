/**
 * KV caching for the MCP surface.
 *
 * The reads behind these tools are cheap individually and expensive in aggregate: a search
 * or a list touches every published post's metadata, and an agent asking three questions in
 * a turn repeats that three times. Caching by tool and arguments turns a repeated question
 * into one KV read.
 *
 * Every entry is shared by every caller. That is only correct because this surface is
 * anonymous and identical for everybody — no tool declares `available`, so no answer
 * depends on who asked. Introducing a credential here means the caller's identity has to
 * become part of the key, or one visitor's answer will be served to another.
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
 * How long an entry may be served.
 *
 * Five minutes: the corpus changes when something is published or edited, which happens on
 * the order of days, so this is short enough that a correction is never stale for long and
 * long enough that a conversation's repeated questions are free. The cost of being wrong is
 * a reader seeing a five-minute-old version of a post, which is what an RSS reader or a CDN
 * would show them anyway.
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
 * The distinguishing value is hashed rather than spelled out, because a tool's arguments
 * can carry a 200-character query and a KV key cannot: hashing bounds the key regardless of
 * what a caller sends. Argument order is stable because the validator emits properties in
 * the schema's declaration order, so the same call always produces the same key.
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
 * Used by the resource handlers, which have no middleware layer of their own. A `null`
 * result is cached like any other: for a read it means the resource does not exist, and
 * repeating that lookup costs the same as any other miss.
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
	// Without a key there is nothing to look under, so the call proceeds uncached rather
	// than failing: a cache is an optimization and must not be able to break a read.
	if (key === null) return produce();

	let text = await store().fetch(key, async () => JSON.stringify(await produce()), { ttl: TTL });
	return JSON.parse(text) as T;
}

/**
 * Middleware caching every tool result by tool name and arguments.
 *
 * A failed call is never cached. `isError` means the tool ran and could not do what was
 * asked — often because the caller passed a slug that does not exist — and storing that
 * would keep answering "not found" for five minutes after the post appears.
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
