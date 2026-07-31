# Agent Guidelines

## Rules

Rules are the guidelines that agents must follow when performing their tasks. They ensure that agents operate within the defined parameters and maintain consistency in their actions.

Rules are written following RFC 2119, which defines the keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in uppercase to indicate requirement levels.

- MUST use `remix/fetch-router` helpers for defining typed HTTP actions and controllers.
- MUST use `ctx.render` from `remix/render-middleware` for rendering views in HTTP controllers.
- MUST use `getContext` from `remix/async-context-middleware` to access the request context outside controllers.
- MUST use `ctx` argument of controller actions for request context access inside controllers.
- MUST keep Cloudflare Worker bootstrap in `bootstrap/worker.ts` and application bootstrap in `bootstrap/app.tsx`.
- MUST keep DB-facing fields in `snake_case` (`author_id`, `published_at`, `created_at`, etc.).
- MUST read database access from request context with `ctx.get(Database)` in HTTP handlers.
- MUST review generated migration SQL before committing it, since the generator re-emits index definitions that were previously dropped on purpose.
- MUST NOT reintroduce a `<table>_id_unique` index on a column already declared `PRIMARY KEY`; SQLite maintains an automatic unique index for the primary key, so the explicit one only adds a written row per insert and per delete. Delete those statements from generated migrations.

- SHOULD keep controller logic small and move reusable data transforms to models or helpers.
- SHOULD narrow unknown values with type guards, schema validation, or explicit interfaces instead of unsafe assertions.
- SHOULD construct expensive middleware dependencies once (module-level cache/factory), not per request, unless request-scoped behavior is required.

- MUST NOT use `as any` anywhere in the code, including tests, scripts, controllers, middleware, repositories, views, and config files.
- MUST NOT call `getContext()` inside controllers when `ctx` is available.

## Reference Files

Reference files are examples of good code that agents can refer to when performing their tasks. These files serve as a guide for agents to understand the expected output and coding standards.

- Bootstrap
  - `boostrap/worker.ts` <- Entry point for the Worker, the only place where Cloudflare-specific APIs are used
  - `bootstrap/app.tsx` <- Mapping of routes to controllers and global middleware
- Configuration
  - `routes/web.ts` <- Registry of routes
- HTTP Layer
  - `app/http/controllers/default-handler.tsx` <- 404 handler for unmapped routes
  - `app/http/middleware/database.ts` <- Middleware to store database instance in the request context
  - `app/http/view-models/not-found.ts` <- View model for 404 responses
- Data Layer
  - `database/schema.ts` <- Database schema definitions
  - `app/data/` <- Data access layer (e.g. repositories)
