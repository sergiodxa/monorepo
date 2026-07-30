# ADR-031: Workers Cache Tags And Purging Package

## Status

**Proposed** - 2026-07-29

## Background

Cloudflare's Workers Cache places a regionally tiered cache in front of Worker entrypoints, driven by the response headers the Worker returns. Freshness comes from `Cache-Control`, which is standard HTTP and belongs to `@pkg/http/cache` ([ADR-022](./ADR-022-http-cache-policies-and-conditional-responses.md)).

Invalidation does not. Tagging a response uses a `Cache-Tag` header that no specification defines, and clearing entries means calling a purge method on the platform's cache interface. An earlier draft of ADR-022 put both in the HTTP package, which would have made a specification-shaped package platform-specific.

## Context

### Standard Versus Vendor

| Surface                                                        | Defined by                  |
| -------------------------------------------------------------- | --------------------------- |
| `Cache-Control`, `ETag`, `If-None-Match`, `Vary`, `304`, `412` | RFC 9110, RFC 9111          |
| `Cache-Tag`                                                    | Cloudflare only             |
| Purge by tag, prefix, or everything                            | Cloudflare runtime API      |
| Custom cache keys on entrypoint calls                          | Cloudflare `cf` options     |
| Cache status reporting                                         | Cloudflare response headers |

Equivalent tagging exists elsewhere under other names, `Surrogate-Key` on Fastly and `Edge-Cache-Tag` on Akamai, which is itself the evidence that the concept is a vendor extension rather than an HTTP feature.

### Current State

No application uses cache tags, because nothing has used Workers Cache yet. The relevant existing state is what invalidation looks like without it: content changes take effect when a cached response expires, so cache lifetimes are kept short to bound staleness. Tags replace that trade with explicit invalidation, which is what makes long lifetimes safe.

### Issues Identified

| Issue                                                        | Impact                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Tag names would be string literals in two places             | The response header and the later purge call, with no compile-time link      |
| A renamed or mistyped tag fails silently                     | The purge succeeds and invalidates nothing, so stale content persists        |
| Tag constraints are platform rules                           | Character set and length limits are enforced by the platform, not the caller |
| Purge is a fallible network operation                        | Treating it as fire-and-forget means silent staleness after a content write  |
| Without tags, cache lifetimes must stay short                | Hit rate is capped by the staleness the product can tolerate                 |
| The cache interface is a platform object                     | Every write path would thread it down from the entrypoint to reach `purge`   |
| Only one writer can set the `Cache-Tag` header               | A controller-scoped middleware and its handler overwrite each other's tags   |
| Nothing can enforce the authenticated-content rule centrally | `public` on a per-user response is caught by review or not at all            |

## Decision

Create `@pkg/workers-cache`: the Cloudflare-specific half of response caching, holding the tag vocabulary, the `Cache-Tag` header, purging, cache-status inspection, and a middleware that applies all of it.

The package has no dependency on `@pkg/http/cache` and that package has none on this one. They are used together at a call site and are correct independently, which is the test that the split is real rather than cosmetic.

### 1. Typed Tag Vocabularies

Tags are declared once per app, as functions rather than strings, so the header and the purge call cannot drift apart:

```ts
import { createTags } from "@pkg/workers-cache";

export const TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postsByType: (type: string) => `posts:${type}`,
	postList: () => "posts",
});
```

`createTags()` validates each produced tag against the platform's character set and length rules and returns branded `CacheTag` values, so an arbitrary string cannot be passed where a tag is expected. A tag that violates the rules fails at the call site instead of being dropped silently by the platform.

### 2. Functions For Contexts Without A Request

The middleware in section 4 is how request handlers use this package, but not every caller is a request. Queue consumers, scheduled handlers, and background jobs invalidate content too, and they have no request context to hang anything on. The standalone functions are the supported path for them, and stay part of the public API rather than being middleware internals:

