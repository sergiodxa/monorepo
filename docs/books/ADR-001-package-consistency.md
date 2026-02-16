# ADR-001: Package Consistency for Books Application

## Status

**Partially Implemented** - 2026-02-16

## Background

The monorepo contains shared packages in `packages/` that provide common functionality across applications. The `apps/uptime/` application serves as the reference implementation, fully leveraging these packages for consistency and code reuse.

The `apps/books/` application uses several packages but has some inconsistencies and a runtime bug that need to be addressed.

## Context

### Current Package Usage

The books app currently uses these workspace packages:

| Package              | Used | Purpose                                                         |
| -------------------- | ---- | --------------------------------------------------------------- |
| `@pkg/get-client-ip` | Yes  | Extract client IP for Buttondown                                |
| `@pkg/location`      | Yes  | URL building without origin                                     |
| `@pkg/logger`        | Yes  | Request-scoped batched logging                                  |
| `@pkg/response`      | Yes  | HTTP response helpers (`ok`, `badRequest`)                      |
| `@pkg/result`        | Yes  | Result pattern (`success`, `failure`, `isSuccess`, `isFailure`) |
| `@pkg/validate`      | Yes  | Input validation with Zod schemas                               |

### Missing Package Adoption

| Package   | Status   | Reason                                |
| --------- | -------- | ------------------------------------- |
| `@pkg/cn` | Not used | No complex class name logic currently |
| `@pkg/ui` | Not used | Custom minimal UI for landing pages   |

### Issues Identified

#### 1. Runtime Bug: Missing `logger.warn` Method

**Severity:** High (will cause runtime errors)

**File:** `apps/books/app/middleware/logger.ts`

```typescript
export const logger = {
	info: (event: string, payload?: Record<string, unknown>) => getLogger().info(event, payload),
	error: (event: string, payload?: Record<string, unknown>) => getLogger().error(event, payload),
	// Missing: warn
};
```

**Files calling `logger.warn()` (will fail at runtime):**

- `apps/books/app/routes/api.subscribe.ts` (lines 21, 24, 38, 46)
- `apps/books/app/routes/api.checkout.$type.ts` (line 34)

#### 2. Inconsistent Result Pattern Usage

**File:** `apps/books/app/routes/api.checkout.$type.ts`

```typescript
// Current (anti-pattern)
let discount = discountResult.status === "success" ? discountResult.data : undefined;
if (discountResult.status === "failure") { ... }

// Should be
import { isSuccess, isFailure } from "@pkg/result";
let discount = isSuccess(discountResult) ? discountResult.data : undefined;
if (isFailure(discountResult)) { ... }
```

#### 3. Duplicated Loading Spinner

The same SVG loading spinner is copy-pasted in 3 files:

- `apps/books/app/routes/_index.tsx`
- `apps/books/app/components/sample-chapter-form.tsx`
- `apps/books/app/routes/upgrade/route.tsx`

#### 4. Duplicated Form Status Logic

The same form status calculation pattern is repeated:

```typescript
const status = useMemo<SubscribeFormStatus>(() => {
	if (fetcher.state === "submitting") return "loading";
	if (fetcher.state === "loading") return "loading";
	if (fetcher.data?.ok === false) return "failure";
	return "idle";
}, [fetcher.state, fetcher.data]);
```

This appears in:

- `apps/books/app/routes/_index.tsx`
- `apps/books/app/components/sample-chapter-form.tsx`
- `apps/books/app/routes/upgrade/route.tsx`

#### 5. Duplicate Zod Schemas

**File 1:** `apps/books/app/schemas/subscribe.ts`

```typescript
export const subscribeSchema = z.object({
	email: z.email({ message: "Invalid email address" }),
	source: z.string().optional(),
	campaign: z.string().optional(),
	medium: z.string().optional(),
	referral: z.string().optional(),
});
```

**File 2:** `apps/books/app/routes/upgrade/schemas.server.ts`

```typescript
export const upgradeSchema = z.object({
	email: z.email({ message: "Invalid email address" }),
	source: z.string().optional(),
	campaign: z.string().optional(),
	medium: z.string().optional(),
	referral: z.string().optional(),
});
```

These schemas are identical and should be consolidated.

## Decision

### 1. Fix Logger Usage (Critical)

Replace all `logger.warn()` calls with `logger.info()` since these are expected events, not system errors:

- Validation failures → `logger.info` (expected user behavior)
- Blocked subscribers → `logger.info` (informational)
- Invalid emails → `logger.info` (expected user behavior)
- Discount lookup failures → `logger.info` (non-critical, checkout continues)

