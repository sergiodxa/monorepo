# @sdxc/cache

Cache contract with adapters for memory and Cloudflare KV.

One interface covers read, write, fetch and delete, and an adapter binds it to a store — an
in-process map for tests, Workers KV in production. Nothing throws: every call answers with a
`Result`, and each method takes the value's type on its own, so one instance serves a whole
namespace whatever mix of types goes into it.

## Installation

```bash
npm add @sdxc/cache
```

Every call answers with a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure` and
`isSuccess` come from. It installs alongside this package.

## Usage

An instance is a store, not a type. Each method takes the value's type on its own, so one
cache serves a whole namespace whatever mix of types goes into it. Nothing throws — every
call answers with a `Result`:

```typescript
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

`fetch` takes the type from the loader, so nothing is annotated and nothing is cast. What
comes back is what reads back out of the store, which is not always what went in:

```typescript
let session = await cache.fetch("session", async () => ({ at: new Date() }));
//  Result<{ at: string }, CacheError> — a Date is written as the string it serializes to
```

Swap the adapter to cache in a test without a KV namespace or a Worker:

```typescript
import { MemoryCache } from "@sdxc/cache/memory";

let cache = new MemoryCache();
```

## Nothing throws

Every method answers with a `Result<_, CacheError>` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and `CacheError.code` says
which of three things happened:

| Code            | Means                                                    | Reached by                |
| --------------- | -------------------------------------------------------- | ------------------------- |
| `unavailable`   | The store could not be reached, or refused the operation | `read`, `write`, `delete` |
| `invalid_value` | JSON could not write the value, or read the entry stored | every method              |
| `load_failed`   | The loader a `fetch` was given failed                    | `fetch`                   |

`unavailable` is the one a caller can ignore: the value is simply not cached, and computing
it is the same recovery a miss asks for. A store failure is also recorded on the
invocation's log through [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), so
discarding one still leaves a trace — store health is the package's own to report. A
`load_failed` is not logged, because it is the caller's and travels in the `Result`.

Every failure carries the `key` it happened on, and the original error as `cause`. So a
caller that would rather throw rethrows the cause and keeps its own error type:

```typescript
let stored = await cache.fetch(key, load, { ttl: TTL });
if (isFailure(stored)) throw stored.error.cause ?? stored.error;
return stored.data;
```

**`fetch` absorbs everything the store does wrong**, because it can compute a value
instead: an unreachable store, an entry that is not JSON, and a refused write all still
answer with the value. So a `fetch` failure means the value could not be produced at all.

## API

### `Cache`

The contract both adapters implement.

#### `read<T>(key): Promise<Result<JSONSerialized<T> | null, CacheError>>`

Reads an entry, succeeding with `null` when it is missing or expired.

`T` is an assertion. What a store holds under a key is a fact about the past, and no
signature can check it, so the parameter states a claim rather than verifying one. It
defaults to `JSONValue` for a caller who would rather narrow the result.

A stored `null` succeeds with `null` too, indistinguishable from a miss. Reach for `fetch`
where a cached `null` has to count as a hit.

```typescript
let hit = await cache.read<{ id: number }>("post:1");
if (isSuccess(hit) && hit.data !== null) render(hit.data);
```

#### `write<T>(key, value, options?): Promise<Result<void, CacheError>>`

Writes an entry, replacing any current value for the key. Succeeds once the value is
readable.

- `options.ttl` — how long the entry stays readable, as whole seconds or a duration string
  such as `"1 hour"`. Omitted, the entry never expires.

```typescript
await cache.write("post:1", { id: 1, publishedAt: new Date() }, { ttl: "1 hour" });
```

#### `fetch<T>(key, load, options?): Promise<Result<JSONSerialized<T>, CacheError>>`

Returns the stored entry, computing and storing it on a miss. The type comes from `load`,
and the value is returned as it reads back, so a hit and a miss answer with the same type.

A stored `null` is a hit here, unlike in `read`.

```typescript
let feed = await cache.fetch("feed", async () => buildFeed(), { ttl: "5 minutes" });
```

#### `delete(key): Promise<Result<void, CacheError>>`

Removes an entry, succeeding whether or not it exists.

### `CacheError`

The failure inside every `Result`. Carries `code`, the `key` it happened on, and the
original error as `cause`.

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

A deferred write is still readable the moment it succeeds: the value is held on the
instance until the put lands, and an instance is per request, which is the scope over
which reading your own writes is both achievable and worth anything. Two writes to one key
land in the order they were made, and a `delete` waits for a put still in flight.

KV refuses a TTL under 60 seconds, so a shorter one leaves the entry unwritten and reports
`unavailable`. A caller wanting a shorter lifetime than that wants something other than a
cache.

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
	let posts = await cache.fetch("posts", async () => db.query.posts.findMany(), {
		ttl: "5 minutes",
	});

	return isFailure(posts) ? [] : posts.data;
}

test("reads the posts once", async () => {
	let cache = new MemoryCache();

	await publishedPosts(cache);
	await publishedPosts(cache);

	expect(queries).toHaveLength(1);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

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

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
