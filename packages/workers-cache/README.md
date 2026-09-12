# @sdxc/workers-cache

Cache tags, purging and cache-status reads for Cloudflare Workers Cache.

Freshness is standard HTTP:
[`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
and [`ETag`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag) are
specified, so any runtime can write them. Invalidation is not: tagging a response uses a
`Cache-Tag` header no specification defines, and clearing entries means calling
[purge](https://developers.cloudflare.com/cache/how-to/purge-cache/) on the platform's own
cache object.

This package holds that vendor half — a typed tag vocabulary, the serializer, purging, a
cache-status reader, a recording double for tests, and a `remix/router` middleware that
applies all of it.

## Installation

```bash
npm add @sdxc/workers-cache
```

Every purge reports its outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure`
comes from, and the middleware entry point is built for the router in
[`remix`](https://www.npmjs.com/package/remix). Both install alongside this package, as does
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), which the middleware enriches
when an invocation log is current.

## Usage

### Declare A Tag Vocabulary

Write the tags a content model needs once, as functions rather than strings, so the response
header and the purge that clears it cannot drift apart:

```typescript
import { createTags } from "@sdxc/workers-cache";

export let TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postsByAuthor: (author: string) => `posts:${author}`,
	postList: () => "posts",
});

TAGS.post("123"); // "post:123", branded as a CacheTag
```

Every builder validates what it produced, so a tag the platform would drop throws where it
was written instead of disappearing at the edge.

### Tag A Response

```typescript
import { cacheTag } from "@sdxc/workers-cache";

let response = new Response(body, {
	headers: {
		"Cache-Control": "public, max-age=86400",
		"Cache-Tag": cacheTag([TAGS.post(post.id), TAGS.postList()]),
	},
});
```

`cacheTag` keeps the order you wrote and collapses repeats, so two participants naming the
same tag produce one header entry.

### Invalidate By Tag

```typescript
import { isFailure } from "@sdxc/result";
import { purge } from "@sdxc/workers-cache";

let result = await purge(cache, { tags: [TAGS.post(post.id), TAGS.postList()] });
if (isFailure(result)) throw result.error;
```

`cache` is whatever platform cache object the caller holds — a binding, or anything else
that answers `purge(selector)`. It is a parameter rather than a global, which is what keeps
this package free of a runtime import and testable with a double.

### Declare Caching From A Request Handler

```typescript
import cache from "@sdxc/workers-cache/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [cache({ cache: (ctx) => ctx.cacheBinding })] });

router.get("/posts/:id", async (ctx) => {
	let post = await findPost(ctx.params.id);
	ctx.cache("public, max-age=86400", TAGS.post(post.id), TAGS.postList());
	return html(render(post));
});

router.post("/posts/:id", async (ctx) => {
	await updatePost(ctx.params.id, await ctx.request.formData());
	await ctx.cache.purge(TAGS.post(ctx.params.id), TAGS.postList());
	return redirect(`/posts/${ctx.params.id}`);
});
```

`ctx.cache()` records intent and writes nothing itself. The headers land on the finished
response after the handler returns, which is what lets the middleware inspect that response
before agreeing to cache it.

## API

### `createTags(vocabulary)`

Wraps each builder in a validating one and narrows its return type to a branded `CacheTag`,
so only a vocabulary can produce a value where a tag is expected. A builder throws
`CacheTagError` when the tag it produced is empty, longer than `MAX_TAG_LENGTH`, outside
printable ASCII, or contains a space, a comma or a `"`.

```typescript
let TAGS = createTags({ post: (id: string) => `post:${id}` });
TAGS.post("1"); // "post:1"
TAGS.post("a b"); // throws CacheTagError
```

### `cacheTag(tags: readonly CacheTag[]): string`

Serializes a tag list into a `Cache-Tag` header value, preserving caller order and dropping
repeats. It throws `CacheTagError` when the list is empty, holds a tag the platform would
reject, or serializes beyond `MAX_CACHE_TAG_HEADER_LENGTH`. An empty list is rejected rather
than written as an empty header, because an empty `Cache-Tag` reads as tagged while purging
nothing.

```typescript
cacheTag([TAGS.post("1"), TAGS.postList()]); // "post:1,posts"
```

### `purge(cache: CacheInterface, options: PurgeOptions): Promise<Result<void, PurgeError>>`

Invalidates entries by tag, by URL prefix, or entirely. Success means the platform accepted
the purge; purging is eventually consistent, so the next read is not guaranteed to miss. An
empty tag list, a blank prefix, an invalid tag, and options selecting nothing all fail
without calling the platform.

```typescript
await purge(cache, { tags: [TAGS.postList()] });
await purge(cache, { prefixes: ["example.com/blog/"] });
await purge(cache, { everything: true }); // incidents, not content writes
```

A platform that declines a purge resolves rather than rejecting, so the outcome it reports
decides the result: a declined purge comes back as a `PurgeError` carrying the selector that
stayed stale and the platform's issues as `cause`.

### `cacheStatus(response: Response): CacheStatus`

Reads how the platform treated a response, from the `cf-cache-status` header, as one of
`"hit" | "miss" | "expired" | "bypass" | "unknown"`. An absent or unrecognized value reads as
`"unknown"` rather than being reported as a miss.

| Header value                                  | Status    |
| --------------------------------------------- | --------- |
| `HIT`                                         | `hit`     |
| `MISS`                                        | `miss`    |
| `EXPIRED`, `STALE`, `REVALIDATED`, `UPDATING` | `expired` |
| `BYPASS`, `DYNAMIC`                           | `bypass`  |
| anything else, or no header                   | `unknown` |

### `createRecordingCache(options?: RecordingCacheOptions): RecordingCache`

A `CacheInterface` that records purges instead of calling a platform. The returned object
exposes `purges` (every selector in call order), `purgedTags` (tags flattened across tag
purges), `failWith(error)` and `declineWith(issues)` to arm a rejection or a refusal, and
`reset()`. `options.failWith` and `options.declineWith` arm the same behavior up front.

```typescript
let cache = createRecordingCache();
await purge(cache, { tags: [TAGS.postList()] });
cache.purgedTags; // ["posts"]
```

### Constants

`CACHE_TAG_HEADER`, `CACHE_CONTROL_HEADER` and `CACHE_STATUS_HEADER` are the header names
this package reads and writes. `MAX_TAG_LENGTH` (1024) and `MAX_CACHE_TAG_HEADER_LENGTH`
(16384) are the size limits a tag and a serialized header are held to.
`NON_CACHEABLE_POLICY` is the `private, no-store` value a refused declaration is downgraded
to. `CACHEABLE_METHODS` holds `GET` and `HEAD`; `CACHEABLE_STATUS_CODES` holds `200`, `203`,
`204`, `206`, `300`, `301`, `302`, `304`, `307`, `308`, `404`, `405`, `410`, `414` and
`501`. They are exported so tests and logs assert against the same values the middleware
uses.

### Errors

#### `CacheTagError`

A tag the platform would reject, or a tag list that cannot be serialized. The rejected tag
stays on the error as `tag`, quoted in the message so whitespace remains visible.

#### `PurgeError`

A purge that did not take effect. `selector` carries what the call meant to invalidate, so a
log line names the tags or prefixes still serving stale content, and `cause` carries the
platform's own rejection.

### Types

```typescript
type CacheTag = string & { readonly [CACHE_TAG_BRAND]: true };

type CachePolicy = string;

type CacheStatus = "hit" | "miss" | "expired" | "bypass" | "unknown";

type PurgeOptions =
	{ tags: readonly CacheTag[] } | { prefixes: readonly string[] } | { everything: true };

interface PurgeSelector {
	tags?: string[];
	pathPrefixes?: string[];
	purgeEverything?: boolean;
}

interface PurgeIssue {
	code: number;
	message: string;
}

interface PurgeOutcome {
	success: boolean;
	errors: readonly PurgeIssue[];
}

interface CacheInterface {
	purge(selector: PurgeSelector): Promise<PurgeOutcome>;
}
```

`PurgeOptions` is what a caller writes; `PurgeSelector` is the normalized form handed to the
platform, with tags validated and deduplicated and exactly one field set. Its field names
mirror the platform's own purge options, so a
[Workers Cache](https://developers.cloudflare.com/workers/runtime-apis/cache/) binding
satisfies `CacheInterface` directly. `CacheTag` carries a type-only brand, so only a
vocabulary built by `createTags()` produces one and a renamed tag is a compile error at the
purge call.
`CacheTags<Vocabulary>` and `TagVocabulary` describe what `createTags` takes and returns, and
`PurgeByTags`, `PurgeByPrefixes` and `PurgeEverything` are the three members of
`PurgeOptions` under their own names.

### `cache(options: WorkersCacheMiddlewareOptions): Middleware`

Default export of `@sdxc/workers-cache/middleware`. It publishes a callable `context.cache`
and writes the declared headers onto the finished response.

`options.cache` is the whole option set: a `CacheInterface`, or a
`(context) => CacheInterface` resolver read off the request. The factory takes **no policy**,
which is what makes registering it once on a router safe — a route that never calls
`context.cache()` is left untouched, so no route inherits a lifetime it did not choose, and
two handlers can pick different ones. The interface is resolved and closed over, so
`context.cache.purge()` takes tags and only tags.

#### `context.cache(policy, ...tags)` / `context.cache({ policy, tags })`

Records intent. Tags accumulate across every call in the request into one `Cache-Tag`
header, so a router-scoped middleware and its handler both contribute instead of overwriting
each other. The policy is replaced by the most recent declaration, since only one lifetime
can be written.

#### `context.cache.purge(...tags): Promise<Result<void, PurgeError>>`

Awaits the platform call and returns the outcome, because a write action usually redirects
to the page it just invalidated and a deferred purge would race the follow-up request.

#### `context.cache.purgeLater(...tags): void`

Queues a purge that runs once the response has been produced, for invalidations nobody is
about to observe. Failures are logged, never thrown.

#### Refusals

After `next()` resolves, the middleware inspects the finished response — including headers
added between the declaration and the response — and only then writes anything:

| Condition                                                                 | Behavior                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| Response carries `Set-Cookie`                                             | Downgrade to `private, no-store`, write no tags, and warn |
| Request carried a session and the policy is `public`                      | Downgrade to `private, no-store`, write no tags, and warn |
| Method is `GET` or `HEAD` and the status is cacheable, with a declaration | Write `Cache-Control` and `Cache-Tag`                     |
| Anything else                                                             | Leave the response exactly as the handler built it        |

A downgrade warns on the current log and throws `UnsafeCachePolicyError` in development,
since it means a route asked for something unsafe. That error and its `CacheRefusalReason`
(`"set-cookie" | "session-with-public-policy"`) are exported from
`@sdxc/workers-cache/middleware`, alongside the `CacheDeclaration`,
`CacheDeclarationOptions` and `WorkersCacheMiddlewareOptions` types.

The `public` directive is matched as its own token, so `max-age=60` is never mistaken for a
public policy. A session published by an upstream session middleware is the precise signal
for whether a request is identified; without one, any cookie makes a `public` policy a
refusal. Development is read from `NODE_ENV` when it says which mode this is, and otherwise
from a request to `localhost`, `127.0.0.1`, `[::1]` or `0.0.0.0`.

## Pattern: Named Policies In One Module

The middleware carries no policy, so shared lifetimes belong in a module of named constants.
Those are plain strings, so jobs and hand-built responses reuse the same ones a handler
declares. Any builder produces them; this one comes from
[`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http):

```typescript
import { policy } from "@sdxc/http/cache";

export let PUBLIC_PAGE = policy({
	visibility: "public",
	maxAge: "1 day",
	staleWhileRevalidate: "1 week",
}).toString();

export let SHORT_LIVED = policy({ visibility: "public", maxAge: "5 minutes" }).toString();
```

```typescript
// Two handlers, two lifetimes, one middleware registration.
ctx.cache(PUBLIC_PAGE, TAGS.post(post.id), TAGS.postList());
ctx.cache(SHORT_LIVED, TAGS.postList());
```

## Pattern: A Group Tag From A Middleware

A middleware scoped to a group of routes can contribute a tag that applies to every response
in that group, so one purge invalidates all of it. Tags accumulate, so the handler's own tags
survive:

```typescript
import type { Middleware } from "remix/router";

let tenantTag: Middleware = (ctx, next) => {
	ctx.cache(PUBLIC_PAGE, TAGS.tenant(ctx.tenant.id));
	return next();
};
```

Accumulation happens along a middleware chain and within a handler, since the router has no
nested routes to accumulate up.

## Pattern: Testing A Cached Route

The recording cache stands in for the platform, so a test asserts on the headers a route
emits and the selectors it purged with no binding and no network:

```typescript
import { isFailure } from "@sdxc/result";
import { cacheStatus, createRecordingCache, purge } from "@sdxc/workers-cache";

let cache = createRecordingCache();
let response = await router.fetch(new Request("https://example.com/posts/1"));

expect(response.headers.get("Cache-Control")).toBe(PUBLIC_PAGE);
expect(response.headers.get("Cache-Tag")).toBe("post:1,posts");
expect(cacheStatus(response)).toBe("unknown"); // no edge in a test
```

The double also covers the two failure paths a content write depends on — a platform that
rejects, and one that declines the purge while resolving:

```typescript
let cache = createRecordingCache({ failWith: new Error("edge unavailable") });
expect(isFailure(await purge(cache, { tags: [TAGS.postList()] }))).toBe(true);

cache.reset();
cache.declineWith([{ code: 1122, message: "rate limited" }]);
expect(isFailure(await purge(cache, { tags: [TAGS.postList()] }))).toBe(true);
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
		"@sdxc/workers-cache": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
