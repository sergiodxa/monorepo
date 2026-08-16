# @pkg/logger

Structured logging for Cloudflare Workers and other runtimes.

## Overview

This package provides three logging modes:

- **Immediate logging (`Logger`)**: Each log call outputs directly to the console
- **Batched logging (`BatchedLogger`)**: Accumulates all logs from an execution context and outputs them as a single entry when flushed
- **Request logging (`RequestLogger`)**: A request-scoped logger that groups events into named scopes (middleware, loaders, actions, render) and flushes them as one entry with request/response metadata

Batched logging is designed for Cloudflare Workers to consolidate all logs from a single execution context (request, workflow, cron job) into one log entry. This works well with Cloudflare's logging system which automatically captures request metadata.

Request logging builds on batched logging: each scope is its own batched logger, so parallel work can log independently without interleaving, and the whole request lands in the dashboard as a single searchable entry with Cloudflare, user, and billing context attached.

### Entry points

| Import                   | Exports                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| `@pkg/logger`            | `Logger` (immediate), `logger` singleton, `BatchedLogger`, `RequestLogger`, `Log` |
| `@pkg/logger/middleware` | `logger`, the request-logging middleware (also the default export)                |
| `@pkg/logger/batched`    | `Logger` (batched)                                                                |
| `@pkg/logger/request`    | `Logger` (request-scoped)                                                         |

`BatchedLogger` and `RequestLogger` from the root are aliases of the `Logger` classes exported by the `/batched` and `/request` subpaths. Import from the root when you need more than one of them in the same file.

The package has no runtime dependencies. `remix` is a devDependency only: the middleware imports `Middleware` with `import type`, so nothing from remix survives into the emitted code.

## Usage

### Immediate logging

For anything outside a request or job — service modules, bootstrap code, one-off scripts — use the exported singleton:

```typescript
import { logger } from "@pkg/logger";

logger.info("app.started");
logger.error("startup.failed", { reason: "missing config" });
```

### Batched logging

For a self-contained unit of work with a known identifier — a queue message, a cron run, a workflow step:

```typescript
import { BatchedLogger } from "@pkg/logger";

let log = new BatchedLogger("cron:daily-cleanup");

log.info("cleanup.started");
let deleted = await deleteExpiredSessions();
log.info("cleanup.completed", { deleted });

log.flush();
```

`flush()` is a no-op when nothing was logged, and picks `console.error` over `console.info` if any entry was an error.

### Request logging

Add the middleware to your router and every handler logs through `ctx.logger` instead of the console:

```typescript
// bootstrap/worker.ts
import { logger } from "@pkg/logger/middleware";

let router = createRouter({ middleware: [logger] });
```

Register it as the outermost middleware so every later middleware and handler can reach it. It is also the module's default export, if you prefer `import logger from "@pkg/logger/middleware"`.

Importing the middleware is also what gives you the type. The `declare module "remix/router"` augmentation that adds `logger` to `RequestContext` ships from the middleware module itself rather than an ambient `.d.ts`, because ambient declarations are not pulled in transitively — a consumer only picks up the type by importing the module it comes with.

### Using scoped loggers

Each scope returns a `BatchedLogger` of its own, so concurrent work never interleaves:

```typescript
// In a middleware
let log = ctx.logger.middleware("session");
log.info("session.read", { subject: session.subject });

// In a read handler
let log = ctx.logger.loader("/dashboard/tenants");
log.info("tenants.loaded", { count: tenants.length });

// In a write handler
let log = ctx.logger.action("/dashboard/tenants");
log.error("tenant.create.failed", { error: result.error.message });

// Around rendering
let log = ctx.logger.render;
log.info("render.complete");
```

Attach request-wide context as you learn it, and it shows up at the top level of the flushed entry:

```typescript
ctx.logger.subject = { id: user.id, email: user.email };
ctx.logger.profile = { role: membership.role, teamId: team.id };
ctx.logger.billing = { polarId: customer.polarId, plan: subscription.plan };
```

## API

### `logger`

Singleton instance of `Logger` for immediate logging outside of request contexts.

```typescript
import { logger } from "@pkg/logger";

logger.info("app.started");
```

### `Logger` (immediate)

Immediate logger that outputs each log call directly to the console. Each call emits `{ ...payload, event, timestamp }`.

```typescript
import { Logger } from "@pkg/logger";

let log = new Logger();

log.info(event: string, payload?: Log.Payload): void
log.error(event: string, payload?: Log.Payload): void
```

