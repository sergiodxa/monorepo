# ADR-135: Undeclared Responses Are Marked Not Cacheable

## Status

**Accepted** - 2026-10-14

Supersedes the "`ctx.cache()` was never called" row of the refusal table in
[ADR-031](./ADR-031-workers-cache-tags-and-purging-package.md).

## Background

ADR-031 decided that a route which never calls `ctx.cache()` gets no cache headers, on the
premise that a response without `Cache-Control` is not cached. Workers Cache does the opposite:
it applies RFC 9111 heuristic freshness, so a `200` without `Cache-Control` or `Expires` is stored
for two hours (a `404` for three minutes), and its cache key is the path, ignoring `Cookie`.

In the blog this surfaced as a CMS edit page that kept showing the old content after a save. The
update action redirected to the edit page, and the edge answered with the copy it had stored on
the previous visit. The public post looked right because its own declared tag had been purged.
The same mechanism let any visitor of a CMS URL receive the stored, signed-in page without
passing the auth guard, and could replay a Markdown variant picked from `Accept` to HTML readers.

## Context

| Response                                         | Before                 | Platform behavior     |
| ------------------------------------------------ | ---------------------- | --------------------- |
| Declared `public` policy                         | Written                | Cached, purgeable     |
| Declared, but `Set-Cookie` or session + `public` | Downgraded to no-store | Not cached            |
| Not declared, handler set `Cache-Control`        | Left as built          | Cached per its header |
| Not declared, no freshness headers               | Left as built          | Cached for 2 hours    |

Only the last row is wrong, and nothing short of every route remembering to declare would fix
it at the call sites, which is the failure mode the middleware exists to make impossible.

## Decision

The middleware marks a `GET` or `HEAD` response with a status in `CACHEABLE_STATUS_CODES`, no
declaration, and no `Cache-Control` or `Expires` of its own as `NON_CACHEABLE_POLICY`
(`private, no-store`). It records nothing on the log and never throws, because an undeclared
route asked for nothing unsafe.

A response that set its own `Cache-Control` or `Expires` is still left exactly as built, so a
handler assembling a static document's headers by hand keeps its lifetime.

## Consequences

### Positive

- **Nothing caches by default, as ADR-031 intended** - the guarantee now holds on the platform
  that actually serves the responses.
- **Signed-in pages stay off the edge** - a CMS page can no longer be replayed to another visitor
  or to its own editor after a write.

### Negative

- **Undeclared public pages lose their accidental two-hour cache** - pages like `/colors` now run
  the Worker on every request until they declare a policy and a tag that some write purges.

### Neutral

- **Existing entries clear on deploy** - with `cross_version_cache` off, the deploy carrying this
  change starts from an empty cache.

## References

- [Workers Cache: responses with no `Cache-Control` header are still cached](https://developers.cloudflare.com/workers/cache/configuration/)
- [ADR-031: Workers Cache Tags And Purging Package](./ADR-031-workers-cache-tags-and-purging-package.md)
