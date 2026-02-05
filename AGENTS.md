# Agents Guidelines

This monorepo contains multiple applications in `apps/` and shared packages in `packages/`.

## Commands

All commands run from the repository root using Bun.

### Development

```bash
bun dev              # Run dev server (from app directory)
bun build            # Build for production (from app directory)
```

### Code Quality

```bash
bun format           # Check formatting (oxfmt)
bun format:fix       # Fix formatting
bun lint             # Check linting (oxlint)
bun lint:fix         # Fix linting issues
bun typecheck        # TypeScript type checking
```

### Testing

```bash
bun test                                    # Run all tests
bun test packages/result/src/index.test.ts  # Run a single test file
bun test --watch                            # Watch mode
```

Test files use Bun's built-in test runner with `bun:test` module:

```typescript
import { describe, expect, test } from "bun:test";
```

### Database (for apps with D1)

```bash
bun run db:local:migrate   # Apply migrations locally
bun run db:remote:migrate  # Apply migrations to production
bun run orm:generate       # Generate Drizzle migrations
```

## Code Style

### Error Handling with Result Pattern

Use `@pkg/result` for operations that can fail instead of throwing exceptions:

```typescript
import { type Result, success, failure, isSuccess, isFailure } from "@pkg/result";

function divide(a: number, b: number): Result<number, Error> {
	if (b === 0) return failure(new Error("Division by zero"));
	return success(a / b);
}

let result = divide(10, 2);
if (isFailure(result)) {
	// Handle error
	return;
}
// result.data is now typed as number
```

### Validation

Use `@pkg/validate` with Zod schemas for input validation:

```typescript
import { validate } from "@pkg/validate";
import { z } from "zod";

let schema = z.object({ email: z.string().email() });
let result = await validate(request, schema);
if (isFailure(result)) {
	// Handle validation error
	return;
}
```

### Logging

Use `@pkg/logger` for request-scoped logging in routes:

```typescript
import { getLoggerFromContext } from "@pkg/logger";

export async function loader({ context }: Route.LoaderArgs) {
	let logger = getLoggerFromContext(context);
	logger.info("user.loaded", { userId: "123" });
}
```

### React Router v7 Patterns

Routes use type-safe imports from generated types:

```typescript
import type { Route } from "./+types/route-name";

export async function loader({ request, context }: Route.LoaderArgs) {
	// ...
}

export default function Component({ loaderData }: Route.ComponentProps) {
	// ...
}
```

### Environment Variables (Cloudflare Workers)

Access environment variables via `cloudflare:workers` module:

```typescript
import { env } from "cloudflare:workers";

let apiKey = env.API_KEY;
```

For local development, set variables in `.dev.vars` (gitignored).

### Workspace Package Imports

Reference workspace packages with `@pkg/` or `@apps/` prefixes:

```typescript
import { cn } from "@pkg/cn";
import { success, failure } from "@pkg/result";
```

### Path Aliases

Use `~/` alias for app-relative imports:

```typescript
import { Button } from "~/components/button";
import { getSession } from "~/middleware/session";
```

## Skills

This repository includes AI agent skills in `.agents/skills/` covering React, React Router, Cloudflare Workers, accessibility, testing, and more. Load relevant skills when working on specific features.