```ts
import { cacheTag, purge } from "@pkg/workers-cache";

// Inside a job that rebuilt a post's derived content.
let result = await purge(cache, { tags: [TAGS.post(postId), TAGS.postList()] });
if (isFailure(result)) logger.error("cache.purge_failed", { error: result.error.message });
```

`purge()` takes the cache interface as its first argument rather than reaching for a global, so the package holds no runtime-specific import and can be tested with a recording double. It supports the three forms the platform offers, `tags`, a path prefix, and everything, and returns a `Result` because a failed purge means stale content is being served and the caller has to decide whether to retry or alert.

Purging everything is documented as an operational escape hatch, for incidents rather than content writes.

`cacheTag()` serializes a tag list into a header value, deduplicating and rejecting an empty list. A job that writes responses directly, or any code assembling headers by hand, uses it the same way:

```ts
let headers = new Headers({
	"Cache-Control": policy({ visibility: "public", maxAge: "1 day" }),
	"Cache-Tag": cacheTag([TAGS.post(post.id), TAGS.postList()]),
});
```

### 3. Cache Status

```ts
import { cacheStatus } from "@pkg/workers-cache";

cacheStatus(response); // "hit" | "miss" | "expired" | "bypass" | "unknown"
```

A typed read of the platform's cache status header. It exists for tests that assert a route is actually cacheable and for logging that answers whether a deploy changed hit rate, both of which are otherwise done by string-matching a header at each call site.

### 4. Middleware

Request handlers should declare how a response caches, not assemble headers for it, and should never receive a platform object in order to purge. A `remix/fetch-router` middleware owns both:

```ts
import cache from "@pkg/workers-cache/middleware";

let cacheMiddleware = cache({ cache: (ctx) => ctx.workers.cache });
```

```ts
declare module "remix/fetch-router" {
	interface RequestContext {
		/** Declares how this response caches, and purges cached entries by tag. */
		cache: CacheDeclaration;
	}
}
```

`ctx.cache` is callable and also carries `purge`, so one context key covers both operations and the invalidation call keeps the name the platform's own documentation uses:

```ts
// In a route handler: declare how this response caches, and what it is tagged with.
ctx.cache(PUBLIC_PAGE, TAGS.post(post.id), TAGS.postList());

// In an action, after writing: invalidate.
await ctx.cache.purge(TAGS.post(post.id), TAGS.postList());
```

The factory takes no policy. Its options configure plumbing only, which is what makes it safe to register once on a router rather than per action: a route that never calls `ctx.cache()` is untouched, so broad registration costs nothing and no route inherits a caching decision it did not make.

#### The Cache Interface Is Resolved Once

The middleware resolves the platform cache interface at registration, from a value or a per-request resolver, and closes over it. Nothing downstream passes it again: `ctx.cache.purge()` takes tags and only tags. That is the difference between the middleware path and the standalone `purge(cache, ...)` in section 2, and it is most of the ergonomic win, because the alternative is threading a platform object from the entrypoint through controllers into every action that writes content.

#### Headers Are Appended To The Finished Response

`ctx.cache()` records intent; it does not mutate anything itself. After `next()` resolves, the middleware appends `Cache-Control` and `Cache-Tag` to the response the handler produced. Appending after the fact rather than at declaration time is what makes the refusal checks below possible: the middleware sees the final response, including headers added by middleware that ran between the declaration and the response.

#### Tags Accumulate Through The Middleware Chain

Every `ctx.cache()` call in a request adds to one set, which the middleware serializes into a single `Cache-Tag` header. Declaration is a call rather than a returned value so that more than one participant can contribute:

- A router-scoped or controller-scoped middleware can add a tag that applies to every response in its group, such as a tenant tag that lets one purge invalidate all of a team's pages.
- A handler can call `ctx.cache()` more than once as it loads records, tagging each one it read.

This is not a layout mechanism. `remix/fetch-router` has no nested routes: middleware is scoped to routers, controllers, and actions, and a controller's middleware applies only to the direct route actions in that controller. So accumulation happens along a middleware chain and within a handler, never up a route tree, and the benefit is narrower than in a nested-route framework.