### 2. Standardize Result Pattern Usage

Use `isSuccess()`/`isFailure()` guards consistently instead of checking `.status` property.

### 3. Add @pkg/cn

Add for consistency with other apps and any future class name needs.

### 4. Adopt @pkg/ui Incrementally

Adopt `@pkg/ui` for:

- Form components (`TextField`, `Button`)
- Loading spinner (`Spinner`)
- Shared UI elements

### 5. Consolidate Duplicate Code

- Extract loading spinner to `@pkg/ui` (or local component)
- Extract form status hook (candidate for `@pkg/hooks`)
- Consolidate duplicate schemas

## Implementation Phases

### Phase 1: Fix Logger Runtime Bug (Critical)

**Priority:** Critical
**Estimated Effort:** 30 minutes

#### Step 1.1: Fix api.subscribe.ts

**File:** `apps/books/app/routes/api.subscribe.ts`

```typescript
// Line 21: Change logger.warn to logger.info
// Before
logger.warn("subscribe_validation_failed", { issue: error.issues[0].message });
// After
logger.info("subscribe_validation_failed", { issue: error.issues[0].message });

// Line 24: Change logger.warn to logger.info
// Before
logger.warn("subscribe_validation_failed", { error: "Invalid form data" });
// After
logger.info("subscribe_validation_failed", { error: "Invalid form data" });

// Line 38: Change logger.warn to logger.info
// Before
logger.warn("subscriber_blocked", { email: payload.email });
// After
logger.info("subscriber_blocked", { email: payload.email });

// Line 46: Change logger.warn to logger.info
// Before
logger.warn("subscribe_email_invalid", { email: payload.email });
// After
logger.info("subscribe_email_invalid", { email: payload.email });
```

#### Step 1.2: Fix api.checkout.$type.ts

**File:** `apps/books/app/routes/api.checkout.$type.ts`

```typescript
// Line 34: Change logger.warn to logger.info
// Before
logger.warn("discount_lookup_failed", { error: discountResult.error.message });
// After
logger.info("discount_lookup_failed", { error: discountResult.error.message });
```

### Phase 2: Fix Result Pattern Usage

**Priority:** Medium
**Estimated Effort:** 15 minutes

#### Step 2.1: Update api.checkout.$type.ts

**File:** `apps/books/app/routes/api.checkout.$type.ts`

```typescript
// Add import
import { isSuccess, isFailure } from "@pkg/result";

// Line 31: Change status check to guard
// Before
let discount = discountResult.status === "success" ? discountResult.data : undefined;
// After
let discount = isSuccess(discountResult) ? discountResult.data : undefined;

// Line 33: Change status check to guard
// Before
if (discountResult.status === "failure") {
// After
if (isFailure(discountResult)) {
```

### Phase 3: Add @pkg/cn

**Priority:** Low
**Estimated Effort:** 15 minutes

#### Step 3.1: Add Package Dependency

**File:** `apps/books/package.json`

```json
{
	"dependencies": {
		"@pkg/cn": "workspace:*"
	}
}
```

#### Step 3.2: Use Where Applicable

Replace any inline class name logic with `cn()`.

### Phase 4: Adopt @pkg/ui

**Priority:** Medium
**Estimated Effort:** 2-4 hours

#### Step 4.1: Add Package Dependency

**File:** `apps/books/package.json`

```json
{
	"dependencies": {
		"@pkg/ui": "workspace:*"
	}
}
```

#### Step 4.2: Replace Loading Spinner

Replace the duplicated SVG spinner with `<Spinner />` from `@pkg/ui`:

**Files to update:**

- `apps/books/app/routes/_index.tsx`
- `apps/books/app/components/sample-chapter-form.tsx`
- `apps/books/app/routes/upgrade/route.tsx`

```tsx
// Before
<svg className="animate-spin ..." viewBox="0 0 24 24">
	...
</svg>;

// After
import { Spinner } from "@pkg/ui";
<Spinner />;
```

#### Step 4.3: Migrate Form Components

Replace form elements with `@pkg/ui` components:

```tsx
// Before
<input
  type="email"
  name="email"
  placeholder="you@company.com"
  className="..."
/>
<button type="submit" className="...">Subscribe</button>

// After
import { Button, Input, TextField } from "@pkg/ui";
<TextField name="email" type="email">
  <Input placeholder="you@company.com" />
</TextField>
<Button type="submit">Subscribe</Button>
```

### Phase 5: Consolidate Duplicate Code

**Priority:** Low
**Estimated Effort:** 1 hour

#### Step 5.1: Consolidate Schemas

**Delete:** `apps/books/app/routes/upgrade/schemas.server.ts`

