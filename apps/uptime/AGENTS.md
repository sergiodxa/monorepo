# Agent Guidelines

## Rules

Rules are the guidelines that agents must follow when performing their tasks. They ensure that agents operate within the defined parameters and maintain consistency in their actions.

Rules are written following RFC 2119, which defines the keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in uppercase to indicate requirement levels.

- MUST use `remix/router` helpers for defining typed HTTP actions and controllers.
- MUST use `ctx.render` from `remix/middleware/render` for rendering views in HTTP controllers.
- MUST use `getContext` from `remix/middleware/async-context` to access the request context outside controllers.
- MUST use `ctx` argument of controller actions for request context access inside controllers.
- MUST keep Cloudflare Worker bootstrap in `bootstrap/worker.ts` and application bootstrap in `bootstrap/app.tsx`.
- MUST map every route through `lazy()` from `@sdxc/lazy-route`, so a cold isolate imports the controllers it serves rather than the whole route table. A new route added with a static import silently puts its module back on every cold start.
- MUST declare an API controller's route map in `routes/api-groups.ts` and import it from there, so `bootstrap/app.tsx` can map the group while the controller behind it stays unloaded.
- MUST keep DB-facing fields in `snake_case` (`author_id`, `published_at`, `created_at`, etc.).
- MUST read and write data through `ctx.models` (the `@sdxc/data-model` registry in `app/models/index.ts`, published by the `models()` middleware in `app/http/middleware/models.ts` for requests and `app/jobs/middleware/models.ts` for jobs). A service that reads data takes `models: UptimeModels` from its caller; a test binds the same registry with `bindModels(db)` or `publishModels(ctx, db)` from `app/lib/test/models.ts`.
- MUST keep models free of i18n, request objects and rendering: a model owns persistence and domain rules, and a job a domain write implies is enqueued from that model's `afterCommit` callback through `ctx.jobs`.
- MUST expose a query a caller pages or narrows further as a model scope without ordering (`inTeam`, `forMonitor`), and order at the call site, since keyset pagination refuses an already-ordered query.
- MUST keep a query that joins or unions several tables into one report shape in `app/repositories/` (`reports.ts`, `team-digests.ts`), taking the request's `ctx.db`; everything that reads one table goes through its model.
- MUST review generated migration SQL before committing it, since the generator re-emits index definitions that were previously dropped on purpose.
- MUST NOT reintroduce a `<table>_id_unique` index on a column already declared `PRIMARY KEY`; SQLite maintains an automatic unique index for the primary key, so the explicit one only adds a written row per insert and per delete. Delete those statements from generated migrations.

- SHOULD keep controller logic small and move reusable data transforms to models or helpers.
- SHOULD narrow unknown values with type guards, schema validation, or explicit interfaces instead of unsafe assertions.
- SHOULD construct expensive middleware dependencies once (module-level cache/factory), not per request, unless request-scoped behavior is required.

- MUST NOT use `as any` anywhere in the code, including tests, scripts, controllers, middleware, repositories, views, and config files.
- MUST NOT call `getContext()` inside controllers when `ctx` is available.
- MUST link the document's stylesheets and client entry through `documentAssets()` in `app/lib/assets.ts`, which reads the asset manifest `@pitlane/vite-plugin-remix` writes: a build hashes every file, so a hand-written `/assets/...` URL or a `?url` stylesheet import names a file the next build renames. A stylesheet joins by a side-effect `import "….css"` in `resources/layouts/document.tsx`, in cascade order. The renderer in `app/http/render.tsx` looks the assets up per render; a test renderer wraps its node with `withDocumentAssets()` from `app/lib/test/document-assets.tsx`.
- MUST keep the `bootstrap/browser.ts` glob to `resources/components/`, where every `clientEntry()` island lives: a layout or view in the client bundle compiles its stylesheets a second time, and that copy differs from the server's by vendor prefixes, so every page would link both.

## Reference Files

Reference files are examples of good code that agents can refer to when performing their tasks. These files serve as a guide for agents to understand the expected output and coding standards.

- Bootstrap
  - `boostrap/worker.ts` <- Entry point for the Worker, the only place where Cloudflare-specific APIs are used
  - `bootstrap/app.tsx` <- Mapping of routes to controllers and global middleware
  - `app/lib/assets.ts` <- Built asset URLs (stylesheets, client entry, import map) from the manifest
- Configuration
  - `routes/web.ts` <- Registry of routes
  - `routes/api-groups.ts` <- Route maps grouping the API leaves each controller handles
- HTTP Layer
  - `app/http/controllers/default-handler.tsx` <- 404 handler for unmapped routes
  - `app/http/middleware/database.ts` <- Middleware to store database instance in the request context
  - `app/http/middleware/models.ts` <- Middleware publishing `ctx.models`, bound to the request's database and job enqueuer
  - `app/http/view-models/not-found.ts` <- View model for 404 responses
- Data Layer
  - `database/schema.ts` <- Database schema definitions
  - `app/models/index.ts` <- The model registry `ctx.models` binds, one lazily imported entry per table
  - `app/models/team-domains.ts` <- A model with scopes, methods and an `afterCommit` job enqueue
  - `app/repositories/reports.ts` <- A multi-table report query kept outside the models
  - `app/lib/test/models.ts` <- `bindModels`, `recordJobs` and `publishModels` for tests
