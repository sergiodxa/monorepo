# ADR-001: Package Consistency for Auth Application

## Status

**Proposed** - 2026-02-16

## Background

The monorepo contains shared packages in `packages/` that provide common functionality across applications. The `apps/uptime/` application serves as the reference implementation, fully leveraging these packages for consistency and code reuse.

The `apps/auth/` application currently uses some packages but has local implementations that duplicate package functionality. This ADR documents the plan to achieve consistency with the rest of the monorepo.

## Context

### Current Package Usage

The auth app currently uses these workspace packages:

| Package              | Used | Purpose                                                         |
| -------------------- | ---- | --------------------------------------------------------------- |
| `@pkg/db-helpers`    | Yes  | `pk`, `fk`, `timestamp`, `url`, `email` column helpers          |
| `@pkg/get-client-ip` | Yes  | Extract client IP from requests                                 |
| `@pkg/logger`        | Yes  | Request-scoped batched logging                                  |
| `@pkg/result`        | Yes  | Result pattern (`success`, `failure`, `isSuccess`, `isFailure`) |
| `@pkg/validate`      | Yes  | Input validation with Zod schemas                               |

### Missing Package Adoption

| Package         | Status              | Reason                                                            |
| --------------- | ------------------- | ----------------------------------------------------------------- |
| `@pkg/response` | Has local duplicate | `app/helpers/response.ts` provides `ok`, `badRequest`, `notFound` |
| `@pkg/cn`       | Not used            | No complex class name logic currently                             |
| `@pkg/ui`       | Not used            | Custom minimal UI for OAuth consent pages                         |

### Issues Identified

#### 1. Duplicate Response Helpers

**File:** `apps/auth/app/helpers/response.ts`

```typescript
export const StatusCode = {
	Ok: 200 as const,
	BadRequest: 400 as const,
	NotFound: 404 as const,
};

export function ok<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data({ ...value, status: StatusCode.Ok }, { ...init, status: StatusCode.Ok });
}

export function badRequest<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data(
		{ ...value, status: StatusCode.BadRequest },
		{ ...init, status: StatusCode.BadRequest },
	);
}

export function notFound<T>(value: T, init?: ResponseInitWithoutStatus) {
	return data({ ...value, status: StatusCode.NotFound }, { ...init, status: StatusCode.NotFound });
}
```

**Issue:** This duplicates `@pkg/response` which provides `ok`, `badRequest`, `notFound`, and many more response helpers.

**Difference:** The local implementation adds `status: number` to the response body. The package adds `ok: boolean` discriminator instead.

#### 2. Files Using Local Response Helpers

- `apps/auth/app/routes/authorize.tsx` (lines 8)
- `apps/auth/app/routes/auth.$provider.callback.tsx` (line 4)

## Decision

### 1. Migrate to @pkg/response

Replace the local `app/helpers/response.ts` with `@pkg/response`.

**API Change:**

```typescript
// Before (local)
return ok({ message: "Success" });
// Response: { message: "Success", status: 200 }

// After (@pkg/response)
return ok({ message: "Success" });
// Response: { message: "Success", ok: true }
```

The `ok: boolean` discriminator is more useful for client-side type narrowing than `status: number`.

### 2. Add @pkg/cn

Add `@pkg/cn` for any future class name manipulation needs and consistency with other apps.

### 3. Adopt @pkg/ui Incrementally

The auth app has minimal UI (OAuth consent pages, login forms). Adopt `@pkg/ui` for:

- Form components (`TextField`, `Button`, `Label`, `FieldError`)
- Layout components where applicable
- Keep OAuth-specific styling for consent pages

### 4. Standardize Logger Wrapper

Ensure the logger middleware wrapper is consistent with other apps:

```typescript
export const logger = {
	info: (event: string, payload?: Record<string, unknown>) => getLogger().info(event, payload),
	error: (event: string, payload?: Record<string, unknown>) => getLogger().error(event, payload),
};
```

