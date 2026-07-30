# ADR-022: HTTP Cache Policies And Conditional Responses

## Status

**Accepted** - 2026-07-29

## Background

Cache headers are currently produced by a third-party string builder imported directly into route modules across three applications. The dependency does one thing, serialize a `Cache-Control` value, and everything around it (choosing a policy, deriving validators, answering conditional requests) is either duplicated or missing.

Remix v3 already ships typed header classes for `Cache-Control`, `If-None-Match`, `If-Match`, and `Vary`. What is missing is the layer above them: named policies, validator generation, and the code that turns a conditional request into a `304`.

Cloudflare is also shipping Workers Cache, a regionally tiered cache placed in front of Worker entrypoints and driven by the response headers the Worker itself returns. That does not change what belongs in this package, but it changes what this package is worth: `Cache-Control` stops being advice aimed at browsers and shared proxies and becomes the mechanism that decides whether a request reaches the Worker at all.

## Context

### Current State

| Location                                      | Usage                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `apps/blog` index, articles, tutorials routes | `pretty-cache-header` for page cache headers                                                      |
| `apps/blog` and `apps/auth` locale API routes | `pretty-cache-header` for translation payloads                                                    |
| `apps/uptime` locale API route                | Same                                                                                              |
| `packages/http`                               | `content-type`, `negotiate`, `request`, `response`, `status-code` subpaths; nothing about caching |
| `packages/kv-cache`                           | A read-through data cache over Workers KV; unrelated to response caching                          |

### What Remix v3 Already Provides

| Capability                                   | Source                              |
| -------------------------------------------- | ----------------------------------- |
| Parse, modify, stringify `Cache-Control`     | `CacheControl` from `remix/headers` |
| Parse `If-None-Match`, precondition matching | `IfNoneMatch` from `remix/headers`  |
| Parse `If-Match`, strong comparison          | `IfMatch` from `remix/headers`      |
| Compose `Vary`                               | `Vary` from `remix/headers`         |

### Why Workers Cache Raises The Stakes

Workers Cache reads the response's own `Cache-Control` to decide freshness, including `stale-while-revalidate`, and keys entries partly on `Vary` values. A response marked `public, max-age=300` is served from an edge cache without invoking the Worker; a response marked `private` is not cached at all. Both outcomes come from the header this package produces.

The platform's own surfaces (the `Cache-Tag` header, tag-based purging, custom cache keys) are vendor extensions rather than HTTP, and live in a separate package. See [ADR-031](./ADR-031-workers-cache-tags-and-purging-package.md).

### Issues Identified

| Issue                                                     | Impact                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A dependency duplicates what `remix/headers` already does | An avoidable dependency in six route modules                                   |
| Policy decisions are inline per route                     | Two routes serving the same kind of content can disagree                       |
| No `ETag` generation anywhere                             | Every response ships a full body even when the client already has it           |
| No `Last-Modified` or `If-Modified-Since` handling        | `remix/headers` does not cover these, and no app implements them               |
| No `304` construction                                     | Conditional requests are never honored                                         |
| Nothing states the cost model of `Vary`                   | An over-broad `Vary` degrades edge cache hit rate rather than just correctness |

## Decision

Add a `cache` subpath to `@pkg/http` that composes `remix/headers` rather than reimplementing it, and that owns cache policies, validators, and conditional responses.

The scope is what a specification defines: `Cache-Control`, `ETag`, `If-None-Match`, `If-Modified-Since`, `Vary`, and the `304` and `412` responses. Vendor cache extensions and runtime purge APIs live in `@pkg/workers-cache` (ADR-031).

### 1. Policies

```ts
import { policy } from "@pkg/http/cache";

let headers = new Headers({
	"Cache-Control": policy({
		visibility: "public",
		maxAge: "1 hour",
		sMaxAge: "1 day",
		staleWhileRevalidate: "1 week",
		staleIfError: "1 week",
	}),
});
```

`policy()` returns a `CacheControl` instance from `remix/headers`, so it composes with anything already accepting that type. Durations accept `@pkg/duration` values (ADR-027) instead of bare seconds, which is where the current call sites are least readable.

