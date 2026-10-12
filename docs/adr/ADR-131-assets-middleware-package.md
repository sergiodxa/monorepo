# ADR-131: Assets Middleware Package

## Status

**Accepted** - 2026-10-11

## Background

Eight apps (auth-saas, blog, books, demo, r3-auth, reader, sdxc, uptime) each carry
`app/initializers/assets.ts`, which builds an `@pitlane/assets` resolver over the build's manifest,
declares a `DocumentAssets` interface, and exports `documentAssets()` to look up the document
layout's stylesheets and the browser entry together. Each also carries `app/http/render.tsx`,
whose `renderWith()` wrapper calls `documentAssets()` on every `ctx.render` and wraps the page in
a `<DocumentAssets value>` context the document shell reads. Reader, uptime and auth-saas add the
CSP nonce from `@sdxc/security-headers` to that value.

## Context

- The lookups read a manifest already in memory, and a Worker may not start async work before
  its first request, so the lookup runs per request; where in the request it runs is free.
- The wrapper hides a dependency: a page renders a correct document only when `ctx.render` was
  replaced earlier in the chain, and nothing at the route says so.
- A context provider wrapping the page exists only to carry two values from the wrapper to the
  shell, a component the route already names.
- Publishing services onto the request context from middleware is the repo's rule (ADR-057), and
  `@sdxc/database-middleware` (ADR-130) set the shape: a factory, an exported context key with a
  written type, a typed context transform and a `RequestContext` augmentation.

## Decision

Add `@sdxc/assets-middleware`, exporting:

- `assets(resolver, { stylesheets, script, nonce? })`, typed
  `Middleware<{ key: typeof Assets; value: DocumentAssets; property: "assets" }>`. It awaits both
  lookups in parallel before calling `next()` and publishes the result as `ctx.assets`.
- `DocumentAssets` (`{ stylesheets: string[]; script: ScriptEntry; nonce?: string }`),
  `DocumentAssetsResolver`, `AssetsOptions`, and the `Assets` context key, annotated
  `{ defaultValue?: DocumentAssets }` so it has a nameable type in the published declaration file.

The resolver is typed structurally as the two methods the middleware calls. The app passes its
own `createAssetResolver(manifest)`; the manifest is a virtual module only the app's build
provides, so the package depends on `@pitlane/assets` for the `ScriptEntry` type alone.

The nonce is read through an optional `nonce(ctx)` callback, so an app with a CSP reads it from
whatever publishes it and the package carries no dependency on a CSP implementation.

Routes render `<Document assets={ctx.assets}>…</Document>`, or an app's own renderer reads
`ctx.assets`. The apps delete `app/http/render.tsx`'s wrapper and the context provider.

## Consequences

### Positive

- The document's inputs are visible at every route: the shell receives them as a prop.
- One implementation of the lookup and its type across eight apps.
- A test installs its own assets by passing a stub resolver to the same factory.

### Negative

- Every request the middleware runs for pays the two lookups, including requests that render no
  document; the lookups read memory, so the cost is small, and an app scopes the middleware to
  the routes that render HTML when it is not.
- Each route passes `ctx.assets` explicitly, a prop the wrapper used to supply.

## Alternatives Considered

- **Keep the `renderWith()` wrapper.** It keeps the dependency between the chain and the shell
  implicit and needs a context provider whose only job is to carry the lookup.
- **Import the manifest in the package.** `@pitlane/assets/manifest` resolves only inside the
  app's own Vite build, so the package takes the resolver the app built.
- **Depend on `@sdxc/security-headers` for the nonce.** It would tie the package to one CSP
  implementation; the callback serves any.
