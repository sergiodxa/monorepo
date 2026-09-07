# @sdxc/cache

Cache contract with adapters for memory and Cloudflare KV.

## Installation

```bash
npm add @sdxc/cache
```

## Usage

An instance is a store, not a type. Each method takes the value's type on its own, so one
cache serves a whole namespace whatever mix of types goes into it:

```typescript
import { WorkerKVCache } from "@sdxc/cache/worker-kv";

let cache = new WorkerKVCache(env.CACHE, { waitUntil: ctx.waitUntil.bind(ctx) });

let post = await cache.fetch(
	`post:${id}`,
	async () => db.query.posts.findFirst({ where: eq(posts.id, id) }),
	{ ttl: "5 minutes" },
);
```

`fetch` takes the type from the loader, so nothing is annotated and nothing is cast. What
comes back is what reads back out of the store, which is not always what went in:

```typescript
let session = await cache.fetch("session", async () => ({ at: new Date() }));
//  { at: string } — a Date is written as the string it serializes to
```

Swap the adapter to cache in a test without a KV namespace or a Worker:

```typescript
import { MemoryCache } from "@sdxc/cache/memory";

let cache = new MemoryCache();
```

## API

### `Cache`

The contract both adapters implement.

#### `read<T>(key): Promise<JSONSerialized<T> | null>`

Reads an entry, or `null` when it is missing or expired.

`T` is an assertion. What a store holds under a key is a fact about the past, and no
signature can check it, so the parameter states a claim rather than verifying one. It
defaults to `JSONValue` for a caller who would rather narrow the result.

A stored `null` reads as `null` too, indistinguishable from a miss. Reach for `fetch`
where a cached `null` has to count as a hit.

```typescript
let hit = await cache.read<{ id: number }>("post:1");
if (hit !== null) render(hit);
```

#### `write<T>(key, value, options?): Promise<void>`

Writes an entry, replacing any current value for the key. Resolves once the value is
readable.

- `options.ttl` — how long the entry stays readable, as whole seconds or a duration string
  such as `"1 hour"`. Omitted, the entry never expires.

```typescript
await cache.write("post:1", { id: 1, publishedAt: new Date() }, { ttl: "1 hour" });
```

#### `fetch<T>(key, load, options?): Promise<JSONSerialized<T>>`

Returns the stored entry, computing and storing it on a miss. The type comes from `load`,
and the value is returned as it reads back, so a hit and a miss answer with the same type.

A stored `null` is a hit here, unlike in `read`.

```typescript
let feed = await cache.fetch("feed", async () => buildFeed(), { ttl: "5 minutes" });
```

#### `delete(key): Promise<void>`

Removes an entry, whether or not it exists.

### `MemoryCache`

`@sdxc/cache/memory` — holds entries in a map for the life of the instance.

It is not a mock. It serializes on write and parses on read, so a `Date` comes back as a
string here exactly as it would from a remote store, and it passes the same conformance
suite every other adapter does. A value read back is a copy, so mutating it changes
nothing that is stored.

```typescript
new MemoryCache();
new MemoryCache({ now: () => clock }); // expire an entry without waiting for one
```

- `options.now` — reads the current time in milliseconds. Defaults to `Date.now`.

### `WorkerKVCache`

`@sdxc/cache/worker-kv` — reads and writes entries in a KV namespace.

```typescript
new WorkerKVCache(env.CACHE);
new WorkerKVCache(env.CACHE, { waitUntil: ctx.waitUntil.bind(ctx) });
```

- `options.waitUntil` — extends the invocation past the response. Given one, a write is
  handed over and the caller is not made to wait for KV.

A deferred write is still readable the moment it resolves: the value is held on the
instance until the put lands, and an instance is per request, which is the scope over
which reading your own writes is both achievable and worth anything. Two writes to one key
land in the order they were made.

KV refuses a TTL under 60 seconds, so a shorter one leaves the entry unwritten and warns
on the invocation's log. A caller wanting a shorter lifetime than that wants something
other than a cache.

### `conformance(options)`

`@sdxc/cache/conformance` — registers the suite that says what a cache is, as Vitest tests
against whatever you construct. Run it against a new adapter and it is a cache, or it is
not.

```typescript
import { conformance } from "@sdxc/cache/conformance";

conformance({
	name: "MyCache",
	create: () => new MyCache(),
	expire: (seconds) => clock.advance(seconds),
});
```

- `name` — labels the registered suite.
- `create` — builds the cache under test, called for every test so a mutable adapter starts
  clean.
- `expire` — moves the adapter's clock forward. An adapter that can only expire in real
  time leaves it out, and the expiry tests are registered only for the adapters that can.

## Failures degrade to misses

A cache is an optimization, so a store that cannot answer is a miss rather than an error:
`read` returns `null`, `write` returns, and `fetch` computes the value and returns it. No
call site handles a cache failure separately from a cache miss, because the recovery is the
same either way.

Failures are recorded on the invocation's log through `@sdxc/logger`, so a store that is
down is visible as something other than a cache that never hits.

Two things are not store failures and reach the caller as their own errors: what a loader
throws, and a value JSON cannot write.

## Pattern: keying by prefix

Prefix a key by what it holds, so entries are recognizable in a namespace shared with other
caches and a related group can be reasoned about together:

```typescript
await cache.write(`post:${id}`, post, { ttl: "1 hour" });
await cache.write(`feed:${locale}`, feed, { ttl: "5 minutes" });
```

## Pattern: a cache in a test

Take `Cache` where a cache is used, and the test supplies a memory one:

```typescript
async function publishedPosts(cache: Cache): Promise<Post[]> {
	return cache.fetch("posts", async () => db.query.posts.findMany(), { ttl: "5 minutes" });
}

test("reads the posts once", async () => {
	let cache = new MemoryCache();

	await publishedPosts(cache);
	await publishedPosts(cache);

	expect(queries).toHaveLength(1);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/cache": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
