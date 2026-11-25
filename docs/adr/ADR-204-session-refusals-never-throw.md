# ADR-204: Session Refusals Downgrade Without Throwing in Development

## Status

**Accepted** - 2026-11-25

Amends the development-mode throw in
[ADR-031](./ADR-031-workers-cache-tags-and-purging-package.md).

## Background

`@sdxc/workers-cache` refuses a cache declaration in three cases: the response carries
`Set-Cookie`, or the request carries a session and the policy is `public`, or it carries a session
and a targeted field (`CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control`) lets a CDN store the
response. Production downgrades the response to `private, no-store` and logs `cache.downgraded`;
development threw `UnsafeCachePolicyError` for all three.

In the blog, every public page declares a public policy, and an author signed in to the CMS on
`localhost` carries a session cookie on every request. Each public page (`/`, `/apps`, the search
frame) therefore threw, and Vite's error overlay covered a page that had rendered correctly.

## Decision

Development throws only for `set-cookie`. The two session refusals downgrade and log the same way
in every mode.

| Refusal                               | Caused by   | Production      | Development     |
| ------------------------------------- | ----------- | --------------- | --------------- |
| `set-cookie`                          | The route   | Downgrade + log | Throw           |
| `session-with-public-policy`          | The visitor | Downgrade + log | Downgrade + log |
| `session-with-shared-targeted-policy` | The visitor | Downgrade + log | Downgrade + log |

A response carrying `Set-Cookie` is something the route itself built, so a throw points at code
to fix. A session is something the visitor brought: the same route is correct for an anonymous
visitor and is already made safe for a signed-in one by the downgrade. Throwing there reports a
request, not a bug, and the route has no way to avoid it short of reading the session to vary its
declaration, which every public route would then have to repeat.

## Consequences

- Production behavior is unchanged: the same responses are downgraded and the same
  `cache.downgraded` warning is recorded.
- A signed-in developer sees public pages locally, uncached, with the refusal on the log.
- A route that renders per-visitor content under a public policy is no longer stopped in
  development; the downgrade still keeps that content out of every shared cache.
- `UnsafeCachePolicyError` keeps all three `CacheRefusalReason` values in its type; in practice
  the middleware throws it with `"set-cookie"`.
