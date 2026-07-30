# @pkg/kv-cache

Cache store abstraction for Cloudflare KV with a simple, consistent API.

## Overview

This package provides a cache store abstraction designed for Cloudflare Workers. It includes a `KVStore` implementation that wraps Cloudflare KV with a cleaner API and supports flexible cache keys.

The cache supports:

- String, object, or function-based cache keys
- TTL (time-to-live) for automatic expiration
- Fetch-through pattern for automatic cache population
- Non-blocking writes using `waitUntil`

## Usage

```typescript
import { Cache } from "@pkg/kv-cache";

// Create a KV store instance
let cache = new Cache.KVStore(env.KV, ctx.waitUntil.bind(ctx));

// Simple read/write
await cache.write("user:123", JSON.stringify(user), { ttl: 3600 });
let data = await cache.read("user:123");

// Fetch-through pattern (read or compute and cache)
let user = await cache.fetch(
	"user:123",
	async () => {
		let user = await db.query.users.findFirst({ where: eq(users.id, "123") });
		return JSON.stringify(user);
	},
	{ ttl: 3600 },
);
```

## API

### `Cache.KVStore`

A cache store implementation backed by Cloudflare KV.

#### `new Cache.KVStore(kv: KVNamespace, waitUntil: (promise: Promise<unknown>) => void)`

Creates a new KV store instance.

**Parameters:**

- `kv`: Cloudflare KV namespace binding
- `waitUntil`: Function to extend request lifetime for background writes

**Example:**

```typescript
let cache = new Cache.KVStore(env.CACHE, ctx.waitUntil.bind(ctx));
```

#### `cache.read(key: CacheKey): Promise<string | null>`

Read a value from the cache.

**Parameters:**

- `key`: The cache key (string, or object with `cacheKey` property/method)

**Returns:**

- The cached string value, or `null` if not found

**Example:**

```typescript
let value = await cache.read("my-key");
if (value !== null) {
	let data = JSON.parse(value);
}
```

#### `cache.write(key: CacheKey, value: string, options?: WriteOptions): Promise<void>`

Write a value to the cache. Uses `waitUntil` for non-blocking writes.

**Parameters:**

- `key`: The cache key
- `value`: The string value to cache
- `options.ttl`: Optional TTL in seconds
- `options.metadata`: Optional KV metadata

**Example:**

```typescript
await cache.write("user:123", JSON.stringify(user), { ttl: 3600 });
```

#### `cache.delete(key: CacheKey): Promise<void>`

Delete a value from the cache.

**Parameters:**

- `key`: The cache key to delete

**Example:**

```typescript
await cache.delete("user:123");
```

#### `cache.exists(key: CacheKey): Promise<boolean>`

Check if a key exists in the cache.

**Parameters:**

- `key`: The cache key to check

**Returns:**

- `true` if the key exists, `false` otherwise

**Example:**

```typescript
if (await cache.exists("user:123")) {
	// Key exists
}
```

#### `cache.fetch(key: CacheKey, fn: () => Promise<string>, options?: WriteOptions): Promise<string>`

Fetch-through pattern: read from cache, or compute and cache if missing.

**Parameters:**

- `key`: The cache key
- `fn`: Function to compute the value if not cached
- `options.ttl`: Optional TTL in seconds

**Returns:**

- The cached or computed value

**Example:**

```typescript
let userData = await cache.fetch(
	"user:123",
	async () => {
		let user = await fetchUserFromDB("123");
		return JSON.stringify(user);
	},
	{ ttl: 3600 },
);
```

#### `cache.list(prefix?: string, limit?: number): Promise<string[]>`

List all keys in the cache, optionally filtered by prefix.

**Parameters:**

- `prefix`: Optional prefix to filter keys
- `limit`: Maximum number of keys to return (default: 1000)

**Returns:**

- Array of key names

**Example:**

```typescript
let userKeys = await cache.list("user:", 100);
// ["user:123", "user:456", ...]
```

### Types

#### `CacheKey`

