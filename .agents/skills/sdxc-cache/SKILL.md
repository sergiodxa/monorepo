---
name: sdxc-cache
description: "@sdxc/cache is a cache contract — `read`, `write`, `fetch`, `delete`, each answering a `Result` instead of throwing — with a `MemoryCache` adapter for tests, a `WorkerKVCache` adapter over a Cloudflare KV namespace, and a Vitest conformance suite for new adapters. Use when memoizing a database read or an upstream API call behind a TTL, when a cache has to be swapped for an in-process one in tests, or when writing an adapter over another store."
---

# @sdxc/cache

One interface covers `read`, `write`, `fetch` and `delete`, and an adapter binds it to a store — an in-process map for tests, Workers KV in production. Nothing throws: every call answers with a `Result` from `@sdxc/result` carrying a `CacheError`, and each method takes the value's type on its own, so one instance serves a whole namespace whatever mix of types goes into it. TTLs are `@sdxc/duration` inputs like `"5 minutes"`. `WorkerKVCache` needs a Cloudflare KV binding; `MemoryCache` runs anywhere.

Full API, options and examples: [packages/cache/README.md](packages/cache/README.md)

## When to reach for it

- A database read or an upstream API call is repeated across requests and should be held for a TTL.
- Code under test reaches for a cache and the test has no KV namespace or Worker.
- A cache miss, an unreachable store and a failing loader need to be told apart at the call site.
- A new backing store (Redis, D1, the Cache API) should be proved to behave like a cache.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/cache": "workspace:*" } }
```

```ts
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { isFailure } from "@sdxc/result";

let cache = new WorkerKVCache(env.CACHE, { waitUntil: ctx.waitUntil.bind(ctx) });

let post = await cache.fetch(
	`post:${id}`,
	async () => db.query.posts.findFirst({ where: eq(posts.id, id) }),
	{ ttl: "5 minutes" },
);

if (isFailure(post)) return notFound();
render(post.data);
```

### Entry points

- `@sdxc/cache` — the `Cache` contract and `CacheError`
- `@sdxc/cache/memory` — `MemoryCache`, entries in a map for the life of the instance
- `@sdxc/cache/worker-kv` — `WorkerKVCache`, over a Cloudflare KV namespace
- `@sdxc/cache/conformance` — the Vitest suite that says what a cache is

## Suggestions

- Prefer `fetch(key, load, { ttl })`: it takes the value's type from the loader, so nothing is annotated or cast, and it absorbs everything the store does wrong — an unreachable store, an unparseable entry and a refused write all still answer with the computed value. A `fetch` failure therefore means the value could not be produced at all.
- What reads back is what the store serialized, not what went in: a `Date` written comes back as a string, and `fetch` types it that way (`JSONSerialized<T>`).
- `CacheError.code` is one of `unavailable`, `invalid_value` or `load_failed`; `unavailable` is the one a caller can ignore, since recomputing is the same recovery a miss asks for, and it is already recorded on the invocation's log. Every failure carries the `key` and the original error as `cause`.
- `MemoryCache` is not a mock — it serializes on write and parses on read and passes the same conformance suite, so a test sees the same value shapes production does. Pass `{ now: () => clock }` to expire an entry without waiting.
- Give `WorkerKVCache` a `waitUntil` so a write is handed to the platform rather than awaited; the value is still readable immediately, since it is held on the instance until the put lands.
- KV refuses a TTL under 60 seconds, so a shorter one leaves the entry unwritten and reports `unavailable`.

## Related

- `@sdxc/result` — every call answers with its `Result`; skill `sdxc-result`
- `@sdxc/duration` — the `"5 minutes"` TTL inputs; skill `sdxc-duration`
