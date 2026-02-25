# ADR-001: Package Consistency for Blog Application

## Status

**Implemented** - 2026-02-16

## Background

The monorepo contains shared packages in `packages/` that provide common functionality across applications. The `apps/uptime/` application serves as the reference implementation, fully leveraging these packages for consistency and code reuse.

The `apps/blog/` application uses some packages but has local implementations that duplicate package functionality. Additionally, the blog contains several utilities that are candidates for extraction to new packages.

## Context

### Current Package Usage

The blog app currently uses these workspace packages:

| Package         | Used | Purpose                        |
| --------------- | ---- | ------------------------------ |
| `@pkg/cn`       | Yes  | Class name utility             |
| `@pkg/logger`   | Yes  | Request-scoped batched logging |
| `@pkg/response` | Yes  | HTTP response helpers          |
| `@pkg/result`   | Yes  | Result pattern                 |
| `@pkg/validate` | Yes  | Input validation with Zod      |

### Missing Package Adoption

| Package              | Status              | Reason                                     |
| -------------------- | ------------------- | ------------------------------------------ |
| `@pkg/db-helpers`    | Has local duplicate | `app/db/helpers/id.ts` and `timestamps.ts` |
| `@pkg/get-client-ip` | Not used            | Should adopt for consistency               |
| `@pkg/location`      | Not used            | Should adopt for URL building              |
| `@pkg/markdown`      | Partially overlaps  | Blog uses Markdoc directly                 |
| `@pkg/ui`            | Not used            | Should adopt incrementally                 |

### Utilities to Extract

The blog app contains several well-designed utilities that should be extracted to packages for reuse:

| Utility         | File                              | Candidate Package    |
| --------------- | --------------------------------- | -------------------- |
| Array utilities | `app/utils/arrays.ts`             | `@pkg/arrays`        |
| KV Cache store  | `app/modules/cache.ts`            | `@pkg/cache`         |
| RSS builder     | `app/modules/rss.server.ts`       | `@pkg/rss`           |
| Sitemap builder | `app/modules/sitemap.server.ts`   | `@pkg/sitemap`       |
| useToggle hook  | `app/hooks/use-toggle.ts`         | `@pkg/hooks`         |
| Server timing   | `app/middleware/server-timing.ts` | `@pkg/server-timing` |

### Issues Identified

#### 1. Duplicate Database Helpers

**File:** `apps/blog/app/db/helpers/id.ts`

```typescript
export const UUID_LENGTH = 36;

export default text("id", { mode: "text", length: UUID_LENGTH })
	.$type<UUID>()
	.primaryKey()
	.unique()
	.notNull()
	.$defaultFn(() => generateUUID());
```

**File:** `apps/blog/app/db/helpers/timestamps.ts`

```typescript
export const createdAt = integer("created_at", { mode: "timestamp_ms" })
	.notNull()
	.$defaultFn(() => new Date());

export const updatedAt = integer("updated_at", { mode: "timestamp_ms" })
	.notNull()
	.$defaultFn(() => new Date());
```

**Issue:** These duplicate functionality in `@pkg/db-helpers` which provides `pk`, `timestamp`, and other column helpers.

#### 2. Mixed Error Handling Patterns

**Services use Result pattern (good):**

```typescript
// apps/blog/app/services/find-article-by-slug.ts
export default async function findArticleBySlug(
  slug: Article["slug"],
): Promise<Result<Article, ArticleNotFoundError>> {
  if (!result) return failure(new ArticleNotFoundError(slug));
  return success(ArticleSchema.parse({...}));
}
```

**Models throw errors (legacy):**

