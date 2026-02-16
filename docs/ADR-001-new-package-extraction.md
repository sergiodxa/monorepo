# ADR-001: New Package Extraction

## Status

**Proposed** - 2026-02-16

## Background

During the package consistency audit of apps (`auth`, `books`, `blog`), several well-designed utilities were identified that could be extracted to reusable packages. This ADR documents the plan for creating new packages from existing app code.

## Context

The `apps/blog/` application contains several utilities that are general-purpose and would benefit other applications:

| Utility         | Source                                      | Lines of Code | Usage                           |
| --------------- | ------------------------------------------- | ------------- | ------------------------------- |
| Array utilities | `apps/blog/app/utils/arrays.ts`             | 56            | Array manipulation helpers      |
| KV Cache store  | `apps/blog/app/modules/cache.ts`            | 87            | Cloudflare KV cache abstraction |
| RSS builder     | `apps/blog/app/modules/rss.server.ts`       | 111           | RSS 2.0 feed generation         |
| Sitemap builder | `apps/blog/app/modules/sitemap.server.ts`   | 28            | XML sitemap generation          |
| useToggle hook  | `apps/blog/app/hooks/use-toggle.ts`         | 8             | Boolean toggle state hook       |
| Server timing   | `apps/blog/app/middleware/server-timing.ts` | ~50           | Performance measurement         |

Additionally, the `apps/books/` application has a form status pattern that could be extracted:

| Utility          | Source             | Usage                           |
| ---------------- | ------------------ | ------------------------------- |
| useFetcherStatus | Pattern in 3 files | Form submission status tracking |

## Decision

Extract the following new packages:

### 1. @pkg/arrays

**Source:** `apps/blog/app/utils/arrays.ts`

**Exports:**

```typescript
/**
 * Check if an array has any element inside
 */
export function hasAny<Value>(list: Value[]): boolean;

/**
 * Check if an array has more than one element
 */
export function hasMany<Value>(list: Value[]): boolean;

/**
 * Check if an array is empty
 */
export function isEmpty<Value>(list: Value[]): boolean;

/**
 * Get the first n items of an array, defaults to one item
 */
export function first<Value>(list: Value[], limit?: number): Value[];

/**
 * Get the last n items of an array, defaults to one item
 */
export function last<Value>(list: Value[], limit?: number): Value[];

/**
 * Remove duplicated values from an array (only primitives and references)
 */
export function unique<Value>(array: Value[]): Value[];

/**
 * Wrap a value in an array if it's not already an array
 */
export function toArray<Value>(value: Value | Value[]): Value[];

/**
 * Skip the first n items of an array
 */
export function skip<Value>(list: Value[], limit: number): Value[];
```

**Package structure:**

```
packages/arrays/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 2. @pkg/cache

**Source:** `apps/blog/app/modules/cache.ts`

**Exports:**

```typescript
export namespace Cache {
	type CacheKey = string | { cacheKey: string } | { cacheKey(): string };

	interface StoreWriteOptions {
		ttl?: number;
	}

	/**
	 * Abstract base class for cache stores
	 */
	abstract class Store {
		abstract read(key: CacheKey): Promise<string | null>;
		abstract write(key: CacheKey, value: string, options?: StoreWriteOptions): Promise<void>;
		abstract delete(key: CacheKey): Promise<void>;
		abstract exists(key: CacheKey): Promise<boolean>;
		abstract fetch(
			key: CacheKey,
			fn: () => Promise<string>,
			options?: StoreWriteOptions,
		): Promise<string>;
	}

	/**
	 * Cloudflare KV-backed cache store
	 */
	export class KVStore extends Store {
		constructor(kv: KVNamespace, waitUntil: (promise: Promise<unknown>) => void);
		read(key: CacheKey): Promise<string | null>;
		write(key: CacheKey, value: string, options?: KVStoreWriteOptions): Promise<void>;
		delete(key: CacheKey): Promise<void>;
		exists(key: CacheKey): Promise<boolean>;
		fetch(key: CacheKey, fn: () => Promise<string>, options?: KVStoreWriteOptions): Promise<string>;
		list(prefix?: string, limit?: number): Promise<string[]>;
	}
}
```

**Package structure:**

```
packages/cache/
├── src/
│   ├── index.ts
│   ├── store.ts
│   └── kv-store.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 3. @pkg/rss

