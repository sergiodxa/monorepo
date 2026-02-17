---
title: How to Build a Cache Abstraction for Cloudflare KV
excerpt: Create a type-safe cache abstraction for Cloudflare KV with flexible cache keys and the cache-aside pattern.
technologies: @cloudflare/workers-types@4.0.0
---

When building applications on Cloudflare Workers, you often need to cache expensive operations like database queries, API calls, or computed results. Cloudflare KV provides a globally distributed key-value store that's perfect for [server-side caching](/articles/http-vs-server-side-cache-in-remix), but working directly with the KV API can be repetitive and error-prone.

The challenge is creating a clean abstraction that handles cache key generation, TTL management, and the common cache-aside pattern (check cache first, compute if missing, then store). Let's build a `Cache.KVStore` class that wraps Cloudflare KV with a type-safe, ergonomic API.

## Define the Cache Key Type

```ts {% path="lib/cache.ts" %}
export namespace Cache {
	type CacheKey = string | { cacheKey: string } | { cacheKey(): string };
}
```

This union type allows three ways to specify cache keys: a plain string, an object with a `cacheKey` property, or an object with a `cacheKey()` method. This flexibility lets you pass entities directly as cache keys if they implement the interface.

## Create the Abstract Store Class

```ts {% path="lib/cache.ts" %}
export namespace Cache {
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
}
```

The abstract `Store` class defines the contract for any cache implementation. The `getKey` method handles all three cache key formats, normalizing them to a string. This abstraction allows you to swap storage backends (KV, R2, or in-memory) without changing your application code. You can [generate the Cloudflare environment types](/tutorials/generate-cloudflare-environment-type-with-wrangler) to get proper typing for `KVNamespace` and other bindings.

## Implement the KV Store

```ts {% path="lib/cache.ts" %}
export namespace Cache {
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
	}
}
```

The `KVStore` class takes a `KVNamespace` binding and a `waitUntil` function. The `write` method [uses `waitUntil`](/tutorials/use-waituntil-for-non-blocking-cache-writes) to perform the KV write operation after the response is sent, avoiding blocking the request. This is a common pattern in Cloudflare Workers to improve response times while ensuring writes complete.

## Add the Cache-Aside Pattern with Fetch

```ts {% path="lib/cache.ts" %}
export namespace Cache {
	export class KVStore extends Store {
		// ... previous methods

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
	}
}
```

The `fetch` method implements the cache-aside pattern: it first checks if the value exists in cache, returns it if found, otherwise calls the provided function to compute the value, stores it in cache, and returns it. This single method handles the most common caching scenario.

## Use the Cache in Your Application

```ts {% path="app/services/cache.server.ts" %}
import { Cache } from "~/lib/cache";

export function createCache(kv: KVNamespace, waitUntil: ExecutionContext["waitUntil"]) {
	return new Cache.KVStore(kv, waitUntil);
}
```

Create a factory function that instantiates the cache with your KV binding and the execution context's `waitUntil` method.

```ts {% path="app/routes/users.$id.tsx" %}
import type { Route } from "./+types/users.$id";

import { createCache } from "~/services/cache.server";

export async function loader({ params, context }: Route.LoaderArgs) {
	let cache = createCache(context.cloudflare.env.CACHE, context.cloudflare.ctx.waitUntil);

	let user = await cache.fetch(
		`user:${params.id}`,
		async () => {
			let data = await db.query.users.findFirst({
				where: eq(users.id, params.id),
			});
			return JSON.stringify(data);
		},
		{ ttl: 3600 },
	);

	return { user: JSON.parse(user) };
}
```

In your route loader, create the cache instance and use `fetch` to get the user data. The first request computes and caches the result for one hour. Subsequent requests return the cached value instantly.

## Use Objects as Cache Keys

```ts {% path="app/models/user.ts" %}
export class User {
	constructor(
		public id: string,
		public name: string,
	) {}

	get cacheKey(): string {
		return `user:${this.id}`;
	}
}
```

By implementing the `cacheKey` property, you can pass `User` instances directly to cache methods:

```ts {% path="app/routes/profile.tsx" %}
let user = new User("123", "John");
let cached = await cache.read(user); // Uses "user:123" as the key
```

This pattern keeps cache key logic close to your domain models and ensures consistency across your application.

## When to Use This Pattern

This cache abstraction works well for read-heavy workloads where data doesn't change frequently. The `waitUntil` pattern ensures writes don't block responses, but keep in mind that KV is eventually consistent, so recently written values may not be immediately available in all regions. For strongly consistent caching needs, consider using Durable Objects instead. For a broader view of caching approaches, see [HTTP vs Server-Side Cache](/articles/http-vs-server-side-cache-in-remix).
