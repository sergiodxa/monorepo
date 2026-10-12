# @sdxc/cache

Cache contract with adapters for memory and Cloudflare KV.

One `Cache` interface covers read, write, fetch and delete, and an adapter binds it to a store:
an in-process map for tests, Workers KV in production. Every call answers with a `Result`, and
each method takes the value's type on its own, so one instance serves a whole namespace.

## Installation

```sh
npm add @sdxc/cache
```

Calls answer with a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
where `isFailure` and `isSuccess` come from; it installs alongside this package.

## Usage

### Compute once, read many times

```typescript
import { MemoryCache } from "@sdxc/cache/memory";
import { isFailure } from "@sdxc/result";

let cache = new MemoryCache();

let post = await cache.fetch(`post:${id}`, async () => loadPost(id), { ttl: "5 minutes" });
if (isFailure(post)) return new Response(null, { status: 500 });
return Response.json(post.data);
```

`fetch` returns the stored entry, or runs the loader on a miss and stores what it returns. The
type comes from the loader, so nothing is annotated.

### Read, write and delete entries

```typescript
import { isSuccess } from "@sdxc/result";

await cache.write("post:1", { id: 1, title: "Hello" }, { ttl: "1 hour" });

let hit = await cache.read<{ id: number; title: string }>("post:1");
if (isSuccess(hit) && hit.data !== null) console.info(hit.data.title);

await cache.delete("post:1");
```

`read` succeeds with `null` for a missing or expired entry. A `ttl` is whole seconds or a
duration string such as `"1 hour"`; without one the entry never expires.

### Values come back as JSON

Entries are stored as JSON, and every method answers with the value as it reads back, so a hit
and a miss have the same type:

```typescript
let session = await cache.fetch("session", async () => ({ at: new Date() }));
// Result<{ at: string }, CacheError>: the Date reads back as its ISO string
```

### Store entries in Workers KV

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";

let cache = new WorkerKVCache(env.CACHE, { waitUntil: ctx.waitUntil.bind(ctx) });
```

With `waitUntil`, a write returns at once and the put finishes after the response; the instance
answers reads of that key from memory until KV holds it. Create one instance per request.

## API

### `Cache`

The contract every adapter implements, exported from `@sdxc/cache`.

#### `read<T = JSONValue>(key: string): Promise<Result<JSONSerialized<T> | null, CacheError>>`

Reads an entry, succeeding with `null` when it is missing or expired. `T` is an assertion about
what the store holds. A stored `null` also reads as `null`; use `fetch` where a cached `null` must
count as a hit.

#### `write<T>(key: string, value: T, options?: CacheWriteOptions): Promise<Result<void, CacheError>>`

Stores an entry, replacing any current value for the key. The entry is readable once the call
succeeds.

#### `fetch<T>(key: string, load: () => Promise<T>, options?: CacheWriteOptions): Promise<Result<JSONSerialized<T>, CacheError>>`

Returns the stored entry, or computes, stores and returns it on a miss. A stored `null` is a
hit. Store problems (unreachable store, an entry that is not JSON, a refused write) still answer
with the computed value, so a failure means the value could not be produced: `load_failed` or
`invalid_value`.

#### `delete(key: string): Promise<Result<void, CacheError>>`

Removes an entry, succeeding whether or not it exists.

### `CacheError`

The error inside every failed `Result`: `code`, the `key` the call was made on, and the original
error as `cause`.

| `code`          | Means                                                       | Reached by                |
| --------------- | ----------------------------------------------------------- | ------------------------- |
| `unavailable`   | The store could not be reached, or refused the operation    | `read`, `write`, `delete` |
| `invalid_value` | JSON could not write the value, or could not read the entry | every method but `delete` |
| `load_failed`   | The loader given to `fetch` threw or rejected               | `fetch`                   |

An `unavailable` failure is also logged as a warning on the current invocation's log from
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), so a caller can treat it as a miss
and still leave a trace.

### `new MemoryCache(options?: MemoryCacheOptions)`

From `@sdxc/cache/memory`. Holds entries in a map for the life of the instance, serializing on
write and parsing on read exactly as a remote store does; a value read back is a copy.

- `options.now`: returns the current time in milliseconds, for expiring entries in a test.
  Defaults to `Date.now`.

### `new WorkerKVCache(kv: KVNamespace, options?: WorkerKVCacheOptions)`

From `@sdxc/cache/worker-kv`. Stores entries in a Cloudflare KV namespace.

- `options.waitUntil`: extends the invocation past the response. Given one, writes are deferred
  to it, the instance answers reads from those writes immediately, writes to one key land in
  order, and a `delete` waits for a pending put.

KV rejects a TTL under 60 seconds: the entry is not written and the put reports `unavailable`.

### `conformance(options: ConformanceOptions): void`

From `@sdxc/cache/conformance`. Registers Vitest tests asserting the `Cache` contract against an
adapter you construct.

- `options.name`: labels the registered suite.
- `options.create`: builds the cache under test; called once per test.
- `options.expire`: moves the adapter's clock forward by a number of seconds. Leave it out and
  the expiry tests are skipped.

### Types

#### `CacheWriteOptions`

`{ ttl?: DurationInput }`, where `DurationInput` from
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) is whole seconds or a duration
string.

#### `CacheErrorCode`

`"unavailable" | "invalid_value" | "load_failed"`.

#### `CacheErrorOptions`

What `new CacheError(message, options)` takes: `code`, `key`, and the standard `cause`. An
adapter of your own builds its failures with it.

#### `MemoryCacheOptions`, `WorkerKVCacheOptions`, `ConformanceOptions`

The options objects described above.

## Pattern: Accept Any Cache, Test With Memory

Type a dependency as `Cache` so production passes the KV adapter and a test passes a memory one.

```typescript
import type { Cache } from "@sdxc/cache";
import { MemoryCache } from "@sdxc/cache/memory";
import { isFailure } from "@sdxc/result";
import { expect, test, vi } from "vitest";