#### Every Declaration Carries Its Own Policy

The policy is the first argument of the declaration, followed by any number of tags:

```ts
ctx.cache(PUBLIC_PAGE, TAGS.post(post.id), TAGS.postList());
ctx.cache(SHORT_LIVED, TAGS.postList()); // a different policy, same controller
ctx.cache(PUBLIC_PAGE); // cacheable, untagged
ctx.cache({ policy: PUBLIC_PAGE, tags: [TAGS.post(id)] }); // object form, for future options
```

A policy is not a property of a route group. Two actions in one controller routinely want different lifetimes, an index and a detail page being the obvious pair, so a group-level default would either be wrong for half its routes or force the middleware to be registered per action just to vary a `max-age`. Keeping the policy in the declaration means the middleware is registered for capability and the lifetime is decided where the response is built.

Repetition across similar routes is handled where repetition belongs, in the app: a module of named policies built with `@pkg/http/cache` and imported by the controllers that share them.

```ts
export const PUBLIC_PAGE = policy({
	visibility: "public",
	maxAge: "1 day",
	staleWhileRevalidate: "1 week",
});
export const SHORT_LIVED = policy({ visibility: "public", maxAge: "5 minutes" });
```

Those constants are plain values, so jobs and hand-built responses reuse them too, which a middleware option could never do.

#### The Middleware Enforces Safe Caching

Before writing any header, the middleware inspects the finished response and applies these rules:

| Condition                                     | Behavior                                                           |
| --------------------------------------------- | ------------------------------------------------------------------ |
| Response carries `Set-Cookie`                 | Downgrade to a non-cacheable policy and log                        |
| Request carried a session, policy is `public` | Downgrade to a non-cacheable policy and log                        |
| Method is not `GET` or `HEAD`                 | Emit nothing                                                       |
| Status is not cacheable                       | Emit nothing                                                       |
| `ctx.cache()` was never called                | Emit nothing, leaving the response exactly as the handler built it |

Downgrades log at error level and throw in development, since a downgrade means a route asked for something unsafe. Enforcing this centrally is the middleware's main reason to exist: ADR-022 can only state the rule, while the middleware holds the finished response and can act on it.

#### Purge Is Awaited By Default

`ctx.cache.purge()` awaits the platform call and returns a `Result`. It is not deferred to after the response, because a write action usually redirects to the page it just invalidated, and a deferred purge races the follow-up request and serves the user their own stale content. Deferral is available explicitly, for invalidations whose freshness nobody is about to observe:

```ts
ctx.cache.purgeLater(TAGS.postList());
```

Deferred purges flush after the response, and failures are logged rather than thrown, matching how the mail middleware treats deferred sends.

### 5. Scope

The package produces and reads headers and calls the purge API. Enablement lives in each app's `wrangler.jsonc`, where it belongs alongside the infrastructure and billing decision it represents, and policy values come from `@pkg/http/cache`.

## Consequences

### Positive

- **The HTTP package stays specification-only** - an app on any other runtime can use `policy()` and `conditional()` without importing Cloudflare vocabulary.
- **Tag drift becomes a compile error** - one declaration feeds the header, the middleware, and the purge call.
- **The unsafe-caching rule is enforced, not reviewed** - `Set-Cookie` and session-bearing responses cannot be marked `public` by accident.
- **Purging needs no plumbing** - the middleware resolves the cache interface once, so `ctx.cache.purge()` takes tags alone and no platform object crosses the app.
- **One registration, many policies** - the factory configures plumbing only, so a router registers the middleware once and each action still chooses its own lifetime.
- **No inherited caching decision** - a route that does not declare gets no cache headers, so nothing caches by default.
- **Invalid tags fail loudly** - validation happens where the tag is built, not silently at the platform boundary.
- **Tags accumulate along the middleware chain** - a controller-scoped middleware and its handler both contribute to one header instead of overwriting each other.
- **Jobs are first-class** - the standalone functions cover queue consumers and scheduled handlers, which have no request context.
- **Long cache lifetimes become safe** - explicit invalidation replaces short expiry as the staleness bound, which is where the hit-rate gain actually comes from.
- **Purge failures are visible** - a `Result` forces the caller to decide, instead of a dropped promise leaving stale content in place.
- **Hit rate becomes observable** - the middleware can log `cacheStatus()` per request through the request logger.
- **Testable without the platform** - the cache interface is a parameter or a resolver, so a recording double covers purge behavior.

