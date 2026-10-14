# @sdxc/workers-cache

Cache tags, purging and cache-status reads for Cloudflare Workers Cache.

Freshness is standard HTTP: any runtime writes
[`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).
Invalidation is vendor-specific: a `Cache-Tag` header labels a response, and a
[purge](https://developers.cloudflare.com/cache/how-to/purge-cache/) on the platform's cache
object clears it. This package covers that half: a typed tag vocabulary, purging, cache-status
reads, a recording double for tests, and a router middleware that ties them together.

## Installation

```sh
npm add @sdxc/workers-cache
```

Purges answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), the
`./middleware` entry point runs on `remix/router` from [`remix`](https://www.npmjs.com/package/remix)
and logs through [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger), and `cacheHops`
parses with [`@sdxc/structured-fields`](https://www.npmjs.com/package/@sdxc/structured-fields).

## Usage

### Declare a tag vocabulary

```typescript
import { createTags } from "@sdxc/workers-cache";

export let TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postsByAuthor: (author: string) => `posts:${author}`,
	postList: () => "posts",
});

TAGS.post("123"); // "post:123", typed as CacheTag
TAGS.post("a b"); // throws CacheTagError: tags cannot contain spaces
```

The header and the purge both call the same builder, so they cannot drift apart, and an invalid
tag throws where it was built.

### Tag a response

```typescript
import { cacheTag } from "@sdxc/workers-cache";

let response = new Response(body, {
	headers: {
		"Cache-Control": "public, max-age=86400",
		"Cache-Tag": cacheTag([TAGS.post("123"), TAGS.postList()]), // "post:123,posts"
	},
});
```

### Purge by tag

```typescript
import { isFailure } from "@sdxc/result";
import { purge } from "@sdxc/workers-cache";

let result = await purge(env.CACHE, { tags: [TAGS.post("123"), TAGS.postList()] });
if (isFailure(result)) throw result.error;
```

The first argument is any object with a `purge(selector)` method; a Workers Cache binding fits
as is.

### Declare caching from a route

```typescript
import cache from "@sdxc/workers-cache/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [cache({ cache: env.CACHE })] });

router.get("/posts/:id", async (ctx) => {
	let post = await findPost(ctx.params.id);
	ctx.cache("public, max-age=86400", TAGS.post(post.id), TAGS.postList());
	return Response.json(post);
});

router.post("/posts/:id", async (ctx) => {
	await updatePost(ctx.params.id, await ctx.request.formData());
	await ctx.cache.purge(TAGS.post(ctx.params.id), TAGS.postList());
	return Response.redirect(new URL(`/posts/${ctx.params.id}`, ctx.url), 303);
});
```

`ctx.cache()` records the declaration; the middleware writes `Cache-Control` and `Cache-Tag`
onto the finished response. A `GET` that never calls it is marked `private, no-store`, unless
the response set its own `Cache-Control` or `Expires`: Workers Cache stores a header-less `200`
for two hours under a key that ignores cookies, so an undeclared signed-in page would otherwise
be replayed, stale, to every visitor of its URL.

## API

### `createTags(vocabulary: TagVocabulary): CacheTags<Vocabulary>`

Wraps each builder so it returns a validated, branded `CacheTag`. A builder throws
`CacheTagError` when its tag is empty, longer than `MAX_TAG_LENGTH`, outside printable ASCII,
or contains a space, a comma or a `"`.

### `cacheTag(tags: readonly CacheTag[]): string`

Serializes tags into a `Cache-Tag` value, keeping order and dropping repeats. Throws
`CacheTagError` for an empty list, an invalid tag, or a value longer than
`MAX_CACHE_TAG_HEADER_LENGTH`.

### `purge(cache: CacheInterface, options: PurgeOptions): Promise<Result<void, PurgeError>>`

Invalidates by tag (`{ tags }`), by URL prefix including the host (`{ prefixes }`), or entirely
(`{ everything: true }`). It fails without calling the platform for an empty list, a blank
prefix or an invalid tag, and fails when the platform rejects or declines the purge. Success
means the platform accepted it; propagation is eventually consistent.

### `cacheStatus(response: Response): CacheStatus`

Reads `cf-cache-status` as `"hit"`, `"miss"`, `"expired"` (`EXPIRED`, `STALE`, `REVALIDATED`,
`UPDATING`), `"bypass"` (`BYPASS`, `DYNAMIC`), or `"unknown"` for anything else or no header.

### `cacheHops(response: Response): CacheHop[]`

