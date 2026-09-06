# Agent Guidelines

reader is a Cloudflare Worker serving an RSS and Atom feed reader. A person signs in
through the OpenID Connect provider, follows feeds, and works through the unread items
those feeds produce.

## Rules

Rules follow RFC 2119: "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in uppercase
indicate requirement levels.

- MUST keep the Cloudflare Worker bootstrap in `bootstrap/worker.ts` and the router
  assembly in `bootstrap/app.tsx`; no other module may touch a Cloudflare-specific API.
- MUST map every route through `lazy(() => import(...))` from `@sdxc/lazy-route`, so the
  URL surface is complete at startup while a cold isolate evaluates only the controller
  the request reached.
- MUST declare every URL in `routes/web.ts` and build links with the typed `href()`; a
  string literal resolves against the wrong base inside a mounted layout.
- MUST use `remix/router` helpers (`createAction`, `createController`) for controllers and
  `ctx.render` for views.
- MUST read the request context from the controller's own `ctx` argument, and reach for
  `getContext` from `remix/middleware/async-context` only outside a controller.
- MUST take every user-facing string from `ctx.i18next.t(...)`, with the key defined in
  both `app/locales/en.ts` and `app/locales/es.ts`; a missing key renders as the key
  itself, so the two files stay the same shape.
- MUST guard every per-person route with `requireUser`, which redirects an anonymous
  visitor home with a `returnTo` cookie so sign-in returns them where they started.
- MUST build markup from `@sdxc/ui` components styled with `@sdxc/u` mixins through `mix`.
- MUST let `worker-configuration.d.ts` be the only declaration of a binding's type; run
  `bun run cf:typegen` after every change to `wrangler.jsonc`.

- SHOULD keep controllers small, folding a one-off view straight into `ctx.render()` and
  giving `resources/` a file only for markup that is reused or hydrated.
- SHOULD narrow an unknown value with a type guard or a `remix/data-schema` shape.

- MUST NOT use `as any`, in any file.
- MUST NOT hand-write a type for a Cloudflare binding.

## Reference Files

- Bootstrap
  - `bootstrap/worker.ts` <- Worker entry point, the only place Cloudflare APIs are used
  - `bootstrap/app.tsx` <- Global middleware chain and route-to-controller mapping
- Configuration
  - `routes/web.ts` <- Registry of every URL the app serves
  - `config/router-context.d.ts` <- `RequestContext` values the global middleware installs
- HTTP Layer
  - `app/http/controllers/auth.tsx` <- OIDC authorization redirect and callback
  - `app/http/controllers/default-handler.tsx` <- 404 handler for unmapped routes
  - `app/http/middleware/require-user.ts` <- Guard for the signed-in surface
- Rendering
  - `resources/layouts/document.tsx` <- The html/head/body shell every page composes into