### Negative

- **Headers are applied at a distance** - a wrong `Cache-Control` is no longer explained by reading the handler alone. Mitigated by the middleware emitting nothing unless a handler called `ctx.cache()`, so there is always a visible declaration to find.
- **Ordering matters** - the middleware must run outside anything that adds `Set-Cookie` or rewrites the response, otherwise its refusal checks inspect a response that is not final.
- **Two ways to do one thing** - the middleware path and the standalone functions overlap, and the README has to be clear that request handlers use the former and jobs the latter.
- **Another small package** - the surface is a few hundred lines, and it exists because of a boundary rather than because of volume.
- **Two imports to cache one response** - the policy comes from the HTTP package and the declaration from this one.
- **Vendor lock is explicit** - anything importing this package is Cloudflare-specific by construction. That is the intent, but the boundary has to be respected for the isolation to be worth anything.
- **The platform surface is new and rolling out** - header names, purge shape, tag constraints, whether the cache interface arrives as a binding or on the execution context, and per-plan limits must be verified against current documentation before implementation.

### Neutral

- **Tag accumulation is a modest benefit here** - with no nested routes, it covers middleware chains and repeated handler calls rather than a route hierarchy.
- **A second implementation is possible later** - if another CDN is ever targeted, its equivalent lives in its own package with the same shape, and the HTTP layer is unaffected.
- **Tag vocabularies belong to apps** - the package provides typing and validation; each app declares the tags its own content model has.
- **Enablement stays in app configuration** - unchanged from ADR-022's boundary.

## Implementation Plan

### Phase 1: Verification

**Priority:** Medium
**Estimated Effort:** 1 hour

1. Confirm the current `Cache-Tag` header name and constraints, the purge API shape and supported forms, how the cache interface is exposed to a Worker, the cache status header, and per-plan limits against Cloudflare documentation.

### Phase 2: Tags And Functions

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Implement `createTags()` with branded tag values and validation.
2. Implement `cacheTag()` serialization with deduplication and empty-list rejection.
3. Implement `purge()` for tags, prefix, and everything, returning `Result`, plus `cacheStatus()`.
4. Provide a recording cache double for tests, aligned with the binding mocks package (ADR-024).

### Phase 3: Middleware

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Implement the middleware factory, the cache interface resolution, the `RequestContext` augmentation, and the callable `ctx.cache` with `purge` and `purgeLater`.
2. Implement tag accumulation and single-header serialization appended after `next()` resolves.
3. Implement the refusal table, including the development-mode throw, with a test per condition.

### Phase 4: Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Enable Workers Cache on one app, starting with public pages that have no authenticated variants.
2. Declare that app's tag vocabulary and register the middleware on its public controllers.
3. Wire purges into the content write paths, using `ctx.cache.purge()` in actions and `purge()` in jobs.
4. Raise cache lifetimes only after purging is verified end to end.
5. Write the package README and add it to the root README table (ADR-017).

## Alternatives Considered

### 1. Keep Tags In `@pkg/http/cache`

Ship tags and purging beside the policy builder, since they are emitted on the same response.

**Rejected because**: proximity at a call site is not a shared contract. `Cache-Tag` has no specification, purging is a runtime call, and including them would mean an app on any other runtime imports Cloudflare vocabulary to set a `max-age`.

### 2. Add It To `@pkg/cache`

Extend the existing cache package to cover response caching as well as its KV data cache.