**Update:** `apps/books/app/routes/upgrade/route.tsx`

```typescript
// Before
import { upgradeSchema } from "./schemas.server";

// After
import { subscribeSchema } from "~/schemas/subscribe";
// Or rename to a more generic name like "emailCaptureSchema"
```

#### Step 5.2: Extract Form Status Hook (Future)

This is a candidate for extraction to `@pkg/hooks`. See the monorepo-level ADR for new packages.

```typescript
// Future: @pkg/hooks
export function useFetcherStatus<T extends { ok?: boolean }>(
	fetcher: ReturnType<typeof useFetcher<T>>,
): "idle" | "loading" | "success" | "failure" {
	return useMemo(() => {
		if (fetcher.state === "submitting") return "loading";
		if (fetcher.state === "loading") return "loading";
		if (fetcher.data?.ok === false) return "failure";
		if (fetcher.data?.ok === true) return "success";
		return "idle";
	}, [fetcher.state, fetcher.data]);
}
```

## Package Dependency Matrix (After Migration)

| Package              | Before | After |
| -------------------- | ------ | ----- |
| `@pkg/cn`            | No     | Yes   |
| `@pkg/get-client-ip` | Yes    | Yes   |
| `@pkg/location`      | Yes    | Yes   |
| `@pkg/logger`        | Yes    | Yes   |
| `@pkg/response`      | Yes    | Yes   |
| `@pkg/result`        | Yes    | Yes   |
| `@pkg/ui`            | No     | Yes   |
| `@pkg/validate`      | Yes    | Yes   |

## Consequences

### Positive

- **No runtime errors** - Fixing `logger.warn` calls prevents crashes
- **Consistency** - Uses same patterns as other apps
- **Less duplication** - Shared spinner and consolidated schemas
- **Type safety** - `isSuccess`/`isFailure` guards provide better type narrowing

### Negative

- **Bundle size** - `@pkg/ui` adds dependencies
- **Migration effort** - Need to update multiple files

### Neutral

- **Custom styling** - Landing page may need custom styling on top of `@pkg/ui`

## Files to Modify

### Phase 1 (Critical)

| File                                          | Change                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `apps/books/app/routes/api.subscribe.ts`      | Change `logger.warn` → `logger.info` (4 places) |
| `apps/books/app/routes/api.checkout.$type.ts` | Change `logger.warn` → `logger.info` (1 place)  |

### Phase 2

| File                                          | Change                             |
| --------------------------------------------- | ---------------------------------- |
| `apps/books/app/routes/api.checkout.$type.ts` | Use `isSuccess`/`isFailure` guards |

### Phase 3

| File                      | Change                   |
| ------------------------- | ------------------------ |
| `apps/books/package.json` | Add `@pkg/cn` dependency |

### Phase 4

| File                                                | Change                        |
| --------------------------------------------------- | ----------------------------- |
| `apps/books/package.json`                           | Add `@pkg/ui` dependency      |
| `apps/books/app/routes/_index.tsx`                  | Replace spinner, migrate form |
| `apps/books/app/components/sample-chapter-form.tsx` | Replace spinner, migrate form |
| `apps/books/app/routes/upgrade/route.tsx`           | Replace spinner, migrate form |

### Phase 5

| File                                              | Change                     |
| ------------------------------------------------- | -------------------------- |
| `apps/books/app/routes/upgrade/schemas.server.ts` | Delete (use shared schema) |
| `apps/books/app/routes/upgrade/route.tsx`         | Import from shared schema  |

## Current Progress

- [x] Phase 1: Fix logger runtime bug (Critical)
  - [x] Fix api.subscribe.ts (4 changes)
  - [x] Fix api.checkout.$type.ts (1 change)
- [x] Phase 2: Fix Result pattern usage
  - [x] Update api.checkout.$type.ts (use isSuccess/isFailure guards)
- [x] Phase 3: Add @pkg/cn
  - [x] Add package dependency
- [ ] Phase 4: Adopt @pkg/ui (Deferred)
  - [ ] Add package dependency
  - [ ] Replace loading spinner (3 files)
  - [ ] Migrate form components
- [x] Phase 5: Consolidate duplicate code
  - [ ] Consolidate schemas (deferred)
  - [x] Extract form status hook - now available in @pkg/hooks as useFetcherStatus

## Notes

- Phase 1 is critical and should be done immediately to prevent runtime errors
- The books app is a landing page, so visual regression testing is important after UI changes
- Form status hook extraction is tracked in the monorepo-level ADR for new packages
- Consider keeping some custom styling for marketing differentiation