```typescript
// apps/blog/app/models/article.server.ts
if (!result) throw new Error(`Couldn't find article with slug ${slug}`);
```

**Routes bridge both:**

```typescript
// apps/blog/app/routes/_.$postType.$/queries.ts
if (isFailure(result)) {
	logger.error("query-article-failed", { slug, error: result.error.message });
	throw new Error("Article not found"); // Converts to thrown error
}
```

#### 3. Logger Usage with `warn`

The blog app uses `logger.warn()` in some places:

**File:** `apps/blog/app/modules/github.server.ts`

```typescript
logger.warn("github_file_not_found", { path });
```

This should be changed to `logger.info()` for consistency with other apps.

## Decision

### 1. Migrate to @pkg/db-helpers

Replace local database helpers with `@pkg/db-helpers`.

### 2. Add Missing Packages

Add `@pkg/get-client-ip`, `@pkg/location`, and `@pkg/ui` for consistency.

### 3. Extract Utilities to New Packages

Extract the following utilities (see monorepo-level ADR for details):

- `@pkg/arrays` - Array utility functions
- `@pkg/cache` - KV cache store abstraction
- `@pkg/rss` - RSS feed generation
- `@pkg/sitemap` - Sitemap XML generation
- `@pkg/hooks` - Reusable React hooks
- `@pkg/server-timing` - Server timing measurement

### 4. Standardize Logger Usage

Change `logger.warn()` calls to `logger.info()`.

### 5. Adopt @pkg/ui Incrementally

Adopt `@pkg/ui` for shared components while keeping blog's custom styling.

## Implementation Phases

### Phase 1: Migrate to @pkg/db-helpers

**Priority:** High
**Estimated Effort:** 2 hours

#### Step 1.1: Add Package Dependency

**File:** `apps/blog/package.json`

```json
{
	"dependencies": {
		"@pkg/db-helpers": "workspace:*"
	}
}
```

#### Step 1.2: Update Schema Imports

**File:** `apps/blog/app/db/schema.ts` (or wherever schema is defined)

```typescript
// Before
import id from "~/db/helpers/id";
import { createdAt, updatedAt } from "~/db/helpers/timestamps";

// After
import { pk, timestamp } from "@pkg/db-helpers";

// Usage
export const posts = sqliteTable("posts", {
	id: pk("id"),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
	// ...
});
```

**Note:** The blog uses a custom UUID type with tagged types. The `@pkg/db-helpers` `pk` helper may need to be used with `.$type<UUID>()` to maintain type safety.

#### Step 1.3: Delete Local Helpers

**Delete:**

- `apps/blog/app/db/helpers/id.ts`
- `apps/blog/app/db/helpers/timestamps.ts`
- `apps/blog/app/db/helpers/` (directory if empty)

### Phase 2: Add Missing Packages

**Priority:** Medium
**Estimated Effort:** 1 hour

#### Step 2.1: Add Package Dependencies

**File:** `apps/blog/package.json`

```json
{
	"dependencies": {
		"@pkg/get-client-ip": "workspace:*",
		"@pkg/location": "workspace:*"
	}
}
```

#### Step 2.2: Use Where Applicable

Use `getClientIP()` for any request IP extraction and `Location` for URL building without origin.

### Phase 3: Fix Logger Usage

**Priority:** Medium
**Estimated Effort:** 30 minutes

#### Step 3.1: Find All `logger.warn` Calls

```bash
grep -r "logger.warn" apps/blog/
```

#### Step 3.2: Change to `logger.info`

**File:** `apps/blog/app/modules/github.server.ts`

```typescript
// Before
logger.warn("github_file_not_found", { path });