**Source:** `apps/blog/app/modules/rss.server.ts`

**Exports:**

```typescript
interface RSSItem {
	guid: string;
	title: string;
	description: string;
	link: string;
	pubDate: string;
}

interface RSSChannel {
	title: string;
	description: string;
	link: string;
}

/**
 * RSS 2.0 feed builder and parser
 */
export class RSS {
	readonly channel: RSSChannel;

	constructor(channel: RSSChannel);

	get items(): RSSItem[];

	addItem(item: RSSItem): void;
	removeItem(guid: string): void;

	toJSON(): { channel: RSSChannel; items: RSSItem[] };
	toString(): string; // XML output

	static fetch(url: URL): Promise<RSS>;
}
```

**Dependencies:**

- `htmlparser2` (for parsing RSS feeds)

**Package structure:**

```
packages/rss/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 4. @pkg/sitemap

**Source:** `apps/blog/app/modules/sitemap.server.ts`

**Exports:**

```typescript
interface SiteURL {
	loc: URL;
	lastmod?: Date;
}

/**
 * XML Sitemap builder
 */
export class Sitemap {
	urls: Set<SiteURL>;

	append(loc: URL, lastmod?: Date): void;
	get size(): number;
	toString(): string; // XML output
}
```

**Package structure:**

```
packages/sitemap/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 5. @pkg/hooks

**Sources:**

- `apps/blog/app/hooks/use-toggle.ts`
- Pattern from `apps/books/` routes

**Exports:**

```typescript
import { useMemo, useCallback, useState } from "react";
import type { useFetcher } from "react-router";

/**
 * Boolean toggle state hook
 */
export function useToggle(initialState?: boolean): [boolean, () => void];

/**
 * Fetcher status tracking hook
 */
export function useFetcherStatus<T extends { ok?: boolean }>(
	fetcher: ReturnType<typeof useFetcher<T>>,
): "idle" | "loading" | "success" | "failure";
```

**Dependencies:**

- `react` (peer)
- `react-router` (peer, for useFetcherStatus)

**Package structure:**

```
packages/hooks/
├── src/
│   ├── index.ts
│   ├── use-toggle.ts
│   └── use-fetcher-status.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 6. @pkg/server-timing

**Source:** `apps/blog/app/middleware/server-timing.ts`

**Exports:**

```typescript
import type { unstable_MiddlewareFunction as MiddlewareFunction } from "react-router";

interface TimingCollector {
	measure<T>(name: string, description: string, fn: () => Promise<T>): Promise<T>;
	getHeader(): string;
}

/**
 * Create server timing middleware and accessor
 */
export function createServerTimingMiddleware(): [MiddlewareFunction, () => TimingCollector];

/**
 * Convenience wrapper for measuring async operations
 */
export function measure<T>(description: string, fn: () => Promise<T>): Promise<T>;
```

**Package structure:**

```
packages/server-timing/
├── src/
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation Phases

### Phase 1: Create @pkg/arrays

**Priority:** High (no dependencies, widely useful)
**Estimated Effort:** 30 minutes

1. Create package structure
2. Copy and clean up code from `apps/blog/app/utils/arrays.ts`
3. Add tests
4. Update `apps/blog` to use the package

### Phase 2: Create @pkg/hooks

**Priority:** High (React apps can use immediately)
**Estimated Effort:** 1 hour

1. Create package structure
2. Extract `useToggle` from blog
3. Create `useFetcherStatus` from books pattern
4. Add tests
5. Update apps to use the package

### Phase 3: Create @pkg/sitemap

**Priority:** Medium (simple, no dependencies)
**Estimated Effort:** 30 minutes