**Rejected because**: that package is a read-through store keyed by string with a `Store` abstraction. Workers Cache stores responses keyed by request, and forcing it behind `read`, `write`, and `delete` would discard tags, `Vary` behavior, and header semantics, which are the whole point.

### 3. A Broad `@pkg/cloudflare` Package

One package for all platform helpers, with cache as a subpath.

**Rejected because**: a package scoped by vendor rather than by purpose invites every loose platform utility, which is the same reason the binding mocks package was scoped narrowly rather than named for testing in general (ADR-024).

### 4. Two Context Keys

Expose `ctx.cache(...tags)` and `ctx.purge(...tags)` as separate properties.

**Rejected because**: it spends two context keys on one concern, and `purge` is the name the platform already uses beneath a cache object, so `ctx.cache.purge()` is the shape a reader of Cloudflare's documentation expects. The two operations do have different lifecycles, which is a fair argument for splitting them, but not one worth a second top-level key.

### 5. A Default Policy On The Middleware Factory

Let the factory carry a policy for its route group, overridable per declaration.

**Rejected because**: it makes middleware registration the way to express a lifetime, so any two actions wanting different `max-age` values need separate registrations even though they need identical plumbing. It also makes the effective policy non-local: reading a handler no longer tells you how its response caches. Shared policies belong in an app-level module of named constants, which is more explicit and reusable outside a request.

### 6. Policy And Tags At Route Registration

Configure caching entirely where routes are declared, with no per-response declaration.

**Rejected because**: tags depend on the record a handler loaded, so they cannot be known at registration, and the policy has the same locality problem as the alternative above.

### 7. Middleware Only, No Standalone Functions

Expose caching exclusively through the request context.

**Rejected because**: queue consumers and scheduled handlers invalidate content and have no request context. Hiding `purge()` and `cacheTag()` behind the middleware would leave those callers reaching into package internals.

### 8. A Vendor-Neutral Tagging Abstraction

Define a generic tagging interface with a Cloudflare implementation behind it.

**Rejected because**: there is one CDN in use, and the abstraction would have to guess which differences between vendor tagging models matter. A second implementation, if it ever exists, is a better time to find the common shape than now.

## References

- [Cloudflare: Workers Cache](https://blog.cloudflare.com/workers-cache/)
- [ADR-022: HTTP Cache Policies And Conditional Responses](./ADR-022-http-cache-policies-and-conditional-responses.md)
- [ADR-018: Mail Package With Pluggable Transports](./ADR-018-mail-package-with-pluggable-transports.md)
- [ADR-024: Cloudflare Binding Mocks Package](./ADR-024-cloudflare-binding-mocks-package.md)

## Current Progress

- [ ] Phase 1: Verification
- [ ] Phase 2: Tags And Functions
- [ ] Phase 3: Middleware
- [ ] Phase 4: Adoption

## Notes

- Purge is eventually consistent. A content write path should log and retry a failed purge rather than treat it as a side effect, and should not assume a successful purge is immediately observable.
- Tags are cheap to add and expensive to retrofit: a response cached before a tag existed cannot be purged by that tag. Emit the tags a content model will need from the first cached response, not after the first stale-content incident.
- Every tag emitted is a commitment that some write path purges it. A tag nothing purges is worse than no tag, because it suggests coverage that does not exist.
- The middleware's refusal checks are only as good as its position in the chain. Registering it inside a middleware that later attaches a session cookie would let a `public` policy through, so its position needs a test, not just documentation.
- Because the factory carries no policy, the middleware can be registered broadly and still leaves every route uncached until it declares. A route group that should never cache needs no opt-out.
- A declaration with a policy and no tags is legitimate, but it produces a cached response that only expiry or a broad purge can clear. Prefer at least one tag on anything whose content can change.
- The package name says Workers rather than Cloudflare because it wraps one specific product surface; if other platform helpers are ever needed, they get their own purpose-scoped packages rather than joining this one.
