# @pkg/workers-cache

Cache tags, purging, and cache-status reading for responses served through Cloudflare's Workers Cache.

## Overview

Freshness is standard HTTP: `Cache-Control`, `ETag`, and `304` are specified, so
they belong to an HTTP package that any runtime can use. Invalidation is not.
Tagging a response uses a `Cache-Tag` header that no specification defines, and
clearing entries means calling a purge method on the platform's cache object.
This package holds that vendor half: a typed tag vocabulary, the `Cache-Tag`
header, purging, cache-status inspection, and a `remix/router` middleware
that applies all of it.

Anything importing this package is Cloudflare-specific by construction, which is
the point: the HTTP layer stays specification-only and this package holds the
vocabulary that would not survive a move to another CDN. Policies are opaque
here — a `Cache-Control` string comes in from the caller and is written through
unchanged, so there is no dependency in either direction between the two.

Two entry points, for two kinds of caller:

- `@pkg/workers-cache` — tags, `cacheTag()`, `purge()`, `cacheStatus()`, and a
  recording cache double. Request handlers, queue consumers, scheduled handlers,
  and anything assembling headers by hand can use these.
- `@pkg/workers-cache/middleware` — the middleware that publishes a callable
  `context.cache`. This is how request handlers should declare caching; the
  standalone functions above are how jobs invalidate, since they have no request.

