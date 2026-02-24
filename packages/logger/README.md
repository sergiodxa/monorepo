# @pkg/logger

Structured logging for Cloudflare Workers and other runtimes.

## Overview

This package provides three logging modes:

- **Immediate logging (`Logger`)**: Each log call outputs directly to the console
- **Batched logging (`BatchedLogger`)**: Accumulates all logs from a request and outputs them as a single entry when flushed
- **Request logging (`RequestLogger`)**: Structured logging optimized for React Router HTTP requests with scoped logging for middleware, loaders, actions, and render phases

Batched logging is designed for Cloudflare Workers to consolidate all logs from a single execution context (request, workflow, cron job) into one log entry. This works well with Cloudflare's logging system which automatically captures request metadata.

Request logging provides parallel-safe scoped logging and rich context capture including request/response metadata, Cloudflare data, and user/billing information.

## Usage

### Setting up the middleware

Create the middleware and getter in your app:

```typescript
// app/middleware/logger.ts
import { createBatchedLoggerMiddleware } from "@pkg/logger/batched";

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

### `Logger` (batched)

Batched logger that accumulates log entries and outputs them all at once when flushed.

```typescript
import { Logger } from "@pkg/logger/batched";

// Factory method for HTTP requests
let log = Logger.fromRequest(request);

// Or create with a custom identifier
let log = new Logger("workflow:cleanup:abc123");

log.info(event: string, payload?: Log.Payload): void
log.error(event: string, payload?: Log.Payload): void
log.flush(): void  // Outputs all accumulated logs and clears the buffer
```

#### `Logger.fromRequest(request: Request): Logger`

Factory method that creates a logger with identifier `"METHOD URL"` (e.g., `"POST https://example.com/api/users"`).

#### `constructor(identifier: string)`

Creates a logger with a custom identifier for non-HTTP contexts like workflows or cron jobs.

#### `info(event: string, payload?: Log.Payload): void`

Adds an info-level log entry to the batch.

#### `error(event: string, payload?: Log.Payload): void`

Adds an error-level log entry to the batch.

#### `flush(): void`

Outputs all accumulated logs as a single console call and clears the buffer. Uses `console.error` if any error is present, otherwise `console.info`.

### `Logger.Event` (batched)

Type representing a single event in the batched output:

```typescript
type Event = {
	level: Log.Level;
	event: string;
	[key: string]: unknown;
};
```

### `createBatchedLoggerMiddleware()`

Creates a React Router middleware that provides a `Logger` instance for each request.

```typescript
import { createBatchedLoggerMiddleware } from "@pkg/logger/batched";

let [middleware, getter] = createBatchedLoggerMiddleware();
```

Returns a tuple of:

- `middleware: MiddlewareFunction<Response>` - The middleware to add to your routes
- `getter: (context) => Logger` - Function to retrieve the logger from context

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
import { createBatchedLoggerMiddleware } from "@pkg/logger/batched";

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

## Request Logger

`Logger` from `@pkg/logger/request` is optimized for React Router HTTP requests with scoped logging for parallel-safe loader execution.

### Creating a logger helper

Create a helper function to access the logger from route context:

```typescript
// app/middleware/logger.ts
import { Logger } from "@pkg/logger/request";
import { getContext } from "./context-storage";

export function logger(): Logger {
	return Logger.getFromContext(getContext());
}
```

### Setup in entry.worker.ts

Initialize the logger before React Router processes the request:

```typescript
// entry.worker.ts
import { Logger } from "@pkg/logger/request";
import { createRequestHandler, RouterContextProvider } from "react-router";

let handler: ReturnType<typeof createRequestHandler>;