Note: No `warn` method - use `info` for expected issues, `error` for unexpected failures.

## Implementation Phases

### Phase 1: Migrate to @pkg/response

**Priority:** High
**Estimated Effort:** 1 hour

#### Step 1.1: Add Package Dependency

**File:** `apps/auth/package.json`

Add to dependencies:

```json
{
	"dependencies": {
		"@pkg/response": "workspace:*"
	}
}
```

#### Step 1.2: Update Route Imports

**File:** `apps/auth/app/routes/authorize.tsx`

```typescript
// Before
import { badRequest, notFound, ok, StatusCode } from "~/helpers/response";

// After
import { badRequest, notFound, ok } from "@pkg/response";
```

**File:** `apps/auth/app/routes/auth.$provider.callback.tsx`

```typescript
// Before
import { badRequest } from "~/helpers/response";

// After
import { badRequest } from "@pkg/response";
```

#### Step 1.3: Update Response Body Consumers

Any code checking `response.status === 200` should be updated to check `response.ok === true`.

Search for patterns like:

```typescript
// Before
if (data.status === StatusCode.Ok) { ... }

// After
if (data.ok) { ... }
```

#### Step 1.4: Delete Local Helper

**Delete:** `apps/auth/app/helpers/response.ts`

#### Step 1.5: Verify

Run the app locally and test:

- Login flow
- OAuth authorization flow
- Error responses

### Phase 2: Add @pkg/cn

**Priority:** Low
**Estimated Effort:** 15 minutes

#### Step 2.1: Add Package Dependency

**File:** `apps/auth/package.json`

```json
{
	"dependencies": {
		"@pkg/cn": "workspace:*"
	}
}
```

#### Step 2.2: Use Where Applicable

Replace any inline class name logic with `cn()`:

```typescript
// Before
<div className={`button ${isPrimary ? 'button-primary' : ''}`}>

// After
import { cn } from "@pkg/cn";
<div className={cn("button", isPrimary && "button-primary")}>
```

### Phase 3: Adopt @pkg/ui

**Priority:** Medium
**Estimated Effort:** 4-8 hours

This phase is incremental and can be done over time.

#### Step 3.1: Add Package Dependency

**File:** `apps/auth/package.json`

```json
{
	"dependencies": {
		"@pkg/ui": "workspace:*"
	}
}
```

#### Step 3.2: Migrate Form Components

Replace custom form elements with `@pkg/ui` components:

| Current        | Replace With               |
| -------------- | -------------------------- |
| `<input>`      | `<Input>` or `<TextField>` |
| `<button>`     | `<Button>`                 |
| `<label>`      | `<Label>`                  |
| Error messages | `<FieldError>`             |

#### Step 3.3: Migrate to Component Patterns

Example migration for a login form:

```tsx
// Before
<form method="post">
	<label htmlFor="email">Email</label>
	<input type="email" name="email" id="email" />
	{errors.email && <span className="error">{errors.email}</span>}
	<button type="submit">Login</button>
</form>;

// After
import { Button, FieldError, Input, Label, TextField } from "@pkg/ui";

<form method="post">
	<TextField name="email" type="email" isInvalid={!!errors.email}>
		<Label>Email</Label>
		<Input />
		<FieldError>{errors.email}</FieldError>
	</TextField>
	<Button type="submit">Login</Button>
</form>;
```

#### Step 3.4: Keep OAuth Consent Page Styling

The OAuth consent page has specific UX requirements. Consider keeping custom styling but using `@pkg/ui` primitives for interactive elements.

### Phase 4: Verify Logger Consistency

**Priority:** Low
**Estimated Effort:** 15 minutes

#### Step 4.1: Check Logger Wrapper

**File:** `apps/auth/app/middleware/logger.ts`

Ensure it follows the standard pattern:

```typescript
import { createBatchedLoggerMiddleware, type BatchedLogger } from "@pkg/logger";
import { getContext } from "./context-storage";

let [loggerMiddleware, getLoggerFromContext] = createBatchedLoggerMiddleware();
export { loggerMiddleware };

export function getLogger(): BatchedLogger {
	return getLoggerFromContext(getContext());
}

export const logger = {
	info: (event: string, payload?: Record<string, unknown>) => getLogger().info(event, payload),
	error: (event: string, payload?: Record<string, unknown>) => getLogger().error(event, payload),
};
```

#### Step 4.2: Audit Logger Usage

Search for any `logger.warn()` calls and change to `logger.info()` or `logger.error()`:

```bash
grep -r "logger.warn" apps/auth/
```

## Package Dependency Matrix (After Migration)

| Package              | Before | After                         |
| -------------------- | ------ | ----------------------------- |
| `@pkg/auth-sdk`      | No     | No (this IS the auth service) |
| `@pkg/cn`            | No     | Yes                           |
| `@pkg/db-helpers`    | Yes    | Yes                           |
| `@pkg/get-client-ip` | Yes    | Yes                           |
| `@pkg/logger`        | Yes    | Yes                           |
| `@pkg/response`      | No     | Yes                           |
| `@pkg/result`        | Yes    | Yes                           |
| `@pkg/ui`            | No     | Yes                           |
| `@pkg/validate`      | Yes    | Yes                           |

## Consequences

### Positive

- **Consistency** - Auth app follows same patterns as uptime and other apps
- **Less code to maintain** - Shared packages are maintained once
- **Type safety** - `@pkg/response` provides better type discrimination with `ok` boolean
- **Accessible UI** - `@pkg/ui` components are built with React Aria for accessibility

### Negative

- **API change** - Response body changes from `status: number` to `ok: boolean`
- **Migration effort** - Need to update route files and test thoroughly
- **Bundle size** - `@pkg/ui` adds dependencies (though tree-shaking should help)

### Neutral

- **OAuth consent UI** - May need custom styling on top of `@pkg/ui` components
- **Learning curve** - Developers need to learn `@pkg/ui` component API

## Files to Modify

### Phase 1

| File                                               | Change                         |
| -------------------------------------------------- | ------------------------------ |
| `apps/auth/package.json`                           | Add `@pkg/response` dependency |
| `apps/auth/app/routes/authorize.tsx`               | Update imports                 |
| `apps/auth/app/routes/auth.$provider.callback.tsx` | Update imports                 |
| `apps/auth/app/helpers/response.ts`                | Delete file                    |

### Phase 2

| File                     | Change                   |
| ------------------------ | ------------------------ |
| `apps/auth/package.json` | Add `@pkg/cn` dependency |

### Phase 3

| File                                 | Change                   |
| ------------------------------------ | ------------------------ |
| `apps/auth/package.json`             | Add `@pkg/ui` dependency |
| `apps/auth/app/routes/login.tsx`     | Migrate form components  |
| `apps/auth/app/routes/authorize.tsx` | Migrate UI components    |
| Various route files                  | Migrate as needed        |

### Phase 4

| File                                 | Change             |
| ------------------------------------ | ------------------ |
| `apps/auth/app/middleware/logger.ts` | Verify consistency |

## Current Progress

- [ ] Phase 1: Migrate to @pkg/response
  - [ ] Add package dependency
  - [ ] Update route imports
  - [ ] Update response body consumers
  - [ ] Delete local helper
  - [ ] Verify functionality
- [ ] Phase 2: Add @pkg/cn
  - [ ] Add package dependency
  - [ ] Use where applicable
- [ ] Phase 3: Adopt @pkg/ui
  - [ ] Add package dependency
  - [ ] Migrate form components
  - [ ] Migrate layout components
- [ ] Phase 4: Verify logger consistency
  - [ ] Check logger wrapper
  - [ ] Audit logger usage

## Notes

- The auth app is security-critical; thorough testing is required after each phase
- OAuth flows should be tested end-to-end after migration
- Consider keeping OAuth consent page styling minimal for security perception
- The `@pkg/ui` adoption can be gradual - start with forms, expand as needed