Reads the [RFC 9211](https://www.rfc-editor.org/rfc/rfc9211) `Cache-Status` field, one entry
per cache from the origin side to the client side, with `fwd-status` as `fwdStatus`. An absent
or invalid field reads as `[]`.

### `createRecordingCache(options?: RecordingCacheOptions): RecordingCache`

A `CacheInterface` for tests that records every selector in `purges` and every purged tag in
`purgedTags`. `failWith(error)` makes purges reject, `declineWith(issues)` makes them resolve
as declined, and `reset()` clears both and the record; the options arm the same up front.

### `cache(options: WorkersCacheMiddlewareOptions): Middleware`

Default export of `@sdxc/workers-cache/middleware`. `options.cache` is a `CacheInterface` or a
`(context) => CacheInterface` resolver. It publishes `context.cache`:

- `context.cache(policy, ...tags)` or `context.cache({ policy, tags })`: declares the response's
  caching. Tags accumulate across calls in one request; the last policy wins.
- `context.cache.purge(...tags)`: purges now and answers the `Result`, so a redirect after it
  reads fresh content.
- `context.cache.purgeLater(...tags)`: purges after the response is produced; a failure is
  logged as `cache.purge_failed`.

After the handler returns, a declaration is written only for a `GET` or `HEAD` with a status in
`CACHEABLE_STATUS_CODES`. Such a response with no declaration, and no `Cache-Control` or
`Expires` of its own, gets `NON_CACHEABLE_POLICY`. When the response carries `Set-Cookie`, or
the policy is `public` and the request has a session (or, with no session middleware, any
cookie), the response is downgraded to `NON_CACHEABLE_POLICY` with no tags and a
`cache.downgraded` warning. In
development (`NODE_ENV`, or a request to a local host) it throws `UnsafeCachePolicyError`
instead.

### Constants

`CACHE_TAG_HEADER`, `CACHE_CONTROL_HEADER` and `CACHE_STATUS_HEADER` (`cf-cache-status`) name
the headers. `MAX_TAG_LENGTH` is 1024 and `MAX_CACHE_TAG_HEADER_LENGTH` is 16384.
`NON_CACHEABLE_POLICY` is `private, no-store`. `CACHEABLE_METHODS` and `CACHEABLE_STATUS_CODES`
are the sets the middleware checks.

### Errors

- `CacheTagError`: an invalid tag or tag list; `tag` holds the rejected value.
- `PurgeError`: a purge that did not take effect; `selector` names what stayed cached and
  `cause` holds the platform's error or issues.
- `UnsafeCachePolicyError` (from `./middleware`): a refused declaration in development, with
  `reason` (`CacheRefusalReason`: `"set-cookie" | "session-with-public-policy"`) and `policy`.

### Types

```typescript
type CacheTag = string & { readonly [CACHE_TAG_BRAND]: true };
type CachePolicy = string;
type CacheStatus = "hit" | "miss" | "expired" | "bypass" | "unknown";
type PurgeOptions = PurgeByTags | PurgeByPrefixes | PurgeEverything;

interface CacheInterface {
	purge(selector: PurgeSelector): Promise<PurgeOutcome>;
}

interface PurgeSelector {
	tags?: string[];
	pathPrefixes?: string[];
	purgeEverything?: boolean;
}

interface PurgeOutcome {
	success: boolean;
	errors: readonly PurgeIssue[]; // { code: number; message: string }
}

interface CacheHop {
	cache: string;
	hit?: boolean;
	fwd?: CacheForwardReason; // "bypass" | "method" | "uri-miss" | "vary-miss" | "miss" | ...
	fwdStatus?: number;
	ttl?: number;
	stored?: boolean;
	collapsed?: boolean;
	key?: string;
	detail?: string;
}
```

`PurgeByTags`, `PurgeByPrefixes` and `PurgeEverything` are the `PurgeOptions` members;
`TagVocabulary` and `CacheTags` type `createTags`; `RecordingCache` and `RecordingCacheOptions`
type the double. `./middleware` also exports `CacheDeclaration`, `CacheDeclarationOptions` and
`WorkersCacheMiddlewareOptions`.

## Pattern: Named Policies In One Module

The middleware takes no default policy, so keep shared lifetimes as named strings. Any builder
works; this one is from [`@sdxc/http`](https://www.npmjs.com/package/@sdxc/http):

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
router.get("/posts/:id", async (ctx) => {
	let post = await findPost(ctx.params.id);
	ctx.cache(PUBLIC_PAGE, TAGS.post(post.id), TAGS.postList());
	return Response.json(post);
});

router.get("/posts", async (ctx) => {
	ctx.cache({ policy: SHORT_LIVED, tags: [TAGS.postList()] });
	return Response.json(await listPosts());
});
```

## Pattern: A Group Tag From A Middleware

A middleware shared by a group of routes adds a tag to every response in it, so one purge clears
the whole group. Tags accumulate, so each handler's own tags join it.

```typescript
import { createTags, purge } from "@sdxc/workers-cache";
import type { Middleware } from "remix/router";

let TAGS = createTags({
	docs: () => "docs",
	docsPage: (slug: string) => `docs:${slug}`,
});

let docsTag: Middleware = (ctx, next) => {
	ctx.cache(PUBLIC_PAGE, TAGS.docs());
	return next();
};

router.get("/docs", {
	middleware: [docsTag],
	handler: async () => Response.json(await listDocs()),
});

router.get("/docs/:slug", {
	middleware: [docsTag],
	async handler(ctx) {
		ctx.cache(PUBLIC_PAGE, TAGS.docsPage(ctx.params.slug));
		return Response.json(await findDoc(ctx.params.slug));
	},
});
// GET /docs/intro -> Cache-Tag: docs,docs:intro

await purge(env.CACHE, { tags: [TAGS.docs()] }); // clears every docs page
```

## Pattern: Purge Now Or After The Response

Await `purge` when the next request reads what changed; queue `purgeLater` for pages nobody is
about to load.

```typescript
import { isFailure } from "@sdxc/result";

router.post("/posts/:id", async (ctx) => {
	let post = await updatePost(ctx.params.id, await ctx.request.formData());

	let purged = await ctx.cache.purge(TAGS.post(post.id));
	if (isFailure(purged))
		return new Response("Saved, but the page is still cached", { status: 503 });

	ctx.cache.purgeLater(TAGS.postList(), TAGS.postsByAuthor(post.author));
	return Response.redirect(new URL(`/posts/${post.id}`, ctx.url), 303);
});
```

## Pattern: Purge Outside A Request

`purge` takes the cache as an argument, so a job, a cron handler or a deploy script uses it
directly, and a `PurgeError` tells you what stayed stale.

```typescript
import { isFailure } from "@sdxc/result";
import { purge } from "@sdxc/workers-cache";
import type { CacheInterface } from "@sdxc/workers-cache";

export async function purgeBlog(cache: CacheInterface) {
	let result = await purge(cache, { prefixes: ["example.com/blog/"] });
	if (isFailure(result)) {
		// selector: { pathPrefixes: ["example.com/blog/"] }; cause: the platform's error or issues
		throw new Error(result.error.message, { cause: result.error });
	}
}

export async function purgeAll(cache: CacheInterface) {
	return purge(cache, { everything: true }); // incident recovery
}
```

## Pattern: Checking Cache Behavior In A Smoke Test

`cacheStatus` reads Cloudflare's verdict and `cacheHops` reads every standards-speaking cache on
the way.

```typescript
import { cacheHops, cacheStatus } from "@sdxc/workers-cache";

let first = await fetch("https://example.com/posts/1");
let second = await fetch("https://example.com/posts/1");

cacheStatus(second); // "hit"

// Cache-Status: OriginCache; hit; ttl=1100, "CDN Company Here"; fwd=uri-miss; stored
cacheHops(first);
// [{ cache: "OriginCache", hit: true, ttl: 1100 },
//  { cache: "CDN Company Here", fwd: "uri-miss", stored: true }]
```

## Pattern: Testing A Cached Route

Pass a recording cache to the middleware and assert on headers and purges, with no binding.

```typescript
import { isFailure } from "@sdxc/result";
import { createRecordingCache, createTags, purge } from "@sdxc/workers-cache";
import cache from "@sdxc/workers-cache/middleware";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

let TAGS = createTags({ post: (id: string) => `post:${id}`, postList: () => "posts" });
let recording = createRecordingCache();
let router = createRouter({ middleware: [cache({ cache: recording })] });

router.get("/posts/:id", (ctx) => {
	ctx.cache("public, max-age=60", TAGS.post(ctx.params.id), TAGS.postList());
	return new Response("ok");
});

router.post("/posts/:id", async (ctx) => {
	await ctx.cache.purge(TAGS.post(ctx.params.id));
	return new Response(null, { status: 204 });
});

test("tags the page and purges on write", async () => {
	let page = await router.fetch(new Request("https://example.com/posts/1"));
	expect(page.headers.get("Cache-Tag")).toBe("post:1,posts");

	await router.fetch(new Request("https://example.com/posts/1", { method: "POST" }));
	expect(recording.purgedTags).toEqual(["post:1"]);
});

test("refuses a public policy for a visitor with a cookie", async () => {
	let request = new Request("https://example.com/posts/1", { headers: { Cookie: "session=1" } });
	let page = await router.fetch(request);
	expect(page.headers.get("Cache-Control")).toBe("private, no-store");
	expect(page.headers.has("Cache-Tag")).toBe(false);
});

test("reports a declined purge", async () => {
	recording.reset();
	recording.declineWith([{ code: 1122, message: "rate limited" }]);
	expect(isFailure(await purge(recording, { tags: [TAGS.postList()] }))).toBe(true);
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
