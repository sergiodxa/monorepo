# @pkg/logger

Structured logging for Cloudflare Workers and other runtimes.

## Overview

This package provides two logging modes:

- **Immediate logging (`Logger`)**: Each log call outputs directly to the console
- **Batched logging (`BatchedLogger`)**: Accumulates all logs from a request and outputs them as a single entry when flushed

Batched logging is designed for Cloudflare Workers to consolidate all logs from a single execution context (request, workflow, cron job) into one log entry. This works well with Cloudflare's logging system which automatically captures request metadata.

The package includes React Router middleware for request-scoped logging, making it easy to access the logger throughout your route handlers.

## Usage

### Setting up the middleware

Create the middleware and getter in your app:

```typescript
// app/middleware/logger.ts
import { createBatchedLoggerMiddleware } from "@pkg/logger";

export let [batchedLoggerMiddleware, getLogger] = createBatchedLoggerMiddleware();
```

Register the middleware in your routes:

```typescript
// app/routes.ts
import { batchedLoggerMiddleware } from "~/middleware/logger";

export default [
	batchedLoggerMiddleware,
	// ... your routes
];
```

### Creating a logger helper

Create a helper function to access the logger from route context:

```typescript
// app/helpers/logger.ts
import type { Route } from "./+types/root";
import { getLogger } from "~/middleware/logger";

export function logger(context: Route.LoaderArgs["context"]) {
	return getLogger(context);
}
```

### Using the logger in routes

```typescript
import type { Route } from "./+types/users";
import { logger } from "~/helpers/logger";

export async function loader({ context, params }: Route.LoaderArgs) {
	let log = logger(context);

	log.info("user.fetch.started", { userId: params.id });

	let user = await getUser(params.id);

	log.info("user.fetch.completed", { userId: params.id, found: !!user });

	return { user };
}

export async function action({ request, context }: Route.ActionArgs) {
	let log = logger(context);

	let formData = await request.formData();
	let email = formData.get("email");

	log.info("user.update.started", { email });

	try {
		await updateUser(email);
		log.info("user.update.completed", { email });
	} catch (error) {
		log.error("user.update.failed", { email, error: String(error) });
		throw error;
	}
}
```

## API

### `logger`

Singleton instance of `Logger` for immediate logging outside of request contexts.

```typescript
import { logger } from "@pkg/logger";

logger.info("app.started");
logger.error("startup.failed", { reason: "missing config" });
```

### `Logger`

Immediate logger that outputs each log call directly to the console.

```typescript
import { Logger } from "@pkg/logger";

let log = new Logger();

log.info(event: string, payload?: Log.Payload): void
log.error(event: string, payload?: Log.Payload): void
```

### `BatchedLogger`

Batched logger that accumulates log entries and outputs them all at once when flushed.

```typescript
import { BatchedLogger } from "@pkg/logger";

// Factory method for HTTP requests
let log = BatchedLogger.fromRequest(request);

// Or create with a custom identifier
let log = new BatchedLogger("workflow:cleanup:abc123");

log.info(event: string, payload?: Log.Payload): void
log.error(event: string, payload?: Log.Payload): void
log.flush(): void  // Outputs all accumulated logs and clears the buffer
```

#### `BatchedLogger.fromRequest(request: Request): BatchedLogger`

Factory method that creates a logger with identifier `"METHOD URL"` (e.g., `"POST https://example.com/api/users"`).

#### `constructor(identifier: string)`

Creates a logger with a custom identifier for non-HTTP contexts like workflows or cron jobs.

#### `info(event: string, payload?: Log.Payload): void`

Adds an info-level log entry to the batch.

#### `error(event: string, payload?: Log.Payload): void`

Adds an error-level log entry to the batch.

#### `flush(): void`

Outputs all accumulated logs as a single console call and clears the buffer. Uses `console.error` if any error is present, otherwise `console.info`.

### `BatchedLogger.Event`

Type representing a single event in the batched output:

```typescript
type Event = {
	level: Log.Level;
	event: string;
	[key: string]: unknown;
};
```

### `createBatchedLoggerMiddleware()`

Creates a React Router middleware that provides a `BatchedLogger` instance for each request.

```typescript
import { createBatchedLoggerMiddleware } from "@pkg/logger";

let [middleware, getter] = createBatchedLoggerMiddleware();
```

Returns a tuple of:

- `middleware: MiddlewareFunction<Response>` - The middleware to add to your routes
- `getter: (context) => BatchedLogger` - Function to retrieve the logger from context

The middleware automatically flushes the logger after the handler completes (including on errors).

### `Log` namespace

Type definitions for logging:

```typescript
namespace Log {
	type Payload = Record<string, unknown>;
	type Level = "info" | "error";
	type Entry = { level: Level; event: string; payload?: Payload };
}
```

## Patterns

### Middleware setup

```typescript
// app/middleware/logger.ts
import { createBatchedLoggerMiddleware } from "@pkg/logger";

export let [batchedLoggerMiddleware, getLogger] = createBatchedLoggerMiddleware();

// app/helpers/logger.ts
import type { Route } from "./+types/root";
import { getLogger } from "~/middleware/logger";

export function logger(context: Route.LoaderArgs["context"]) {
	return getLogger(context);
}
```

### Action/loader logging

```typescript
export async function loader({ context, params }: Route.LoaderArgs) {
	let log = logger(context);

	log.info("resource.load", { resourceId: params.id });

	let result = await fetchResource(params.id);

	if (isFailure(result)) {
		log.error("resource.load.failed", {
			resourceId: params.id,
			error: result.error.message,
		});
		throw new Response("Not found", { status: 404 });
	}

	return { resource: result.data };
}
```

### Error logging with structured data

```typescript
export async function action({ request, context }: Route.ActionArgs) {
	let log = logger(context);
	let formData = await request.formData();

	try {
		let result = await processForm(formData);

		if (isFailure(result)) {
			log.error("form.validation.failed", {
				errors: result.error.flatten(),
			});
			return { errors: result.error.flatten() };
		}

		log.info("form.submitted", { id: result.data.id });
		return redirect(`/success/${result.data.id}`);
	} catch (error) {
		log.error("form.unexpected.error", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	}
}
```

## Related Packages

- `@pkg/jobs` - Uses `BatchedLogger` for job execution logging
- `@pkg/result` - Commonly used with logger for error tracking and control flow

## Tips

1. **Use batched logging in request contexts** - Consolidates all logs from a request into one entry, making it easier to trace request flow in Cloudflare's logging dashboard.

2. **Use the singleton logger for non-request contexts** - For cron jobs, `entry.server.tsx` error handling, or other contexts without middleware, use the exported `logger` singleton.

3. **Always include relevant context in log payloads** - Add `userId`, `routeName`, `resourceId`, or other identifiers to help with debugging and filtering logs.

4. **The logger automatically flushes when middleware completes** - You don't need to manually call `flush()` when using the middleware; it handles this in the `finally` block.