> The Workers Cache purge surface is new. Several details here are **assumed**
> rather than verified against Cloudflare documentation; see
> [Platform assumptions](#platform-assumptions) before enabling this in
> production.

## Usage

### Declaring A Tag Vocabulary

Declare the tags an app's content model needs once, as functions rather than
strings, so the response header and the later purge cannot drift apart:

```typescript
import { createTags } from "@pkg/workers-cache";

export const TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postsByType: (type: string) => `posts:${type}`,
	postList: () => "posts",
});

TAGS.post("123"); // "post:123", branded as a CacheTag
```

Every produced tag is validated, so an invalid tag throws where it was written
instead of being dropped silently at the edge.

### Caching A Response From A Handler

```typescript
import cache from "@pkg/workers-cache/middleware";

let router = createRouter({
	middleware: [cache({ cache: (ctx) => ctx.cacheBinding })],
});

router.get("/posts/:id", async (ctx) => {
	let post = await posts.find(ctx.params.id);
	ctx.cache(PUBLIC_PAGE, TAGS.post(post.id), TAGS.postList());
	return html(render(post));
});
```

`PUBLIC_PAGE` is a plain `Cache-Control` string built by your HTTP layer and
imported from an app module of named policies. The middleware never chooses it.

### Invalidating After A Write

Inside a request, purge through the context — the cache interface was already
resolved by the middleware:

```typescript
router.post("/posts/:id", async (ctx) => {
	await posts.update(ctx.params.id, await ctx.formData());

	let result = await ctx.cache.purge(TAGS.post(ctx.params.id), TAGS.postList());
	if (isFailure(result)) ctx.logger.error("cache.purge_failed", { error: result.error.message });

	return redirect(`/posts/${ctx.params.id}`);
});
```

Outside a request — a queue consumer, a scheduled handler — pass the cache
interface directly:

```typescript
import { purge } from "@pkg/workers-cache";

let result = await purge(cache, { tags: [TAGS.post(postId), TAGS.postList()] });
if (isFailure(result)) logger.error("cache.purge_failed", { error: result.error.message });
```

### Building Headers By Hand

```typescript
import { cacheTag } from "@pkg/workers-cache";

let headers = new Headers({
	"Cache-Control": PUBLIC_PAGE,
	"Cache-Tag": cacheTag([TAGS.post(post.id), TAGS.postList()]),
});
```

## API

### `createTags(vocabulary: TagVocabulary): CacheTags<Vocabulary>`

Wraps each builder in a validating one and narrows its return type to a branded
`CacheTag`, so only a vocabulary can produce a value where a tag is expected.

**Parameters:**

- `vocabulary`: Named builders returning the raw tag string

**Returns:**

- The same names and parameters, returning validated tags

**Throws:**

- `CacheTagError`, from a builder, when the tag it produced is empty, longer than
  `MAX_TAG_LENGTH`, not printable ASCII, or contains a space, comma, or `"`

**Example:**

```typescript
let TAGS = createTags({ post: (id: string) => `post:${id}` });
TAGS.post("1"); // "post:1"
TAGS.post("a b"); // throws CacheTagError
```

### `cacheTag(tags: readonly CacheTag[]): string`

Serializes a tag list into a `Cache-Tag` header value, keeping the order the
caller wrote and collapsing repeats.

**Parameters:**

- `tags`: Tags from a vocabulary

**Returns:**

- The comma-separated header value

**Throws:**

- `CacheTagError` when the list is empty, holds a tag the platform would reject,
  or serializes beyond `MAX_CACHE_TAG_HEADER_LENGTH`

An empty list is rejected rather than serialized to an empty header, because an
empty `Cache-Tag` reads as tagged while purging nothing.

**Example:**

```typescript
cacheTag([TAGS.post("1"), TAGS.postList()]); // "post:1,posts"
```

### `purge(cache: CacheInterface, options: PurgeOptions): Promise<Result<void, PurgeError>>`

Invalidates entries by tag, by URL prefix, or entirely. The cache interface is
the first argument rather than a global, which is what keeps this package free of
a runtime import and testable with a double.

**Parameters:**

- `cache`: The platform cache interface, or a recording double in tests
- `options`: Exactly one of `{ tags }`, `{ prefix }`, or `{ everything: true }`

**Returns:**

- Success when the platform accepted the purge, otherwise a `PurgeError` carrying
  the `selector` that did not take effect and the platform error as `cause`

Purging is eventually consistent: success means the request was accepted, not
that the next read misses. An empty tag list, a blank prefix, an invalid tag, and
options that select nothing all fail without calling the platform.

**Example:**

```typescript
await purge(cache, { tags: [TAGS.postList()] });
await purge(cache, { prefix: "example.com/blog/" });
await purge(cache, { everything: true }); // incidents, not content writes
```

### `cacheStatus(response: Response): CacheStatus`

Reads how the platform treated a response, as `"hit" | "miss" | "expired" |
"bypass" | "unknown"`.

**Parameters:**

- `response`: A response received from the platform edge

**Returns:**

- The normalized status; an absent or unrecognized header value reads as
  `"unknown"` rather than being reported as a miss

| Header value                                  | Status    |
| --------------------------------------------- | --------- |
| `HIT`                                         | `hit`     |
| `MISS`                                        | `miss`    |
| `EXPIRED`, `STALE`, `REVALIDATED`, `UPDATING` | `expired` |
| `BYPASS`, `DYNAMIC`                           | `bypass`  |
| anything else, or no header                   | `unknown` |

**Example:**

```typescript
cacheStatus(response); // "hit"
```

### `createRecordingCache(options?: RecordingCacheOptions): RecordingCache`

A cache interface that records purges instead of calling a platform.

**Parameters:**

- `options.failWith`: When set, every purge rejects with this error

**Returns:**

- A `CacheInterface` exposing `purges` (selectors in call order), `purgedTags`
  (tags flattened across tag purges), `failWith(error)`, and `reset()`

**Example:**

```typescript
let cache = createRecordingCache();
await purge(cache, { tags: [TAGS.postList()] });
cache.purgedTags; // ["posts"]
```

### `cache(options: WorkersCacheMiddlewareOptions): Middleware`

Default export of `@pkg/workers-cache/middleware`. Publishes a callable
`context.cache` that also carries `purge` and `purgeLater`.

**Parameters:**

- `options.cache`: The platform cache interface, or a `(context) => CacheInterface`
  resolver. This is the whole option set: the factory takes **no policy**, which
  is what makes it safe to register once on a router — a route that never calls
  `context.cache()` is left untouched, so no route inherits a caching decision it
  did not make, and two actions in one controller can still choose different
  lifetimes.

**Returns:**

- A middleware that publishes `context.cache` and writes the declared headers
  onto the finished response

The interface is resolved from the value or the resolver and closed over, so
nothing downstream passes it again: `context.cache.purge()` takes tags and only
tags.

#### `context.cache(policy, ...tags)` / `context.cache({ policy, tags })`

Records intent; it mutates nothing itself. Tags accumulate across every call in
the request into one `Cache-Tag` header, so a controller-scoped middleware and
its handler both contribute instead of overwriting each other. The policy is
replaced by the most recent declaration, since only one lifetime can be written.
The object form takes the same policy with tags as a list.

#### `context.cache.purge(...tags): Promise<Result<void, PurgeError>>`

Awaits the platform call and returns the outcome, because a write action usually
redirects to the page it just invalidated and a deferred purge would race the
follow-up request.

#### `context.cache.purgeLater(...tags): void`

Queues a purge that runs after the response is produced, for invalidations whose
freshness nobody is about to observe. Failures are logged, never thrown.

### Headers Are Written After `next()`

`context.cache()` only records. After `next()` resolves, the middleware inspects
the finished response — including headers added by middleware that ran between
the declaration and the response — and only then writes `Cache-Control` and
`Cache-Tag`. That ordering is what makes the refusal checks below possible.

### The Refusal Table

| Condition                                            | Behavior                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Response carries `Set-Cookie`                        | Downgrade to `private, no-store`, write no tags, and log           |
| Request carried a session and the policy is `public` | Downgrade to `private, no-store`, write no tags, and log           |
| Method is not `GET` or `HEAD`                        | Emit nothing                                                       |
| Status is not cacheable                              | Emit nothing                                                       |
| `context.cache()` was never called                   | Emit nothing, leaving the response exactly as the handler built it |

Downgrades log at error level and throw `UnsafeCachePolicyError` in development,
since a downgrade means a route asked for something unsafe. That error and its
`CacheRefusalReason` are exported from `@pkg/workers-cache/middleware`. The "emit
nothing" rows are checked first: they leave the response untouched, so there is
nothing to refuse.

- **Cacheable statuses** are `200`, `203`, `204`, `206`, `300`, `301`, `302`,
  `304`, `307`, `308`, `404`, `405`, `410`, `414`, and `501`.
- **`public` detection** matches the directive as its own token in the policy
  string, so `max-age=60` is never mistaken for a public policy.
- **Session detection** uses the session published by an upstream session
  middleware when there is one: data in it means the request is identified, an
  untouched session means it is not. Without that middleware the request's
  cookies are all the middleware can look at, so any cookie makes a `public`
  policy a refusal.
- **Development detection** reads `NODE_ENV` when it says which mode this is, and
  otherwise treats a request to `localhost`, `127.0.0.1`, `[::1]`, or `0.0.0.0`
  as development.
- **Logging** goes to whatever the request publishes as `context.logger`: an
  object with an `error(event, payload)` method is used as-is, and a plain log
  function receives the event with its payload encoded as JSON. A request with no
  logger is still downgraded — the refusal is enforced either way — but has
  nowhere to report it, which is the reason development throws.

### Types

#### `CacheTag`

```typescript
type CacheTag = string & { readonly [CACHE_TAG_BRAND]: true };
```

A validated tag. Only a vocabulary built by `createTags()` produces one, so a
renamed or mistyped tag is a compile error at the purge call.

#### `CacheInterface`

```typescript
interface CacheInterface {
	purge(selector: PurgeSelector): Promise<void>;
}
```

The only platform surface this package calls. Defined here rather than imported,
which is why `purge()` takes it as a parameter.

#### `PurgeSelector` and `PurgeOptions`

```typescript
interface PurgeSelector {
	tags?: string[];
	prefix?: string;
	everything?: boolean;
}

type PurgeOptions = { tags: readonly CacheTag[] } | { prefix: string } | { everything: true };
```

`PurgeOptions` is what a caller writes; `PurgeSelector` is the normalized form
handed to the platform, with tags validated and deduplicated and exactly one
field set.

#### Constants

`CACHE_TAG_HEADER`, `CACHE_CONTROL_HEADER`, `CACHE_STATUS_HEADER`,
`MAX_TAG_LENGTH`, `MAX_CACHE_TAG_HEADER_LENGTH`, `NON_CACHEABLE_POLICY`,
`CACHEABLE_METHODS`, and `CACHEABLE_STATUS_CODES` are exported so tests and logs
can assert against the same values the middleware uses.

## Platform assumptions

Cloudflare's Workers Cache purge API is new and its shape was **not** verified
against current Cloudflare documentation while this package was written. Every
assumed value lives in [`src/platform.ts`](./src/platform.ts), and the shape of
the platform call lives behind `CacheInterface` in
[`src/types.ts`](./src/types.ts). Those two files are the seam: a correction to
the real surface changes them and, at most, the adapter an app passes as
`options.cache`, and nothing else in this package or its callers moves.

| Surface                        | Status                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cache-Tag` header name        | **Assumed.** Comma-separated list, one header, written with `set` so the middleware is its only writer.                                     |
| Tag character set              | **Assumed.** Printable ASCII, excluding space, `,`, and `"`. Non-ASCII is rejected rather than encoded, so a tag never changes on the wire. |
| Tag length limit               | **Assumed** at 1024 characters per tag.                                                                                                     |
| Header length limit            | **Assumed** at 16384 characters for the serialized header.                                                                                  |
| Tag case sensitivity           | **Assumed** significant: tags are compared byte-for-byte, so `Post:1` and `post:1` are two tags.                                            |
| Purge API shape                | **Assumed.** `cache.purge({ tags })`, `{ prefix }`, or `{ everything: true }`, returning a promise that rejects on failure.                 |
| Purge prefix format            | **Assumed** to include the host, e.g. `example.com/blog/`.                                                                                  |
| Per-call and per-plan limits   | **Not implemented.** Tags are sent in one call with no chunking, so a per-call tag cap would surface as a platform rejection.               |
| How the cache reaches a Worker | **Deliberately unanswered.** Binding or execution context, the caller passes whatever it has as `options.cache`.                            |
| `cf-cache-status` header       | **Assumed** as the status header, with the value vocabulary in the table above.                                                             |
| Enablement                     | **Out of scope.** Workers Cache is turned on in each app's `wrangler.jsonc`, alongside the infrastructure decision it represents.           |

Verify these before raising cache lifetimes, and treat a purge that reports
success but invalidates nothing as evidence that one of the rows above is wrong.

## Pattern: Named Policies In An App Module

The middleware carries no policy, so shared lifetimes belong in an app module of
named constants. Those are plain values, so jobs and hand-built responses reuse
the same ones a handler declares.

```typescript
// app/http/cache.ts
export const PUBLIC_PAGE = policy({
	visibility: "public",
	maxAge: "1 day",
	staleWhileRevalidate: "1 week",
});
export const SHORT_LIVED = policy({ visibility: "public", maxAge: "5 minutes" });
```

```typescript
// Two actions in one controller, two lifetimes, one middleware registration.
ctx.cache(PUBLIC_PAGE, TAGS.post(post.id), TAGS.postList());
ctx.cache(SHORT_LIVED, TAGS.postList());
```

## Pattern: A Group Tag From A Middleware

A router- or controller-scoped middleware can contribute a tag that applies to
every response in its group, so one purge invalidates all of it. Tags accumulate,
so the handler's own tags survive.

```typescript
let tenantTag: Middleware = (ctx, next) => {
	ctx.cache(PUBLIC_PAGE, TAGS.tenant(ctx.tenant.id));
	return next();
};
```

Note that `remix/router` has no nested routes: accumulation happens along a
middleware chain and within a handler, never up a route tree.

## Pattern: Testing A Cached Route

```typescript
import { cacheStatus, createRecordingCache } from "@pkg/workers-cache";

let cache = createRecordingCache();
let response = await router.fetch(new Request("https://example.com/posts/1"));

expect(response.headers.get("Cache-Control")).toBe(PUBLIC_PAGE);
expect(response.headers.get("Cache-Tag")).toBe("post:1,posts");
expect(cacheStatus(response)).toBe("unknown"); // no edge in a test
```

The double also covers the failure path, which is the one a content write depends
on:

```typescript
let cache = createRecordingCache({ failWith: new Error("edge unavailable") });
let result = await purge(cache, { tags: [TAGS.postList()] });

expect(isFailure(result)).toBe(true);
```

## Related Packages

- [`@pkg/result`](/packages/result) - The `Result` every purge returns, so a
  failed invalidation is a value the caller has to handle
- [`@pkg/http`](/packages/http) - Specification-level HTTP helpers, including the
  `Cache-Control` policies passed into a declaration; it has no dependency on
  this package and this package has none on it

## Tips

1. **Register the middleware outside anything that writes the response** - its
   refusal checks inspect whatever response reaches it, so a session middleware
   that attaches a cookie further out would let a `public` policy through.
2. **Emit tags from the first cached response** - a response cached before a tag
   existed cannot be purged by that tag, so tags are cheap to add and expensive
   to retrofit.
3. **Every tag is a commitment** - a tag nothing purges is worse than no tag,
   because it suggests coverage that does not exist.
4. **Prefer at least one tag on anything that can change** - a policy with no
   tags is legitimate, but only expiry or a broad purge can clear it.
5. **Raise lifetimes only after purging is verified end to end** - long lifetimes
   are safe because invalidation is explicit, not because expiry is long.
6. **Use `purge()` in jobs and `context.cache.purge()` in handlers** - the
   standalone function exists for callers with no request; reaching for it inside
   a handler means threading a platform object that the middleware already holds.
7. **Keep `purgeLater()` for invalidations nobody is about to observe** - the
   awaited form is the default precisely because a redirect races a deferred
   purge.
8. **Purging everything is an incident tool** - it is in the API for recovery,
   not for content writes.
9. **Log `cacheStatus()` per request** - hit rate is only observable if something
   records it, and a deploy that halves it is otherwise invisible.