export default {
	async fetch(request: Request) {
		let build = await import("virtual:react-router/server-build");
		if (!handler) handler = createRequestHandler(build, import.meta.env.MODE);

		let context = new RouterContextProvider();
		let log = new Logger(request);
		context.set(Logger.context, log);

		try {
			let response = await handler(request, context);
			log.response = response;
			return response;
		} catch (error) {
			log.error("request.unhandled_error", {
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			log.flush();
		}
	},
};
```

### Using scoped loggers

#### In middleware

```typescript
export const middleware: Route.MiddlewareFunction[] = [
	async ({ context }, next) => {
		let log = logger().middleware("auth");
		log.info("auth.start");

		// Set user context
		logger().subject = { id: user.id, email: user.email };
		logger().profile = { role: membership.role, teamId: team.id };
		logger().billing = { polarId: customer.polarId, plan: subscription.plan };

		log.info("auth.complete");
		return await next();
	},
];
```

#### In loaders (parallel-safe)

```typescript
export async function loader({ context }: Route.LoaderArgs) {
	let log = logger().loader("$team");

	log.info("team.loader.start", { teamId: team.id });
	let memberships = await db.query.memberships.findMany({ ... });
	log.info("team.loader.complete", { membershipCount: memberships.length });

	return { memberships };
}
```

#### In actions

```typescript
export async function action({ request }: Route.ActionArgs) {
	let log = logger().action("$team.settings");

	log.info("settings.update.start");
	// ... handle form
	log.info("settings.update.success");

	return redirect("/settings");
}
```

#### In entry.server.tsx

```typescript
import { logger } from "~/middleware/logger";

export default async function handleRequest(..., routerContext) {
	let log = logger().render;

	log.info("render.start");

	let stream = await renderToReadableStream(..., {
		onError(error) {
			log.error("render.error", { error: String(error) });
		},
	});

	log.info("render.complete");

	return new Response(stream, { status, headers });
}
```

### Output format

```
GET https://example.com/app/team-1/monitors 200
```

```json
{
	"id": "abc123-DFW",
	"timestamp": 123.45,
	"duration": 145,
	"request": {
		"method": "GET",
		"url": {
			"protocol": "https:",
			"hostname": "example.com",
			"pathname": "/app/team-1/monitors",
			"search": ""
		},
		"headers": { "user-agent": "Mozilla/5.0..." },
		"cf": {
			"colo": "DFW",
			"country": "US",
			"city": "Austin"
		}
	},
	"response": { "status": 200, "headers": {} },
	"subject": { "id": "user_123", "email": "..." },
	"profile": { "role": "admin", "teamId": "team_456" },
	"billing": { "polarId": "cust_abc", "plan": "pro" },
	"middleware": {
		"auth": [{ "level": "info", "event": "auth.complete" }]
	},
	"loaders": {
		"$team": [{ "level": "info", "event": "team.loaded" }]
	},
	"render": [{ "level": "info", "event": "render.complete" }]
}
```

### API

#### `Logger` (request)

```typescript
class Logger {
	// Static context for React Router
	static context: Context<Logger>;
	static getFromContext(context: RouterContextProvider): Logger;

	constructor(request: Request);

	// Context setters
	set subject(subject: Logger.Subject);
	set profile(profile: Logger.Profile);
	set billing(billing: Logger.Billing);
	set response(response: Response);

	// Scoped loggers (parallel-safe, returns BatchedLogger)
	middleware(name: string): BatchedLogger;
	loader(routeId: string): BatchedLogger;
	action(routeId: string): BatchedLogger;
	get render(): BatchedLogger;

	// Unscoped logging (for catch blocks, edge cases)
	info(event: string, payload?: Record<string, unknown>): void;
	error(event: string, payload?: Record<string, unknown>): void;

	// Output
	get identifier(): string; // "METHOD URL STATUS"
	toJSON(): Logger.Output;
	flush(): void;
}
```

Scoped loggers return `Logger` from `@pkg/logger/batched` (aliased as `BatchedLogger` when importing from `@pkg/logger`).

#### Namespace types (request)

```typescript
namespace Logger {
	interface Subject {
		id: string;
		[key: string]: unknown;
	}
	interface Profile {
		[key: string]: unknown;
	}
	interface Billing {
		polarId: string;
		[key: string]: unknown;
	}
	interface CloudflareInfo {
		colo: string;
		country: string | null;
		city: string | null;
		region: string | null;
		timezone: string;
		asn: number;
		asOrganization: string;
		httpProtocol: string;
		tlsVersion: string;
	}
	interface RequestInfo {
		url: {
			protocol: string;
			hostname: string;
			pathname: string;
			search: string;
		};
		method: string;
		headers: Record<string, string>;
		cf?: CloudflareInfo;
	}
	interface ResponseInfo {
		status: number;
		headers: Record<string, string>;
	}
	interface Event {
		level: "info" | "error";
		event: string;
		[key: string]: unknown;
	}
	interface Output {
		id: string;
		timestamp: number;
		duration: number;
		request: RequestInfo;
		response?: ResponseInfo;
		subject?: Subject;
		profile?: Profile;
		billing?: Billing;
		middleware?: Record<string, Event[]>;
		loaders?: Record<string, Event[]>;
		action?: { routeId: string; events: Event[] };
		render?: Event[];
		events?: Event[];
	}
}
```

### Header filtering

**Included request headers**: `content-type`, `accept`, `accept-language`, `accept-encoding`, `user-agent`, `referer`, `origin`, `x-forwarded-for`, `x-real-ip`, `x-forwarded-proto`, `x-forwarded-host`, `x-request-id`, `x-correlation-id`

**Excluded request headers**: `authorization`, `cookie`, `x-api-key`, `x-auth-token`, and any containing `secret`, `token`, `key`, `password`, `credential`

**Included response headers**: `content-type`, `content-length`, `content-encoding`, `cache-control`, `etag`, `last-modified`, `x-request-id`, `cf-ray`, `server-timing`

**Excluded response headers**: `set-cookie`