Flexible cache key type that supports strings, objects with a `cacheKey` property, or objects with a `cacheKey()` method.

```typescript
type CacheKey = string | { cacheKey: string } | { cacheKey(): string };
```

**Examples:**

```typescript
// String key
await cache.read("simple-key");

// Object with cacheKey property
await cache.read({ cacheKey: "object-key" });

// Object with cacheKey method
let user = { id: "123", cacheKey: () => `user:${this.id}` };
await cache.read(user);
```

#### `WriteOptions`

```typescript
interface WriteOptions {
	ttl?: number;
	metadata?: Record<string, unknown>;
}
```

## Integration with React Router

### Middleware Pattern

Create a cache middleware for React Router:

```typescript
// app/middleware/cache.ts
import { Cache } from "@pkg/kv-cache";
import { getContext } from "./context-storage";

export function getCache(): Cache.KVStore {
	let { env, ctx } = getContext().get(CloudflareContext);
	return new Cache.KVStore(env.CACHE, ctx.waitUntil.bind(ctx));
}
```

### Loader with Caching

```typescript
import { getCache } from "~/middleware/cache";
import { ok } from "@pkg/response";
import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	let cache = getCache();

	let data = await cache.fetch(
		`product:${params.id}`,
		async () => {
			let product = await db.query.products.findFirst({
				where: eq(products.id, params.id),
			});
			return JSON.stringify(product);
		},
		{ ttl: 300 }, // 5 minutes
	);

	return ok({ product: JSON.parse(data) });
}
```

### Cache Invalidation in Actions

```typescript
import { getCache } from "~/middleware/cache";
import { ok } from "@pkg/response";

export async function action({ params, request }: Route.ActionArgs) {
  let cache = getCache();

  // Update the product
  await db.update(products).set({ ... }).where(eq(products.id, params.id));

  // Invalidate the cache
  await cache.delete(`product:${params.id}`);

  return ok({ success: true });
}
```

## Pattern: Cache Key Objects

Use objects with `cacheKey` methods for type-safe, self-documenting cache keys:

```typescript
class UserCacheKey {
	constructor(private userId: string) {}

	cacheKey(): string {
		return `user:${this.userId}`;
	}
}

let key = new UserCacheKey("123");
let data = await cache.read(key); // Uses "user:123" as the key
```

## Pattern: Tiered TTL

Use different TTLs based on data freshness requirements:

```typescript
const TTL = {
	SHORT: 60, // 1 minute - frequently changing data
	MEDIUM: 300, // 5 minutes - moderately stable data
	LONG: 3600, // 1 hour - stable data
	DAY: 86400, // 24 hours - rarely changing data
};

await cache.write("realtime-stats", data, { ttl: TTL.SHORT });
await cache.write("user-profile", data, { ttl: TTL.MEDIUM });
await cache.write("site-config", data, { ttl: TTL.DAY });
```

## Pattern: Cache Warming

Pre-populate cache for critical data:

```typescript
async function warmCache(cache: Cache.KVStore) {
	let popularProducts = await db.query.products.findMany({
		where: eq(products.featured, true),
	});

	await Promise.all(
		popularProducts.map((product) =>
			cache.write(`product:${product.id}`, JSON.stringify(product), {
				ttl: 3600,
			}),
		),
	);
}
```

## Related Packages

- [`@pkg/logger`](/packages/logger) - Logging for cache operations
- [`@pkg/result`](/packages/result) - Result pattern for cache operations that can fail

## Tips

1. **Always use `waitUntil`** - Pass `ctx.waitUntil.bind(ctx)` to ensure writes complete after response
2. **JSON stringify/parse** - The cache stores strings only; serialize objects before caching
3. **Use meaningful prefixes** - Prefix keys by type (e.g., `user:`, `product:`) for easier debugging
4. **Set appropriate TTLs** - Balance freshness vs. performance based on data characteristics
5. **Consider cache stampede** - For high-traffic keys, consider locking or stale-while-revalidate patterns
