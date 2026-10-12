# ADR-130: Database Middleware Package

## Status

**Accepted** - 2026-10-11

## Background

Five apps (blog, demo, auth-saas, r3-auth, uptime) each carried the same
`app/http/middleware/database.ts`: a context key, a `RequestContext` augmentation adding `db`,
and a factory that set the database on the context with `{ property: "db" }`. The files differed
only in comments and in whether the factory was a default or a named export. Publishing services
onto the request context from middleware is the repo's rule (ADR-057), so every new app that
reads `ctx.db` would write the file a sixth time.

## Context

- Each copy took a `source: () => Database` and called it on every request. Every `source` an
  app passed was either a memoized `createDatabase()` or, in tests, `() => db` over an instance
  the test had already opened, so the indirection deferred nothing.
- The copies returned a plain `Middleware`, so a router whose context is derived from its
  middleware list saw `ctx.db` only through the module augmentation, never through the chain.
- `@sdxc/data-model/router`'s `models()` reads `ctx.db` when the first model is bound, so it
  composes with any middleware that publishes `db` earlier in the chain.

## Decision

Add `@sdxc/database-middleware`, exporting:

- `database(db: Database): Middleware<{ key: typeof Database; value: Database; property: "db" }>`,
  which publishes the given instance as `ctx.db` for every request it runs on.
- `Database`, the context key, annotated `{ defaultValue?: Database }` so it has a nameable type
  in the published declaration file.

Importing the package augments `remix/router`'s `RequestContext` with `db: Database`.

The factory takes the instance, so an app opens its database where the router is built:
`database(createDatabase())` inside a per-request `createWebRouter(...)`, or at module scope for
a router that is a module-level singleton, since opening a `remix/data-table` database over a D1
binding only constructs an object. A test passes the instance it opened.

A `./jobs` entry exports `database(db)` as `@sdxc/jobs` job middleware, publishing the database
under the same `Database` key as `ctx.db`, so a job handler and a route handler read it the same
way. It also accepts a function, called once per run, because a dispatcher is a long-lived
singleton and a test swaps the database between runs. `@sdxc/jobs` is an optional peer dependency,
needed only by that entry.

The five apps delete their copies, router and job middleware alike, and import from the package;
job handlers that read `ctx.database` read `ctx.db`.

## Consequences

### Positive

- One implementation and one augmentation of `ctx.db` across every app.
- A router derived from its middleware list types `ctx.db` from the chain itself.
- A test installs its database with `database(db)`, the same call production makes.

### Negative

- A router built once per isolate holds the instance it was given; an app whose database must
  change per request builds its router per request, as the per-request apps already do.

## Alternatives Considered

- **Keep the `source` function.** It deferred nothing any caller needed, and passing the instance
  states the contract plainly: the router serves the database it was built with.
- **Leave the copies in the apps.** Five identical files and a sixth for the next app.
