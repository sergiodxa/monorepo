# ADR-153: One Router Serves Pages and the API

## Status

**Accepted** - 2026-10-15

## Background

The `app` template `sdxc create` writes (ADR-142) had a single contract, `routes/web.ts`, holding
the home page and the MCP endpoint, and one router whose global chain parsed forms, checked
cross-origin requests and resolved the document's assets on every request, the MCP endpoint
included. A first draft split the API into its own contract, its own router initializer and a
dispatch in `bootstrap/worker.ts`. The correction: the API contract is mapped on the same router,
and the router's own middleware must be what pages and endpoints both use.

## Decision

- **Two contracts, one router.** `routes/web.ts` holds the pages and `routes/api.ts` the
  endpoints machine clients call (`/api/*` and `POST /mcp`). `createWebRouter` maps both, and
  `bootstrap/worker.ts` forwards every request to it.
- **The router's chain is what every route uses:** `asyncContext()`, `log(logger)` and a rate
  limit per client address (`@sdxc/rate-limit` on a Cloudflare rate limiter binding, keyed with
  `@sdxc/get-client-ip`, answering `429` as an `@sdxc/problem` document).
- **Each contract's chain is a shared `createMiddleware(...)` tuple its controllers declare** as
  `middleware`: `app/http/middleware/page.ts` (`formData()`, `cop()`,
  `securityHeaders(SECURITY_POLICY)`, `assets(...)`, `render(...)`) and
  `app/http/middleware/api.ts` (`cors()`). Controller middleware keeps the
  context each one publishes typed in the handler, which `lazy()`'s guard argument does not.
- **Pages carry the security headers.** `config/security-policy.ts` declares an
  `@sdxc/security-headers` policy whose Content-Security-Policy admits the app's own origin,
  inline `<style>` for `css()`, and the response's nonce, which `assets()` reads into
  `ctx.assets.nonce` for the document's inline import map.
- **Each contract owns its 404** as a catch-all route: `notFound: "/*path"` renders the 404 page,
  and `api.notFound: "/api/*path"` answers `application/problem+json`. The more specific pattern
  wins, so the router needs no default handler.
- **One problem catalog.** `config/problems.ts` default-exports `defineProblems(...)`, with its
  base URL taken from `PROBLEMS_URL` in `config/constants.ts`. Code imports it as `problems` and
  answers `problems.notFound()`, `problems.tooManyRequests()` or `problems.validationError(...)`,
  and the OpenAPI document publishes every entry.
- **The API documents itself.** `routes/api.ts` exports an `@sdxc/openapi` operation beside each
  documented route, `app/initializers/openapi.ts` assembles the document for the origin a request
  reached, and `GET /api/openapi.json` serves it.
- **`sdxc make controller` follows the contract** (ADR-143): `--routes api` writes from
  `controller.api.stub`, a JSON endpoint declaring the API chain, and maps it on the router that
  imports the contract.

## Consequences

- An API request skips the form parser, the cross-origin check, the security headers and the
  asset lookups, and a page request skips CORS. JSON and MCP responses carry no CSP, which
  governs only documents a browser renders.
- A page controller names its chain (`middleware: page`); one that forgets it fails to type
  check, since `ctx.render` and `ctx.assets` come from that chain.
- The rate limit's budget is written twice, in the binding in `cloudflare.config.ts` and in the
  adapter, because a module `cloudflare.config.ts` imports cannot also load in the Worker under
  `vite dev`.