interface Post {
	id: string;
	title: string;
}

async function publishedPosts(cache: Cache, load: () => Promise<Post[]>) {
	let posts = await cache.fetch("posts:published", load, { ttl: "5 minutes" });
	return isFailure(posts) ? [] : posts.data;
}

test("loads the posts once", async () => {
	let cache = new MemoryCache();
	let load = vi.fn(async () => [{ id: "1", title: "Hello" }]);

	await publishedPosts(cache, load);
	await publishedPosts(cache, load);

	expect(load).toHaveBeenCalledTimes(1);
});
```

## Pattern: Expire Entries On A Test Clock

Pass `now` to control time, and an entry expires without waiting for it.

```typescript
import { MemoryCache } from "@sdxc/cache/memory";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

test("an entry expires after its ttl", async () => {
	let clock = 0;
	let cache = new MemoryCache({ now: () => clock });

	unwrap(await cache.write("token", "abc", { ttl: "1 minute" }));
	clock += 59_000;
	expect(unwrap(await cache.read("token"))).toBe("abc");

	clock += 1_000;
	expect(unwrap(await cache.read("token"))).toBeNull();
});
```

## Pattern: Cache Per Request In A Worker

Build the KV adapter inside the handler so read-your-own-writes stays scoped to one request, and
key entries by what they hold so a shared namespace stays readable.

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure } from "@sdxc/result";

interface Env {
	CACHE: KVNamespace;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		let cache = new WorkerKVCache(env.CACHE, { waitUntil: ctx.waitUntil.bind(ctx) });
		let locale = new URL(request.url).searchParams.get("locale") ?? "en";

		let feed = await cache.fetch(`feed:${locale}`, async () => buildFeed(locale), {
			ttl: "10 minutes",
		});
		if (isFailure(feed)) return new Response("Feed unavailable", { status: 503 });

		return Response.json(feed.data);
	},
};
```

## Pattern: Invalidate After A Write

Delete the cached entry when the source changes, and the next `fetch` recomputes it.

```typescript
import type { Cache } from "@sdxc/cache";

async function renamePost(cache: Cache, id: string, title: string) {
	await savePostTitle(id, title);
	await cache.delete(`post:${id}`);
}
```

## Pattern: Rethrow Failures

A caller that prefers exceptions rethrows the original error, keeping its own error type.

```typescript
import type { Cache } from "@sdxc/cache";
import { isFailure } from "@sdxc/result";

async function cachedReport(cache: Cache, month: string) {
	let report = await cache.fetch(`report:${month}`, async () => buildReport(month), {
		ttl: "1 day",
	});
	if (isFailure(report)) throw report.error.cause ?? report.error;
	return report.data;
}
```

## Pattern: Verify A Custom Adapter

Implement `Cache` over another store, answer its failures with a `CacheError`, and run the
conformance suite against it in a test file.

```typescript
import type { Cache } from "@sdxc/cache";
import { CacheError } from "@sdxc/cache";
import { conformance } from "@sdxc/cache/conformance";
import { failure } from "@sdxc/result";

export function unavailable(key: string, cause: unknown) {
	return failure(
		new CacheError(`The store could not reach ${key}`, { code: "unavailable", key, cause }),
	);
}

conformance({
	name: "RedisCache",
	create: (): Cache => new RedisCache(redis),
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per
day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/cache": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