### `Logger` (batched)

Available as `BatchedLogger` from `@pkg/logger` or `Logger` from `@pkg/logger/batched`. Accumulates log entries and outputs them all at once when flushed.

```typescript
import { Logger } from "@pkg/logger/batched";

// Factory method for HTTP requests
let log = Logger.fromRequest(request);

// Or create with a custom identifier
let log = new Logger("workflow:cleanup:abc123");
```

#### `Logger.fromRequest(request: Request): Logger`

Creates a logger with identifier `"METHOD URL"` (e.g. `"POST https://example.com/api/users"`).

#### `new Logger(identifier: string)`

Creates a logger with a custom identifier for non-HTTP contexts like workflows or cron jobs.

#### `info(event: string, payload?: Log.Payload): void`

Adds an info-level log entry to the batch.

#### `error(event: string, payload?: Log.Payload): void`

Adds an error-level log entry to the batch.

#### `get events(): Logger.Event[]`

The accumulated entries, each flattened to `{ level, event, ...payload }`.

#### `get hasEvents(): boolean`

Whether anything has been logged yet.

#### `get hasError(): boolean`

Whether any accumulated entry is error-level.

#### `toJSON(): Logger.Output`

Returns `{ timestamp, events }`.

#### `flush(): void`

Outputs all accumulated logs as a single console call and clears the buffer. Does nothing when no events were recorded. Uses `console.error` if any error is present, otherwise `console.info`.

### `Logger.Event` (batched)

Type representing a single event in the batched output:

```typescript
type Event = {
	level: Log.Level;
	event: string;
	[key: string]: unknown;
};
```

### `Logger` (request)

Available as `RequestLogger` from `@pkg/logger` or `Logger` from `@pkg/logger/request`.

```typescript
class Logger {
	constructor(request: Request);

	// Context setters
	set subject(subject: Logger.Subject);
	set profile(profile: Logger.Profile);
	set billing(billing: Logger.Billing);
	set response(response: Response);

	// Scoped loggers (each is an independent BatchedLogger)
	middleware(name: string): BatchedLogger;
	loader(id: string): BatchedLogger;
	action(id: string): BatchedLogger;
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

The constructor captures the request method, URL, filtered headers, and Cloudflare `cf` properties, and starts a duration timer. The entry `id` is the `cf-ray` header when present, otherwise a random UUID.

`middleware(name)`, `loader(id)`, and `action(id)` are get-or-create: calling them twice with the same key returns the same scoped logger, so a handler can grab its logger in several places without splitting the output. Only one action scope exists per request. `render` is a lazily created scope for work done while producing the response body.

The scope names come from the phases a request goes through: `middleware` for anything in the middleware chain, `loader` for handlers that read, `action` for handlers that write, and `render` for response generation. The `id` you pass is free-form — apps in this repo pass the route path, e.g. `"/dashboard/tenants"`.

`flush()` writes one console entry with `identifier` as the message and `toJSON()` as the payload, using `console.error` if any scope recorded an error. Unlike the batched logger it does not clear its buffer, so call it exactly once per request.

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

### `logger` (middleware)

The request-logging middleware, from `@pkg/logger/middleware` as either a named or a default export. It is a `Middleware` from `remix/router`.

```typescript
import { logger } from "@pkg/logger/middleware";

let router = createRouter({ middleware: [logger] });
```

For each request it:

- Constructs `new Logger(ctx.request)` from `@pkg/logger/request` and assigns it to `ctx.logger`
- On success, assigns the downstream response to `ctx.logger.response` and returns it
- On a throw, logs `unhandled_error` with `error` (the message, or `String(error)` for non-`Error` throws) and `stack`, then re-throws
- Calls `ctx.logger.flush()` in a `finally` block, so both paths flush exactly once

The module also declares the `RequestContext` augmentation that types `ctx.logger`, so importing the middleware is what brings the type along with it.

### `Log` namespace

Type definitions shared by the immediate and batched loggers:

```typescript
namespace Log {
	type Payload = Record<string, unknown>;
	type Level = "info" | "error";
	type Entry = { level: Level; event: string; payload?: Payload };
}
```

## Output format

A flushed request logger produces one console line plus one JSON payload:

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
		"session": [{ "level": "info", "event": "session.read" }]
	},
	"loaders": {
		"/app/team-1/monitors": [{ "level": "info", "event": "monitors.loaded" }]
	},
	"render": [{ "level": "info", "event": "render.complete" }]
}
```

