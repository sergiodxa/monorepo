# Agent Guidelines

## Rules

Rules are the guidelines that agents must follow when performing their tasks. They ensure that agents operate within the defined parameters and maintain consistency in their actions.

Rules are written following RFC 2119, which defines the keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in uppercase to indicate requirement levels.

- MUST use `remix/router` helpers for defining typed HTTP actions and controllers.
- MUST use `ctx.render` from `remix/middleware/render` for rendering views in HTTP controllers.
- MUST use `getContext` from `remix/middleware/async-context` to access the request context outside controllers.
- MUST use `ctx` argument of controller actions for request context access inside controllers.
- MUST keep `bootstrap/` to the entry points (`worker.ts`, `browser.ts`, `cli.ts`) with the `GeoFetchDO` class re-exported from `app/services/geo-fetch.ts`, where it delegates to `proxyProbe()` in `app/services/geo-fetch.ts`; the router is `createWebRouter` in `app/initializers/router.tsx`, and nothing outside `bootstrap/` imports from it.
- MUST build every package instance (database, billing, flags, mailer, queue, assets, SEO, cookies, issuer) in `app/initializers/`, and put static configuration (pricing, origin, security.txt, security headers policy, time zones) in `config/`.
- MUST declare every command in `app/commands/index.ts` with its handler in its own file beside it, mapped through `lazy()` in `app/initializers/cli.ts`; run them with `sdxc run <command>` (`sdxc run db migrate [--remote]`, `sdxc run typegen`), whose database commands read the `DB` entry of `wrangler.jsonc`.
- MUST map every route through `lazy()` from `@sdxc/lazy-route`, so a cold isolate imports the controllers it serves rather than the whole route table. A new route added with a static import silently puts its module back on every cold start.
- MUST declare an API controller's route map in `routes/api-groups.ts` and import it from there, so `app/initializers/router.tsx` can map the group while the controller behind it stays unloaded.
- MUST keep DB-facing fields in `snake_case` (`author_id`, `published_at`, `created_at`, etc.).
- MUST read and write data through `ctx.models` (the `@sdxc/data-model` registry in `app/models/index.ts`, published by the `models()` middleware in `app/http/middleware/models.ts` for requests and `app/jobs/middleware/models.ts` for jobs). A service that reads data takes `models: UptimeModels` from its caller; a test binds the same registry with `bindModels(db)` or `publishModels(ctx, db)` from `app/test/models.ts`.
- MUST keep models free of i18n, request objects and rendering: a model owns persistence and domain rules, and a job a domain write implies is enqueued from that model's `afterCommit` callback through `ctx.jobs`.
- MUST expose a query a caller pages or narrows further as a model scope without ordering (`inTeam`, `forMonitor`), and order at the call site, since keyset pagination refuses an already-ordered query.
- MUST keep a query that joins or unions several tables into one report shape in its own module in `app/models/` (`reports.ts`, `team-digests.ts`), taking the request's `ctx.db`; everything that reads one table goes through its model.
- MUST review generated migration SQL before committing it, since the generator re-emits index definitions that were previously dropped on purpose.
- MUST NOT reintroduce a `<table>_id_unique` index on a column already declared `PRIMARY KEY`; SQLite maintains an automatic unique index for the primary key, so the explicit one only adds a written row per insert and per delete. Delete those statements from generated migrations.

- SHOULD keep controller logic small and move reusable data transforms to models or helpers.
- SHOULD narrow unknown values with type guards, schema validation, or explicit interfaces instead of unsafe assertions.
- SHOULD construct expensive middleware dependencies once (module-level cache/factory), not per request, unless request-scoped behavior is required.

- MUST NOT use `as any` anywhere in the code, including tests, scripts, controllers, middleware, repositories, views, and config files.
- MUST NOT call `getContext()` inside controllers when `ctx` is available.
- MUST link the document's stylesheets and client entry through `ctx.assets`, which the router's `assets()` middleware (`@sdxc/assets-middleware`) resolves once per request through `assetResolver` in `app/initializers/assets.ts`, over the asset manifest `@pitlane/vite-plugin-remix` writes: a build hashes every file, so a hand-written `/assets/...` URL or a `?url` stylesheet import names a file the next build renames. A stylesheet joins by a side-effect `import "….css"` in `resources/layouts/document.tsx`, in cascade order. Every page passes the assets to its document explicitly, `<DocumentLayout assets={ctx.assets}>`, and the document stamps `ctx.assets.nonce` (the security headers' CSP nonce) on the import map. A test router installs `testAssets()` from `app/test/document-assets.ts` ahead of its renderer.
- MUST keep the `bootstrap/browser.ts` glob to `resources/components/`, where every `clientEntry()` island lives: a layout or view in the client bundle compiles its stylesheets a second time, and that copy differs from the server's by vendor prefixes, so every page would link both.

## Reference Files

Reference files are examples of good code that agents can refer to when performing their tasks. These files serve as a guide for agents to understand the expected output and coding standards.

- Bootstrap
  - `bootstrap/worker.ts` <- Entry point for the Worker, handing requests, crons and queue batches to the initializers
  - `app/services/geo-fetch.ts` <- The `GeoFetchDO` Durable Object class and the probe it runs
- Initializers
  - `app/initializers/router.tsx` <- `createWebRouter`: global middleware and every route mapped through `lazy()`
  - `app/initializers/dispatcher.ts` <- The job dispatcher both queue and cron handlers delegate to
  - `app/initializers/assets.ts` <- The asset resolver over the build manifest, read by the router's `assets()` and `render()` middleware
- Configuration
  - `routes/web.ts` <- Registry of routes
  - `routes/api-groups.ts` <- Route maps grouping the API leaves each controller handles
- HTTP Layer
  - `app/http/controllers/default-handler.tsx` <- 404 handler for unmapped routes
  - `@sdxc/database-middleware` <- Publishes the database as `ctx.db` on requests (router) and jobs (`./jobs`, in the dispatcher)
  - `app/http/middleware/models.ts` <- Middleware publishing `ctx.models`, bound to the request's database and job enqueuer
  - `app/http/view-models/not-found.ts` <- View model for 404 responses
- Data Layer
  - `database/schema.ts` <- Database schema definitions
  - `app/models/index.ts` <- The model registry `ctx.models` binds, one lazily imported entry per table
  - `app/models/team-domains.ts` <- A model with scopes, methods and an `afterCommit` job enqueue
  - `app/models/reports.ts` <- A multi-table report query, taking `ctx.db` rather than one table's model
  - `app/test/models.ts` <- `bindModels`, `recordJobs` and `publishModels` for tests