// After
logger.info("github_file_not_found", { path });
```

Repeat for all occurrences.

### Phase 4: Adopt @pkg/ui

**Priority:** Low
**Estimated Effort:** 4-8 hours (incremental)

#### Step 4.1: Add Package Dependency

**File:** `apps/blog/package.json`

```json
{
	"dependencies": {
		"@pkg/ui": "workspace:*"
	}
}
```

#### Step 4.2: Migrate Components Incrementally

Start with form components and interactive elements:

- Form inputs → `TextField`, `Input`
- Buttons → `Button`
- Navigation → `Tabs`, `NavLink`
- Modals/Dialogs → `Dialog`, `Modal`

#### Step 4.3: Keep Custom Blog Styling

The blog has custom typography and layout styling. Keep this while using `@pkg/ui` for interactive components.

### Phase 5: Prepare Utility Extraction

**Priority:** Low (depends on monorepo-level ADR)
**Estimated Effort:** Tracked in monorepo ADR

Once the new packages are created, update blog to use them:

1. Replace `app/utils/arrays.ts` with `@pkg/arrays`
2. Replace `app/modules/cache.ts` with `@pkg/cache`
3. Replace `app/modules/rss.server.ts` with `@pkg/rss`
4. Replace `app/modules/sitemap.server.ts` with `@pkg/sitemap`
5. Replace `app/hooks/use-toggle.ts` with `@pkg/hooks`
6. Replace `app/middleware/server-timing.ts` with `@pkg/server-timing`

## Package Dependency Matrix (After Migration)

| Package              | Before     | After                  |
| -------------------- | ---------- | ---------------------- |
| `@pkg/arrays`        | No (local) | Yes (after extraction) |
| `@pkg/cache`         | No (local) | Yes (after extraction) |
| `@pkg/cn`            | Yes        | Yes                    |
| `@pkg/db-helpers`    | No         | Yes                    |
| `@pkg/get-client-ip` | No         | Yes                    |
| `@pkg/hooks`         | No (local) | Yes (after extraction) |
| `@pkg/location`      | No         | Yes                    |
| `@pkg/logger`        | Yes        | Yes                    |
| `@pkg/response`      | Yes        | Yes                    |
| `@pkg/result`        | Yes        | Yes                    |
| `@pkg/rss`           | No (local) | Yes (after extraction) |
| `@pkg/server-timing` | No (local) | Yes (after extraction) |
| `@pkg/sitemap`       | No (local) | Yes (after extraction) |
| `@pkg/ui`            | No         | Yes                    |
| `@pkg/validate`      | Yes        | Yes                    |

## Consequences

### Positive

- **Consistency** - Blog follows same patterns as other apps
- **Reusable utilities** - Extracted packages benefit all apps
- **Less maintenance** - Shared code maintained once
- **Better types** - `@pkg/db-helpers` provides consistent column types

### Negative

- **Migration effort** - Need to update schema and imports
- **Potential breaking changes** - UUID type handling may differ
- **Coordination** - Utility extraction requires monorepo-level work

### Neutral

- **Custom styling preserved** - Blog's unique look remains
- **Gradual migration** - Can be done incrementally

## Files to Modify

### Phase 1

| File                                     | Change                           |
| ---------------------------------------- | -------------------------------- |
| `apps/blog/package.json`                 | Add `@pkg/db-helpers` dependency |
| `apps/blog/app/db/schema.ts`             | Update imports to use package    |
| `apps/blog/app/db/helpers/id.ts`         | Delete                           |
| `apps/blog/app/db/helpers/timestamps.ts` | Delete                           |

### Phase 2

| File                     | Change                                    |
| ------------------------ | ----------------------------------------- |
| `apps/blog/package.json` | Add `@pkg/get-client-ip`, `@pkg/location` |

### Phase 3

| File                                     | Change                               |
| ---------------------------------------- | ------------------------------------ |
| `apps/blog/app/modules/github.server.ts` | Change `logger.warn` → `logger.info` |
| Other files with `logger.warn`           | Change to `logger.info`              |

### Phase 4

| File                     | Change                          |
| ------------------------ | ------------------------------- |
| `apps/blog/package.json` | Add `@pkg/ui` dependency        |
| Various component files  | Migrate to `@pkg/ui` components |

### Phase 5 (After Package Extraction)

| File                                        | Change                           |
| ------------------------------------------- | -------------------------------- |
| `apps/blog/app/utils/arrays.ts`             | Delete, use `@pkg/arrays`        |
| `apps/blog/app/modules/cache.ts`            | Delete, use `@pkg/cache`         |
| `apps/blog/app/modules/rss.server.ts`       | Delete, use `@pkg/rss`           |
| `apps/blog/app/modules/sitemap.server.ts`   | Delete, use `@pkg/sitemap`       |
| `apps/blog/app/hooks/use-toggle.ts`         | Delete, use `@pkg/hooks`         |
| `apps/blog/app/middleware/server-timing.ts` | Delete, use `@pkg/server-timing` |

## Current Progress

- [x] Phase 1: Migrate to @pkg/db-helpers
  - [x] Add package dependency
  - [x] Update schema imports
  - [x] Delete local helpers
- [x] Phase 2: Add missing packages
  - [x] Add @pkg/get-client-ip
  - [x] Add @pkg/location
- [x] Phase 3: Fix logger usage
  - [x] Find all logger.warn calls (3 occurrences)
  - [x] Change to logger.info
- [x] Phase 4: Adopt @pkg/ui (CMS only)
  - [x] Add package dependency
  - [x] Migrate CMS form components
  - [x] Migrate CMS interactive elements (Table, GridList, TagGroup, etc.)
- [x] Phase 5: Use extracted packages
  - [x] @pkg/arrays - re-exports from package
  - [x] @pkg/cache - re-exports from package
  - [x] @pkg/rss - re-exports from package
  - [x] @pkg/sitemap - re-exports from package
  - [x] @pkg/hooks - useToggle moved to package

## Notes

- The blog's tagged UUID type (`Tagged<string, "__uuid">`) may require adjustment when using `@pkg/db-helpers`
- Content is stored in GitHub and rendered with Markdoc; `@pkg/markdown` overlap is minimal
- The blog has significant custom styling that should be preserved
- Utility extraction is tracked in the monorepo-level ADR (ADR-001-new-package-extraction.md)
- Server timing middleware is already well-designed and can be extracted as-is
- The RSS and Sitemap classes are self-contained and ready for extraction