A few named policies cover the recurring cases without naming any product concept:

```ts
Policies.noStore();
Policies.private({ maxAge: "5 minutes" });
Policies.immutable(); // fingerprinted assets: public, max-age 1 year, immutable
Policies.revalidate(); // no-cache with validators, for authenticated HTML
```

With an edge cache reading these values, they are not merely advisory. `Policies.private()` and `Policies.revalidate()` keep a response out of that cache; a `public` policy puts it in. Because the failure mode of a wrong choice is serving one user's page to another, the named policies exist so the safe answer is the short one to write, and `visibility: "public"` is always spelled out explicitly rather than defaulted.

### 2. Validators

```ts
await etag(body); // strong ETag, SHA-256 over the bytes, base64url, quoted
await etag(body, { weak: true }); // W/"..." for HTML rendered per request
lastModified(date); // HTTP-date string
```

`etag()` uses WebCrypto through `@pkg/crypto` (ADR-023) so there is one hashing implementation in the monorepo.

### 3. Conditional Responses

```ts
import { conditional } from "@pkg/http/cache";

let response = await conditional(request, html(body, { headers }));
```

`conditional()` evaluates `If-None-Match` (weak comparison, via `remix/headers`) and `If-Modified-Since` against the response's validators, and when the client's copy is current, returns a `304` that drops the body and keeps only the headers the specification allows: `Cache-Control`, `Content-Location`, `Date`, `ETag`, `Expires`, and `Vary`. `If-Modified-Since` parsing and comparison live in this package because `remix/headers` does not expose that header.

Conditional handling stays worthwhile with an edge cache in front. The cache decides whether the Worker runs; validators decide whether a body crosses the network to the client, which is a separate saving and the only one that helps a client revalidating an expired copy of a page the cache is also revalidating.

For `GET` and `HEAD` only; other methods pass through untouched. `If-Match` preconditions for writes are exposed separately as `precondition(request, { etag })` returning a `Result` so a failed precondition becomes a `412` at the caller's discretion.

### 4. Vary

```ts
vary(headers, ["Accept-Language", "Cookie"]);
```

A merge helper over the `Vary` class, because content negotiation in `@pkg/http/negotiate` and the locale routes both need to add to an existing value rather than replace it.

`Vary` is standard HTTP, but its cost is worth stating where the helper lives: shared caches key on the listed headers, so each varied header multiplies the number of stored variants, and varying on `Cookie` effectively disables caching for any request that carries one. The helper's documentation says so, and `Policies.private()` is the correct answer for responses that genuinely differ per user.

## Consequences

### Positive

- **A dependency disappears** - six route modules stop importing a string builder for something the framework already models.
- **Policies become a caching mechanism, not a hint** - the same builder that documents intent now determines whether a request reaches the Worker.
- **Conditional requests start working** - repeat visits to blog pages, status pages, and locale payloads can answer `304`.
- **Policies are named and reviewable** - a caching change happens in one place rather than per route.
- **One hashing implementation** - validators use the same crypto package as everything else.
- **Composes with the framework** - returning `CacheControl` keeps the package additive rather than parallel.
- **The package stays portable** - nothing here depends on a specific CDN, so the same policies are correct on any runtime.

### Negative

- **A wrong policy is now a data-exposure bug, not a performance one** - marking authenticated HTML `public` previously produced a bad browser cache entry; with an edge cache in front it can serve one user's page to another. Review of any new `public` policy has to be treated accordingly.
- **Wrong validators cause stale content** - an `ETag` that does not change when content changes is worse than no `ETag`.
- **Hashing costs CPU per response** - acceptable for HTML and JSON payloads, not something to apply blindly to large bodies.
- **`Vary` mistakes are now expensive** - an over-broad `Vary` degrades hit rate silently instead of only affecting correctness.

### Neutral

