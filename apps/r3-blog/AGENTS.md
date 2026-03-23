# r3-blog Agent Guidelines

This document defines app-specific rules for `apps/r3-blog`.

## Rules

- MUST keep the app SSR-only using Remix Component rendering (`renderToString`) and HTML responses.
- MUST use model classes for data access in controllers (avoid ad-hoc DB queries in controllers).
- MUST treat post publish state as:
  - `published_at === null` => published
  - `published_at` in the past => published
  - `published_at` in the future => preview
- MUST only support `articles` and `tutorials` in `src/controller/post.tsx`; unsupported `postType` must return 404.
- MUST keep DB-facing fields in `snake_case` (`author_id`, `published_at`, `created_at`, etc.).
- MUST use semantic UI color tokens (`--ui-*`) in components, not hardcoded hex values.
- MUST keep color tokens centralized in `src/styles/colors.css`.
- MUST keep code-block syntax colors in `src/styles/prism.css` as a dedicated theme (not a flat reuse of generic UI text colors).
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

- MUST NOT reintroduce support for non-public post types in `src/controller/post.tsx` without explicit product direction.
- MUST NOT mark items with `published_at === null` as preview.
- MUST NOT use direct `#hex` colors in `src/components/**/*.tsx`.
- MUST NOT bypass `@pkg/markdown/server` for markdown parsing.

- SHOULD NOT add component-specific color tokens when an existing semantic token can represent the same purpose.
- SHOULD NOT introduce client hydration requirements for public pages.
- SHOULD NOT duplicate schema/table definitions that already exist in `src/schema.ts`.

- MAY NOT change established URL structures (`/articles/:slug`, `/tutorials/:slug`, `/bookmarks`, `/colors`) without explicit request.

## Reference Files

- Routing and mapping
  - `src/routes.ts`
  - `src/router.ts`
- Public controllers
  - `src/controller/feed.tsx`
  - `src/controller/articles.tsx`
  - `src/controller/tutorials.tsx`
  - `src/controller/bookmarks.tsx`
  - `src/controller/post.tsx`
  - `src/controller/colors.tsx`
- UI components
  - `src/components/layout/blog.tsx`
  - `src/components/layout/cms.tsx`
- Styling system
  - `src/styles/colors.css`
  - `src/styles/prism.css`
- Data layer
  - `src/schema.ts`
  - `src/models/post.ts`
  - `src/models/post-meta.ts`
  - `src/models/feed.ts`
  - `src/models/posts/article.ts`
  - `src/models/posts/tutorial.ts`
  - `src/models/posts/like.ts`
- Markdown integration
  - `packages/markdown/src/server/index.ts`
  - `packages/markdown/src/client/remix/index.tsx`
