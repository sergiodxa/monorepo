# Agent Guidelines

reader is a Cloudflare Worker serving an RSS and Atom feed reader. A person signs in
through the OpenID Connect provider, follows feeds, and works through the unread items
those feeds produce.

Each reader's settings, feeds and posts live in a Durable Object of their own, addressed
by their OIDC subject. That is what makes the reading queue one indexed query over one
person's rows rather than a merge across feeds, and what puts the refresh schedule beside
the data it refreshes.

## Rules

Rules follow RFC 2119: "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in uppercase
indicate requirement levels.

- MUST keep the Cloudflare Worker bootstrap in `bootstrap/worker.ts` and the router
  assembly in `bootstrap/app.tsx`. Two other places reach for a Cloudflare API and no
  more: `database/user-do.ts`, which is a Durable Object and so is one by definition, and
  the `app/auth/` clients, which read their credentials off the environment.
- MUST reach a reader's data through `userStore(subject)` and the RPC methods of
  `database/user-do.ts`. Three things never cross that boundary: a `Result`, whose error
  subclass the platform drops so an `instanceof` is always false on the far side; a
  `Date`, for the reason every stored timestamp is an integer; and a thrown failure where
  a discriminated union would let the caller tell one refusal from another.
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
- Storage
  - `database/user-do.ts` <- The per-reader Durable Object and the RPC surface it answers
  - `database/refresh.ts` <- Retrieving feeds and folding what came back into a reader's posts
  - `database/schema.ts` <- The tables, mirroring `database/migrations/` exactly
- Rendering
  - `resources/layouts/document.tsx` <- The html/head/body shell every page composes into
  - `resources/layouts/app.tsx` <- The chrome every signed-in page wears
  - `resources/views/timeline.tsx` <- The post list both reading surfaces render
  - `resources/views/feed-list.tsx` <- The feed list and the form that follows another