- **No middleware in this ADR** - an automatic ETag middleware is even less compelling now that an edge cache absorbs most repeat requests; the primitives come first.
- **Tags and purging live in a sibling package** - a route that caches and tags a response imports from two packages to build one `Headers` object, which is the accepted cost of keeping the specification layer vendor-free.
- **`@pkg/kv-cache` remains separate** - it is a read-through data cache over Workers KV. Response caching keyed by request is a different concern.
- **Existing headers keep working** - policies produce the same header values the current call sites produce, so behavior only changes where new policies or `conditional()` are adopted.

## Implementation Plan

### Phase 1: Policies

**Priority:** High
**Estimated Effort:** 2 hours

1. Implement `policy()` and the named policies over `CacheControl`.
2. Replace `pretty-cache-header` in the six route modules and drop the dependency.

### Phase 2: Validators And Conditional

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Implement `etag()`, `lastModified()`, `If-Modified-Since` parsing.
2. Implement `conditional()` with the allowed-header list, and `precondition()`.

### Phase 3: Adoption

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Adopt `conditional()` on the locale payload routes first (stable content, obvious win).
2. Adopt on public blog and status pages where a content-derived validator exists.
3. Audit every `public` policy for authenticated content before any app enables edge caching.
4. Update the `@pkg/http` README with the new subpath.

## Alternatives Considered

### 1. A Separate `@pkg/cache-control` Package

Ship caching as its own package.

**Rejected because**: `@pkg/http` already owns content negotiation, status codes, and response constructors; standard HTTP caching is the same concern and belongs behind a subpath, not a second package.

### 2. Reimplement `Cache-Control` Parsing

Own the whole header layer, ignoring `remix/headers`.

**Rejected because**: the framework's classes already parse and stringify correctly, and duplicating them would violate the rule to prefer what Remix v3 provides.

### 3. Include Cloudflare Cache Tags And Purging

Keep `Cache-Tag` serialization and the purge wrapper here, since they are emitted alongside `Cache-Control` on the same response.

**Rejected because**: `Cache-Tag` is a vendor header with no specification (other CDNs call the equivalent `Surrogate-Key` or `Edge-Cache-Tag`), and purging is a runtime API call rather than a header concern. Including them would make an HTTP package platform-specific and would mean an app on any other runtime imports Cloudflare vocabulary to set a `max-age`. They live in `@pkg/workers-cache` instead (ADR-031).

### 4. Rely On Edge Caching Alone

Skip validators and `304` handling, since an edge cache absorbs repeat traffic.

**Rejected because**: the edge cache decides whether the Worker runs, not whether a body crosses the network to the client. A client revalidating an expired copy still receives a full response without validators, and `stale-while-revalidate` serves bodies too.

### 5. Automatic ETags In A Middleware

Hash every response body in middleware and answer `304` transparently.

**Rejected as the starting point**: it hashes bodies that will never be revalidated and hides the decision from route authors. It stays available as a follow-up for a specific route group once the primitives exist.

## References

- [RFC 9111 - HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111)
- [RFC 9110 - HTTP Semantics, Conditional Requests](https://datatracker.ietf.org/doc/html/rfc9110#section-13)
- [ADR-031: Workers Cache Tags And Purging Package](./ADR-031-workers-cache-tags-and-purging-package.md)
- [ADR-023: Web Crypto Primitives Package](./ADR-023-web-crypto-primitives-package.md)
- [ADR-027: Duration Package](./ADR-027-duration-package.md)

## Current Progress

- [ ] Phase 1: Policies
- [x] Phase 2: Validators And Conditional
- [ ] Phase 3: Adoption

## Notes

- Authenticated HTML must never get a `public` policy. Cloudflare bypasses caching for requests carrying `Authorization` and for responses marked `private`, but session-cookie authentication triggers neither bypass automatically, so the policy is the only protection.
- A `304` must repeat `Vary`, otherwise a shared cache can serve a negotiated variant to the wrong client.
- Weak `ETags` are correct for server-rendered HTML that varies in insignificant ways between renders; strong `ETags` are for byte-stable payloads such as compiled locale files.
- The two packages have no dependency in either direction, which is the check that the split is real: policies do not need tags to be correct, and tags do not need policies to serialize.
