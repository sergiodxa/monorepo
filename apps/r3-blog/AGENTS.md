# r3-blog Agent Guidelines

This document defines app-specific rules for `apps/r3-blog`.

## Rules

- MUST keep the app SSR-only using Remix Component rendering (`renderToString`) and HTML responses.
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

- SHOULD keep controller logic small and move reusable data transforms to models or helpers.
- SHOULD keep color and typography changes consistent with the current warm visual style.
- SHOULD validate route params early and return `notFound("<h1>404 Not Found</h1>")` on invalid routes.
- SHOULD prefer semantic tokens (`ui-neutral-*`, `ui-accent-*`) over raw palette tokens (`color-neutral-*`, `color-accent-*`) in UI component styles.
- SHOULD keep `/colors` route updated when tokens are added/removed.

- MAY add new semantic UI tokens if needed for accessibility or interaction states.
- MAY add small helper utilities for repeated publish/preview logic.
- MAY extend `prism.css` token tuning when readability regresses for specific languages (TS/JSX/shell).

- MUST NOT reintroduce support for non-public post types in `app/http/controllers/post.tsx` without explicit product direction.
- MUST NOT mark items with `published_at === null` as preview.
- MUST NOT use direct `#hex` colors in `resources/components/**/*.tsx`.
- MUST NOT bypass `@pkg/markdown/server` for markdown parsing.

- SHOULD NOT add component-specific color tokens when an existing semantic token can represent the same purpose.
- SHOULD NOT introduce client hydration requirements for public pages.
- SHOULD NOT duplicate schema/table definitions that already exist in `database/schema`.

- MAY NOT change established URL structures (`/articles/:slug`, `/tutorials/:slug`, `/bookmarks`, `/colors`) without explicit request.

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