Empty scopes are omitted, and `request.cf` is dropped when the request has no Cloudflare properties (local runs, tests).

## Patterns

### Request middleware

Apps that serve HTTP put `logger` from `@pkg/logger/middleware` at the head of the router's middleware stack and log through `ctx.logger` from there on. Construct a `Logger` from `@pkg/logger/request` directly only when you are outside a router — a Durable Object, a custom `fetch` handler — and then you own the `response` assignment and the `flush()` in a `finally` yourself.

### Handler logging

```typescript
async function handler(ctx: RequestContext) {
	let log = ctx.logger.loader("/monitors/:id");

	log.info("monitor.load", { monitorId: ctx.params.id });

	let result = await fetchMonitor(ctx.params.id);

	if (isFailure(result)) {
		log.error("monitor.load.failed", {
			monitorId: ctx.params.id,
			error: result.error.message,
		});
		throw new Response("Not found", { status: 404 });
	}

	return ctx.render(<Monitor monitor={result.data} />);
}
```

### Error logging with structured data

```typescript
async function handler(ctx: RequestContext) {
	let log = ctx.logger.action("/settings");
	let formData = await ctx.request.formData();

	try {
		let result = await processForm(formData);

		if (isFailure(result)) {
			log.error("form.validation.failed", { errors: result.error.flatten() });
			return ctx.render(<Settings errors={result.error.flatten()} />);
		}

		log.info("form.submitted", { id: result.data.id });
		return ctx.redirect(`/success/${result.data.id}`);
	} catch (error) {
		log.error("form.unexpected.error", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});
		throw error;
	}
}
```

### Background jobs

`@pkg/jobs` constructs a `BatchedLogger` per job, named after the job id, and flushes it when the job settles. Inside a job, log through `this.logger`:

```typescript
export class CleanupJob extends Job {
	async perform() {
		this.logger.info("cleanup.started");
		let deleted = await deleteExpiredSessions();
		this.logger.info("cleanup.completed", { deleted });
	}
}
```

### Testing

Handlers and jobs that take a logger can be tested with a real `BatchedLogger` — nothing is written to the console until `flush()` is called, and `events` exposes what was recorded:

```typescript
import { BatchedLogger } from "@pkg/logger";

let logger = new BatchedLogger("test");

await performWork({ logger });

expect(logger.events).toContainEqual({ level: "info", event: "work.completed" });
```

## Header filtering

The request logger records only non-sensitive headers.

**Included request headers**: `content-type`, `accept`, `accept-language`, `accept-encoding`, `user-agent`, `referer`, `origin`, `x-forwarded-for`, `x-real-ip`, `x-forwarded-proto`, `x-forwarded-host`, `x-request-id`, `x-correlation-id`

**Excluded request headers**: `authorization`, `cookie`, `x-api-key`, `x-auth-token`, and any containing `secret`, `token`, `key`, `password`, `credential`

**Included response headers**: `content-type`, `content-length`, `content-encoding`, `cache-control`, `etag`, `last-modified`, `location`, `x-request-id`, `cf-ray`, `server-timing`

**Excluded response headers**: `set-cookie` — the value carries session data, but the names alone are what you need to debug session and auth issues, so they are surfaced separately as `set-cookie-names`.

## Related Packages

- [`@pkg/jobs`](/packages/jobs) - Constructs a `BatchedLogger` per job execution
- [`@pkg/result`](/packages/result) - Result type commonly paired with the logger for error tracking and control flow

## Tips

1. **Use the middleware in HTTP contexts** - `@pkg/logger/middleware` consolidates every scope of a request into one entry, making it easy to trace a request in Cloudflare's logging dashboard.

2. **Use the singleton logger for module-level code** - Service modules and bootstrap code have no request or job context to log through; import `logger` from `@pkg/logger` there.

3. **Name scopes after the thing doing the work** - A middleware name or a route path makes the flushed entry readable; a generic name makes every request look the same.

4. **Always include relevant context in log payloads** - Add `userId`, `teamId`, `resourceId`, or other identifiers to help with debugging and filtering logs.

5. **Flush in a `finally` block** - The middleware already does this for requests; if you flush a logger yourself, do the same, since errors are the logs you most want and flushing outside a `finally` loses them exactly when something throws.

6. **Never log credentials** - Header filtering protects the request metadata, not your payloads. Tokens, authorization codes, client secrets, and password material must never reach a log payload.
