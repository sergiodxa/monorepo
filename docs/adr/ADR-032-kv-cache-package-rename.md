# ADR-032: KV Cache Package Rename

## Status

**Implemented** - 2026-07-29

## Background

Response caching arrived as two new decisions: HTTP cache policies and conditional responses behind `@pkg/http/cache` ([ADR-022](./ADR-022-http-cache-policies-and-conditional-responses.md)), and Cloudflare cache tags and purging in `@pkg/workers-cache` ([ADR-031](./ADR-031-workers-cache-tags-and-purging-package.md)).

That left three things a developer could reasonably call "the cache package", one of which was named exactly that while doing something different from the other two.

## Context

| Package              | Caches                                             |
| -------------------- | -------------------------------------------------- |
| `@pkg/cache`         | Application data, keyed by string, stored in KV    |
| `@pkg/http/cache`    | HTTP responses, through headers and validators     |
| `@pkg/workers-cache` | HTTP responses at the edge, through tags and purge |

`@pkg/cache` is a read-through store: it reads a key, and on a miss it computes a value, writes it with a TTL, and returns it. Nothing about it concerns HTTP.

## Decision

Rename `@pkg/cache` to `@pkg/kv-cache`, so each package name says what it caches and where.

The directory moves to `packages/kv-cache`, and the one importer (`apps/blog`) plus the cross-reference in the sitemap package README follow. The public API is unchanged: `Cache.Store`, `Cache.KVStore`, and their methods keep their names, since the namespace already reads correctly as `Cache.KVStore` inside a package called `kv-cache`.

The root README description also becomes concrete, "Read-through cache store over Cloudflare KV" in place of "Cache helper utilities", per [ADR-017](./ADR-017-readme-package-description-source-of-truth.md).

## Consequences

### Positive

- **Each cache name is unambiguous** - the storage layer, the HTTP layer, and the edge layer are distinguishable at the import line.
- **The name survives more caching packages** - a future store over another backend is named for that backend rather than competing for the generic name.

### Negative

- **Earlier ADRs refer to the old name** - [ADR-001](./ADR-001-new-package-extraction.md), `docs/adr/blog/ADR-001`, and the r3-uptime port ADR describe the package as `@pkg/cache`, which is what it was called when those decisions were made.

### Neutral

- **A single importer** - the rename touched `apps/blog` and nothing else.
- **No API change** - no call site changed beyond its import specifier.

## Notes

- Historical ADRs keep the name they were written with, since they record what was decided at the time. This ADR is the pointer from the old name to the new one.
- `Cache` as an exported namespace is still accurate: the package exports the abstract `Store` alongside the `KVStore` implementation, so a second backend can join it without another rename.