1. Create package structure
2. Copy code from `apps/blog/app/modules/sitemap.server.ts`
3. Add tests
4. Update `apps/blog` to use the package

### Phase 4: Create @pkg/cache

**Priority:** Medium (useful for Cloudflare Workers apps)
**Estimated Effort:** 1 hour

1. Create package structure
2. Extract from `apps/blog/app/modules/cache.ts`
3. Add tests with mock KV
4. Update `apps/blog` to use the package

### Phase 5: Create @pkg/rss

**Priority:** Low (specialized use case)
**Estimated Effort:** 1 hour

1. Create package structure
2. Add `htmlparser2` dependency
3. Copy code from `apps/blog/app/modules/rss.server.ts`
4. Add tests
5. Update `apps/blog` to use the package

### Phase 6: Create @pkg/server-timing

**Priority:** Low (depends on React Router middleware)
**Estimated Effort:** 1 hour

1. Create package structure
2. Extract from `apps/blog/app/middleware/server-timing.ts`
3. Add tests
4. Update apps to use the package

## Package Creation Template

Each package should follow this structure:

### package.json

```json
{
	"name": "@pkg/example",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"exports": {
		".": "./src/index.ts"
	},
	"scripts": {
		"test": "bun test"
	},
	"devDependencies": {
		"typescript": "^5.8.3"
	}
}
```

### tsconfig.json

```json
{
	"extends": "../../tsconfig.json",
	"compilerOptions": {
		"rootDir": "src",
		"outDir": "dist"
	},
	"include": ["src"]
}
```

### src/index.ts

```typescript
// Main exports
export { functionName } from "./module";
export type { TypeName } from "./types";
```

## Consequences

### Positive

- **Reusability** - Utilities available across all apps
- **Testability** - Isolated packages can have focused tests
- **Consistency** - Single source of truth for common patterns
- **Discoverability** - Packages are easy to find and use

### Negative

- **Initial effort** - Time to extract and set up packages
- **Maintenance** - More packages to maintain
- **Versioning** - Need to coordinate changes across apps

### Neutral

- **Bundle size** - Tree-shaking should keep bundles small
- **Type safety** - Need to ensure types are exported correctly

## Dependencies Between Packages

```
@pkg/arrays      (standalone)
@pkg/sitemap     (standalone)
@pkg/cache       (standalone, uses KVNamespace type)
@pkg/rss         (depends on htmlparser2)
@pkg/hooks       (peer deps: react, react-router)
@pkg/server-timing (peer deps: react-router)
```

## Current Progress

- [ ] Phase 1: Create @pkg/arrays
  - [ ] Create package structure
  - [ ] Copy and clean up code
  - [ ] Add tests
  - [ ] Update apps
- [ ] Phase 2: Create @pkg/hooks
  - [ ] Create package structure
  - [ ] Extract useToggle
  - [ ] Create useFetcherStatus
  - [ ] Add tests
  - [ ] Update apps
- [ ] Phase 3: Create @pkg/sitemap
  - [ ] Create package structure
  - [ ] Copy code
  - [ ] Add tests
  - [ ] Update apps
- [ ] Phase 4: Create @pkg/cache
  - [ ] Create package structure
  - [ ] Extract code
  - [ ] Add tests with mock KV
  - [ ] Update apps
- [ ] Phase 5: Create @pkg/rss
  - [ ] Create package structure
  - [ ] Add dependency
  - [ ] Copy code
  - [ ] Add tests
  - [ ] Update apps
- [ ] Phase 6: Create @pkg/server-timing
  - [ ] Create package structure
  - [ ] Extract code
  - [ ] Add tests
  - [ ] Update apps

## Notes

- All packages are `private: true` since they're workspace-only
- Use Bun's test runner for consistency with the monorepo
- Consider adding JSDoc comments for better IDE support
- The `@pkg/hooks` package has peer dependencies on React and React Router
- The `@pkg/cache` package uses Cloudflare's `KVNamespace` type
- RSS parsing uses `htmlparser2` which is already a dependency in the blog app
