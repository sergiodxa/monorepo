---
title: How to Use waitUntil for Non-Blocking Cache Writes
excerpt: Speed up responses by writing to cache in the background using waitUntil.
technologies: @cloudflare/workers-types@4.0.0
---

When building applications on Cloudflare Workers, every millisecond counts. If you're [caching data to KV](/tutorials/build-a-cache-abstraction-for-cloudflare-kv), waiting for the write to complete before sending a response adds unnecessary latency. The user doesn't need to wait for the cache to be updated: they just need their data.

The `waitUntil` API lets you schedule work to run after the response is sent. This is perfect for cache writes, analytics, [batched logging](/articles/the-batchedlogger-pattern-for-workers), or any operation that doesn't affect the response. By deferring these writes, you can return responses faster while still ensuring the work completes.

## Create a Cache Store with waitUntil

Here's a cache store implementation that uses `waitUntil` for non-blocking writes:

```ts {% path="lib/cache.ts" %}
export namespace Cache {
	type CacheKey = string | { cacheKey: string } | { cacheKey(): string };

	interface StoreWriteOptions {
		ttl?: number;
	}

	abstract class Store {
		abstract read(key: CacheKey): Promise<string | null>;
		abstract write(key: CacheKey, value: string, options?: StoreWriteOptions): Promise<void>;
		abstract delete(key: CacheKey): Promise<void>;
		abstract exists(key: CacheKey): Promise<boolean>;
		abstract fetch(
			key: CacheKey,
			fn: () => Promise<string>,
			options?: StoreWriteOptions,
		): Promise<string>;

		protected getKey(key: CacheKey): string {
			if (typeof key === "string") return key;
			if (typeof key.cacheKey === "string") return key.cacheKey;
			return key.cacheKey();
		}
	}

	interface KVStoreWriteOptions extends StoreWriteOptions {
		metadata?: KVNamespacePutOptions["metadata"];
	}

	export class KVStore extends Store {
		constructor(
			private readonly kv: KVNamespace,
			private readonly waitUntil: (promise: Promise<unknown>) => void,
		) {
			super();
		}

		async read(key: CacheKey): Promise<string | null> {
			return this.kv.get(this.getKey(key), "text");
		}

		async write(
			key: CacheKey,
			value: string,
			{ ttl, metadata }: KVStoreWriteOptions = {},
		): Promise<void> {
			this.waitUntil(
				this.kv.put(this.getKey(key), value, {
					expirationTtl: ttl,
					metadata,
				}),
			);
		}

		async delete(key: CacheKey): Promise<void> {
			await this.kv.delete(this.getKey(key));
		}

		async exists(key: CacheKey): Promise<boolean> {
			let result = await this.read(key);
			return result !== null;
		}

		async fetch(
			key: CacheKey,
			fn: () => Promise<string>,
			options?: KVStoreWriteOptions,
		): Promise<string> {
			let cached = await this.read(key);
			if (cached !== null) {
				return cached;
			}
			let value = await fn();
			await this.write(key, value, options);
			return value;
		}

		async list(prefix?: string, limit = 1000): Promise<string[]> {
			let list = await this.kv.list({ prefix, limit });
			return list.keys.map((key) => key.name);
		}
	}
}
```

The key insight is in the `write` method. Instead of awaiting the KV `put` operation, it passes the promise to `waitUntil`. This tells Cloudflare to keep the Worker alive until the write completes, but the response can be sent immediately.

## Instantiate the Store with ExecutionContext

To use the store, you need access to the `waitUntil` function from the `ExecutionContext`. In a Cloudflare Worker, this is available in the fetch handler:

```ts {% path="app/worker.ts" %}
import { Cache } from "~/lib/cache";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		let cache = new Cache.KVStore(env.CACHE_KV, ctx.waitUntil.bind(ctx));

		// Use the cache in your request handling
		let data = await cache.fetch("user:123", async () => {
			let user = await fetchUserFromDatabase("123");
			return JSON.stringify(user);
		});

		return new Response(data, {
			headers: { "Content-Type": "application/json" },
		});
	},
};
```

Notice the `ctx.waitUntil.bind(ctx)` call. This ensures the `waitUntil` method retains its context when called inside the store.

## Use the Fetch Pattern for Cache-Aside

The `fetch` method implements the cache-aside pattern: read from cache first, and if the value doesn't exist, compute it and write to cache. The write happens in the background thanks to `waitUntil`:

```ts {% path="app/routes/user.ts" %}
export async function loader({ context }: Route.LoaderArgs) {
	let cache = context.cache;

	let userData = await cache.fetch(
		`user:${userId}`,
		async () => {
			// This only runs on cache miss
			let user = await db.query.users.findFirst({
				where: eq(users.id, userId),
			});
			return JSON.stringify(user);
		},
		{ ttl: 3600 }, // Cache for 1 hour
	);

	return { user: JSON.parse(userData) };
}
```

On a cache hit, the response is immediate. On a cache miss, the database query runs, the response is sent with the fresh data, and the cache write happens in the background.

## Support Flexible Cache Keys

The store accepts three types of cache keys: plain strings, objects with a `cacheKey` property, or objects with a `cacheKey()` method. This flexibility lets you use domain objects directly:

```ts {% path="app/models/user.ts" %}
class User {
	constructor(
		public id: string,
		public name: string,
	) {}

	cacheKey(): string {
		return `user:${this.id}`;
	}
}

// Use the object directly as a cache key
await cache.write(user, JSON.stringify(user.toJSON()));
```

The `getKey` helper in the base `Store` class handles all three formats, so you can pass whatever makes sense for your use case.

## Final Thoughts

Using `waitUntil` for cache writes is a simple optimization that can shave milliseconds off every response. The pattern works for any fire-and-forget operation: logging, analytics, webhooks, or background cleanup. Just remember that errors in `waitUntil` promises won't affect the response, so add proper error handling if you need to track failures. For heavier background work, consider using [Cloudflare Queues](/tutorials/build-a-job-framework-for-cloudflare-queues) or [Workflows](/tutorials/use-cloudflare-workflows-for-long-running-tasks) instead.
