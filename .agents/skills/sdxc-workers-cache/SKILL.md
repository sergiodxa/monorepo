---
name: sdxc-workers-cache
description: "@sdxc/workers-cache holds the vendor half of edge caching on Cloudflare: a branded `CacheTag` vocabulary, the `Cache-Tag` serializer, tag/prefix/everything purging, a `cf-cache-status` reader, a recording test double, and a `remix/router` middleware publishing `ctx.cache()`. Use when tagging responses for invalidation, purging after a content write, or declaring a cache policy from a route handler."
---

# @sdxc/workers-cache

Freshness is standard HTTP, so any runtime can write `Cache-Control` and `ETag`; invalidation is not, and this package holds that vendor half. `createTags()` turns a content model's tags into validated builders returning a branded `CacheTag`, `cacheTag()` serializes them into the header, `purge()` invalidates by tag, URL prefix or everything against any object answering `purge(selector)`, and `cacheStatus()` reads how the edge treated a response. The `@sdxc/workers-cache/middleware` entry point publishes a callable `context.cache` on a `remix/router` request and writes the declared headers onto the finished response. Purges report a `Result`; `createRecordingCache()` stands in for the platform in tests.

Full API, options and examples: [packages/workers-cache/README.md](packages/workers-cache/README.md)

## When to reach for it

- A cached response has to be invalidated by what it is about, not by URL, after a write.
- Tag strings are drifting between the response header that sets them and the purge that clears them.
- A route should declare its own cache lifetime while the middleware stays registered once, with no policy of its own.
- A test needs to assert on the headers a route emits and the selectors it purged, with no binding and no network.
- Something has to report whether the edge served a hit, a miss or a bypass.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/workers-cache": "workspace:*" } }
```

```ts
import { isFailure } from "@sdxc/result";
import { cacheTag, createTags, purge } from "@sdxc/workers-cache";

export let TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postList: () => "posts",
});

let response = new Response(body, {
	headers: {
		"Cache-Control": "public, max-age=86400",
		"Cache-Tag": cacheTag([TAGS.post(post.id), TAGS.postList()]),
	},
});

let result = await purge(cache, { tags: [TAGS.post(post.id), TAGS.postList()] });
if (isFailure(result)) throw result.error;
```

Through the middleware:

```ts
import cache from "@sdxc/workers-cache/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [cache({ cache: (ctx) => ctx.cacheBinding })] });
```

```ts
ctx.cache("public, max-age=86400", TAGS.post(post.id), TAGS.postList());
await ctx.cache.purge(TAGS.post(ctx.params.id), TAGS.postList());
```

### Entry points

- `@sdxc/workers-cache` — the tag vocabulary, `cacheTag`, `purge`, `cacheStatus`, `createRecordingCache`, the header/limit constants, `CacheTagError` and `PurgeError`.
- `@sdxc/workers-cache/middleware` — the default-exported `cache()` middleware, plus `UnsafeCachePolicyError`, `CacheRefusalReason` and the declaration option types.

## Suggestions

- Write the vocabulary once with `createTags()` and pass builders everywhere: `CacheTag` is branded, so a hand-written string is a compile error at the purge call and a renamed tag fails to compile rather than silently purging nothing.
- The middleware factory takes no policy, which is what makes one registration safe — a route that never calls `ctx.cache()` is untouched. Keep shared lifetimes as named string constants in one module so jobs and hand-built responses reuse them.
- Tags accumulate across every `ctx.cache()` call in a request into one header, while the policy is replaced by the most recent declaration, so a route-group middleware can contribute a group tag without overwriting the handler's tags.
- The middleware inspects the finished response and refuses unsafe declarations: a `Set-Cookie`, or a session paired with a `public` policy, downgrades to `private, no-store`, warns, and throws `UnsafeCachePolicyError` in development.
- `cache` is a parameter rather than a global — any object with `purge(selector)` satisfies `CacheInterface`, which is what makes `createRecordingCache()` (with `failWith` and `declineWith` to arm the two failure paths) a drop-in in tests.
- A platform that declines a purge resolves rather than rejecting, so success only means the purge was accepted; purging is eventually consistent and the next read is not guaranteed to miss.

## Related

- `@sdxc/result` — the `Result` every purge returns; skill `sdxc-result`
- `@sdxc/http` — its `policy()` builder writes the `Cache-Control` strings a declaration passes; skill `sdxc-http`
- `@sdxc/logger` — the invocation log the middleware enriches with its warnings; skill `sdxc-logger`
