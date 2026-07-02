# r3-blog Agent Guidelines

This document defines app-specific rules for `apps/r3-blog`.

## Rules

- MUST keep the app SSR-only using `remix/ui/server` rendering (`renderToString`) and HTML responses.
- MUST keep Cloudflare Worker bootstrap in `bootstrap/worker.ts` and router creation in `bootstrap/app.tsx`.
- MUST use model classes for data access in controllers (avoid ad-hoc DB queries in controllers).
- MUST treat post publish state as:
  - `published_at === null` => published
  - `published_at` in the past => published
  - `published_at` in the future => preview
- MUST only support `articles` and `tutorials` in `app/http/controllers/post.tsx`; unsupported `postType` must return 404.
- MUST keep DB-facing fields in `snake_case` (`author_id`, `published_at`, `created_at`, etc.).
- MUST use semantic UI color tokens (`--ui-*`) in components, not hardcoded hex values.
- MUST keep color tokens centralized in `resources/css/colors.css`.
- MUST keep code-block syntax colors in `resources/css/prism.css` as a dedicated theme (not a flat reuse of generic UI text colors).
- MUST ensure changes pass `bunx tsc -p apps/r3-blog/tsconfig.json`.
- MUST use namespaces for types only; no runtime values, functions, or classes inside namespaces.
- MUST receive `ctx` as a handler argument in `app/http/controllers/**/*` (actions, handlers, and inline middleware callbacks) and use that value directly.
- MUST read database access in HTTP handlers from `@pkg/service-container` using `inject([Database] as const, ...)`, while keeping `ctx` as the forwarded handler argument.
- MUST keep Cloudflare/environment typing declarations in `config/*.d.ts` (outside `app/`) and include them in app TS config.
- MUST derive production mode in `bootstrap/worker.ts` from runtime request/environment signals, not `import.meta.env.PROD`.

- SHOULD keep controller logic small and move reusable data transforms to models or helpers.
- SHOULD keep color and typography changes consistent with the current warm visual style.
- SHOULD validate route params early and return `notFound("<h1>404 Not Found</h1>")` on invalid routes.
- SHOULD prefer semantic tokens (`ui-neutral-*`, `ui-accent-*`) over raw palette tokens (`color-neutral-*`, `color-accent-*`) in UI component styles.
- SHOULD keep `/colors` route updated when tokens are added/removed.
- SHOULD narrow unknown values with type guards, schema validation, or explicit interfaces instead of unsafe assertions.
- SHOULD construct expensive middleware dependencies once (module-level cache/factory), not per request, unless request-scoped behavior is required.
- SHOULD prefer batched DB queries over per-id fanout (`Promise.all` N+1 patterns), especially in feed/rss/sitemap paths.

- MAY add new semantic UI tokens if needed for accessibility or interaction states.
- MAY add small helper utilities for repeated publish/preview logic.
- MAY extend `prism.css` token tuning when readability regresses for specific languages (TS/JSX/shell).

- MUST NOT reintroduce support for non-public post types in `app/http/controllers/post.tsx` without explicit product direction.
- MUST NOT mark items with `published_at === null` as preview.
- MUST NOT use direct `#hex` colors in `resources/components/**/*.tsx`.
- MUST NOT bypass `@pkg/markdown/server` for markdown parsing.
- MUST NOT use `as any` anywhere in this app (`apps/r3-blog/**/*`), including tests, scripts, controllers, middleware, repositories, views, and config files.
- MUST NOT call `getContext()` inside controllers when `ctx` is available.
- MUST NOT read database access from request context with `ctx.get(Database)` in HTTP handlers.

- SHOULD NOT add component-specific color tokens when an existing semantic token can represent the same purpose.
- SHOULD NOT introduce client hydration requirements for public pages.
- SHOULD NOT duplicate schema/table definitions that already exist in `database/schema`.

- MAY NOT change established URL structures (`/articles/:slug`, `/tutorials/:slug`, `/bookmarks`, `/colors`) without explicit request.

### Documentation

- MUST write JSDoc comments for every exported class, function, method, variable, type, interface, and constant in this app.
- MUST write JSDoc comments for non-exported, non-private module symbols when they are part of a file's behavior contract (helpers, mappers, normalizers, comparators, etc.).
- MUST write JSDoc comments for every non-private member of exported classes (including static members, instance methods, getters/setters, and constructor when present).
- MUST write JSDoc comments for inline controller callbacks (middleware callbacks, action handlers, and route handlers) inside controller definitions.
- MUST make JSDoc describe the exported symbol behavior/purpose, never the export mechanics (for example, avoid comments like "Exports the module default value.").
- MUST make JSDoc explain intent and contract (the why/guarantee), not only restate syntax or obvious code behavior.
- MUST document non-obvious behavior and invariants when relevant (fallbacks, ordering assumptions, publish/preview semantics, normalization rules, nullability contracts, redirect/404 behavior).
- MUST keep JSDoc descriptions short and focused (1 to 3 lines when a description is needed).
- MUST keep JSDoc examples hyper-focused and inline (no fenced Markdown code blocks inside `@example`).

- MAY include JSDoc `@param` tags with concise descriptions for each parameter when there are parameters.
- MAY include JSDoc `@returns` tags with concise descriptions when there's a return value.
- MAY include JSDoc `@template` tags with concise descriptions when there are generic type parameters.
- MAY include up to 3 JSDoc `@example` tags for practical usage snippets.

- SHOULD use `@param` and `@returns` on handlers/repository methods where request context, side effects, or response contracts are not obvious.
- SHOULD document edge-case behavior (empty inputs, invalid params, missing records, legacy data shapes) when a symbol intentionally handles those cases.

- MUST NOT use placeholder or template wording in JSDoc (for example: "Defines ...", "Represents ...", or "Handles ..." without meaningful contract detail).
- MUST NOT duplicate type names or signatures in prose when that adds no new information.

## Reference Files

- Routing and mapping
  - `routes/web.ts`
  - `bootstrap/app.tsx`
- Public controllers
  - `app/http/controllers/feed.tsx`
  - `app/http/controllers/articles.tsx`
  - `app/http/controllers/tutorials.tsx`
  - `app/http/controllers/bookmarks.tsx`
  - `app/http/controllers/post.tsx`
  - `app/http/controllers/colors.tsx`
- UI components
  - `resources/components/layout/blog.tsx`
  - `resources/components/layout/cms.tsx`
- Styling system
  - `resources/css/colors.css`
  - `resources/css/prism.css`
- Data layer
  - `database/schema/index.ts`
  - `app/repositories/post.ts`
  - `app/repositories/post-meta.ts`
  - `app/repositories/feed.ts`
  - `app/repositories/posts/article.ts`
  - `app/repositories/posts/tutorial.ts`
  - `app/repositories/posts/like.ts`
- Markdown integration
  - `packages/markdown/src/server/index.ts`
  - `packages/markdown/src/client/remix/index.tsx`
