# ADR-004: RequestLogger for React Router

## Status

**Proposed** - 2026-02-24

## Background

The `@pkg/logger` package currently provides logging utilities:

1. **`Logger`** - Singleton wrapper around `console.info/error` with timestamps
2. **`BatchedLogger`** - Accumulates events and outputs them as a single log on flush
3. **`createBatchedLoggerMiddleware`** - React Router middleware that provides BatchedLogger per request

The `BatchedLogger` works well for background jobs (workflows, cron, queues) but is not optimized for HTTP request contexts. It doesn't capture request/response metadata, doesn't integrate with authentication, and doesn't organize logs by the React Router lifecycle phases (middleware, loaders, actions, render).

## Context

### Current Limitations

1. **Flat event structure**: All events go into a single array regardless of whether they came from middleware, loaders, actions, or the render phase.

2. **No request context**: Request metadata (URL, method, headers, Cloudflare data) must be manually logged.

3. **No user/auth integration**: No standard way to attach authenticated user data to logs.

4. **Parallel loader issues**: Loaders run in parallel. If two loaders both log, there's no way to know which loader produced which log.

5. **Middleware timing**: Logger is initialized in middleware, so `entry.server.tsx` errors can't be logged.

### Desired Output Structure

```
GET https://uptime.sergiodxa.com/app/team-1/monitors 200
```

```json
{
	"id": "req_abc123",
	"timestamp": 1738590000000,
	"duration": 145,
	"request": {
		"method": "GET",
		"url": {
			"protocol": "https:",
			"hostname": "uptime.sergiodxa.com",
			"pathname": "/app/team-1/monitors",
			"search": ""
		},
		"headers": {
			"user-agent": "Mozilla/5.0...",
			"accept": "text/html,application/xhtml+xml..."
		},
		"cf": {
			"colo": "DFW",
			"country": "US",
			"city": "Austin",
			"region": "Texas",
			"timezone": "America/Chicago",
			"asn": 7922,
			"asOrganization": "Comcast Cable",
			"httpProtocol": "HTTP/2",
			"tlsVersion": "TLSv1.3"
		}
	},
	"response": {
		"status": 200,
		"headers": {
			"content-type": "text/html; charset=utf-8",
			"content-length": "12345"
		}
	},
	"subject": {
		"id": "subj_123",
		"iss": "https://auth.sergiodxa.com/",
		"aud": "uptime",
		"jti": "unique-token-id",
		"exp": 1738593600,
		"iat": 1738590000
	},
	"profile": {
		"role": "admin",
		"teamId": "team_456",
		"memberships": [
			{ "team": "team_456", "role": "admin" },
			{ "team": "team_789", "role": "owner" }
		]
	},
	"billing": {
		"polarId": "cust_abc",
		"plan": "pro"
	},
	"middleware": {
		"session": [{ "level": "info", "event": "session.loaded", "userId": "subj_123" }]
	},
	"loaders": {
		"$team": [
			{ "level": "info", "event": "team.loader.start", "teamId": "team_456" },
			{ "level": "info", "event": "team.loader.complete", "membershipCount": 5 }
		],
		"$team.monitors": [{ "level": "info", "event": "monitors.list", "count": 10 }]
	},
	"action": null,
	"render": [
		{ "level": "info", "event": "render.start" },
		{ "level": "info", "event": "render.complete", "status": 200 }
	]
}
```

## Decision

Create a new `RequestLogger` class optimized for React Router HTTP requests, initialized in `entry.worker.ts` (above React Router) for full lifecycle coverage.

### API Design

```typescript
export namespace RequestLogger {
	export interface Subject {
		id: string;
		[key: string]: unknown;
	};

  export interface Profile {
    [key: string]: unknown;
  }

export interface Billing {
		polarId: string;
		[key: string]: unknown;
	};

	export interface CfInfo {
		colo: string;
		country: string | null;
		city: string | null;
		region: string | null;
		timezone: string;
		asn: number;
		asOrganization: string;
		httpProtocol: string;
		tlsVersion: string;
	};

	export interface RequestInfo {
		url: string;
		method: string;
		pathname: string;
		search: string;
		headers: Record<string, string>;
		cf: CfInfo;
	};

	export interface ResponseInfo {
		status: number;
		headers: Record<string, string>;
	};

	export interface Event {
		level: "info" | "error";
		event: string;
		[key: string]: unknown;
	};

	export interface ActionScope {
		routeId: string;
		events: Event[];
	} | null;
}

export class RequestLogger {
	// Nested class for scoped logging (parallel-safe)
	static Scoped = class ScopedLogger {
    #events: Set<RequestLogger.Event>;

		info(event: string, payload?: Record<string, unknown>): void;
		error(event: string, payload?: Record<string, unknown>): void;

    get events(): Set<RequestLogger.Event>;
	};

  #requestInfo: RequestLogger.RequestInfo;
  #responseInfo: RequestLogger.ResponseInfo | null = null;

  #subject: RequestLogger.Subject | null = null;
  #profile: RequestLogger.Profile | null = null;
  #billing: RequestLogger.Billing | null = null;

  #scopes = new Map<string, RequestLogger.Scoped>();

	constructor(request: Request);

	// Context setters
  set subject(subject: RequestLogger.Subject);
  set profile(profile: RequestLogger.Profile);
  set billing(billing: RequestLogger.Billing);
  set response(response: Response);

	// Scoped loggers (return isolated instances for parallel safety)
	middleware(name: string): RequestLogger.Scoped;
	loader(routeId: string): RequestLogger.Scoped;
	action(routeId: string): RequestLogger.Scoped;

	get render(): RequestLogger.Scoped;

	// Unscoped events (for catch blocks, edge cases)
	info(event: string, payload?: Record<string, unknown>): void;
	error(event: string, payload?: Record<string, unknown>): void;

	// Output all logs
	flush(): void;
}

// Context for React Router
export const RequestLoggerContext: Context<RequestLogger>;
export function getRequestLogger(context: RouterContextProvider): RequestLogger;
```

### Key Design Decisions

#### 1. Initialize in `entry.worker.ts`, not middleware

By creating the logger before React Router processes the request, we can:

- Log errors from `entry.server.tsx` render phase
- Capture the full request duration (not just middleware onwards)
- Access `request.cf` which is only available on the original Cloudflare Worker request

#### 2. Scoped loggers for parallel safety

Loaders run in parallel. Instead of:

```typescript
logger().info("team.loader.start"); // Which loader?
```

Use:

```typescript
let log = logger().loader("$team");
log.info("team.loader.start"); // Clear association
```

Each call to `loader(routeId)` returns a `ScopedLogger` instance that writes to that route's event array.

#### 3. Subject vs Profile vs Billing separation

- **Subject**: Auth data from `@apps/auth/` (id, and other claims from id_token)
- **Profile**: App-specific user data (memberships, roles per app)
- **Billing**: Polar billing data (used consistently across apps)

This allows the logger to be app-agnostic while supporting app-specific context.

#### 4. Request ID

Include a unique request ID in the output for correlation:

- Use `cf-ray` header from Cloudflare if available
- Fall back to `crypto.randomUUID()` if not

#### 5. Omit empty scopes

Don't include empty objects/arrays in output:

```json
// Good: omit if empty
{ "loaders": { "$team": [...] }, "render": [...] }

// Bad: include empty
{ "loaders": { "$team": [...] }, "middleware": {}, "action": null, "events": [], "render": [...] }
```

#### 6. Header filtering

**Request headers to include:**

- `content-type`, `accept`, `accept-language`, `accept-encoding`
- `user-agent`, `referer`, `origin`
- `x-forwarded-for`, `x-real-ip`, `x-forwarded-proto`, `x-forwarded-host`
- `x-request-id`, `x-correlation-id`

**Request headers to exclude:**

- `authorization`, `cookie`, `x-api-key`, `x-auth-token`
- Any containing: `secret`, `token`, `key`, `password`, `credential`

**Response headers to include:**

- `content-type`, `content-length`, `content-encoding`
- `cache-control`, `etag`, `last-modified`
- `x-request-id`, `cf-ray`, `server-timing`

**Response headers to exclude:**

- `set-cookie`

#### 7. Cloudflare `request.cf` data

Extract useful metadata from `request.cf`:

- `colo`: Data center code (e.g., "DFW")
- `country`, `city`, `region`, `timezone`: Geo data
- `asn`, `asOrganization`: Network info
- `httpProtocol`, `tlsVersion`: Connection info

This is more reliable than parsing headers like `cf-connecting-ip`.

### Package Exports

```typescript
// @pkg/logger - new exports
export { RequestLogger } from "./request-logger";
export { RequestLoggerContext, getRequestLogger } from "./request-logger-context";

// Keep existing exports for backwards compatibility
export { Logger, logger } from "./logger";
export { BatchedLogger } from "./batched-logger";
export { createBatchedLoggerMiddleware } from "./middleware";
```

### App Integration

#### `entry.worker.ts`

```typescript
import { RequestLogger, RequestLoggerContext } from "@pkg/logger";

export default {
	async fetch(request) {
		let build = await import("virtual:react-router/server-build");
		let { createRequestHandler, RouterContextProvider } = await import("react-router");

		if (!handler) handler = createRequestHandler(build, import.meta.env.MODE);

		let context = new RouterContextProvider();
		let log = new RequestLogger(request);
		context.set(RequestLoggerContext, log);

		try {
			let response = await handler(request, context);
			log.setResponse(response);
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

#### `middleware/logger.ts`

```typescript
import { getRequestLogger, type RequestLogger } from "@pkg/logger";
import { getContext } from "./context-storage";

export function logger(): RequestLogger {
	return getRequestLogger(getContext());
}
```

#### `root.tsx`

```typescript
export const middleware = [
	contextStorageMiddleware,
	// loggerMiddleware REMOVED - logger is set in entry.worker.ts
	i18nextMiddleware,
	drizzleMiddleware,
	sessionMiddleware,
	serverTimingMiddleware,
];
```

#### Route middleware

```typescript
export const middleware: Route.MiddlewareFunction[] = [
	async ({ context }, next) => {
		let log = logger().middleware("auth");
		log.info("auth.start");

		logger().setSubject({
			id: subject().id,
			email: subject().email,
			emailVerified: true,
		});

		logger().setProfile({
			role: membership.role,
			teamId: team().id,
		});

		logger().setBilling({
			polarId: customer?.polarId ?? null,
			plan: subscription?.plan ?? null,
		});

		log.info("auth.complete");
		return await next();
	},
];
```

#### Loader

```typescript
export async function loader() {
  let log = logger().loader("$team");

  log.info("team.loader.start", { teamId: team().id });
  let memberships = await db().query.memberships.findMany({...});
  log.info("team.loader.complete", { membershipCount: memberships.length });

  return { ... };
}
```

#### Action

```typescript
export async function action() {
  let log = logger().action("$team");

  log.info("team.action.start");
  // ... handle form
  log.info("team.action.success");

  return redirect(...);
}
```

#### `entry.server.tsx`

```typescript
import { getRequestLogger } from "@pkg/logger";

export default async function handleRequest(..., routerContext) {
  let log = getRequestLogger(routerContext).render();

  log.info("render.start");

  let stream = await renderToReadableStream(..., {
    onError(error) {
      log.error("render.error", { error: String(error) });
      status = 500;
    },
  });

  log.info("render.complete", { status });

  return new Response(stream, { status, headers });
}
```

## Implementation Plan

### Phase 1: Create RequestLogger class

1. Create `packages/logger/src/request-logger.ts`
   - `RequestLogger` class with nested `Scoped` class
   - Request/response extraction methods
   - Header filtering
   - CF data extraction
   - Flush method with smart output

2. Create `packages/logger/src/request-logger-context.ts`
   - Context creation
   - `getRequestLogger` helper

3. Create tests
   - `packages/logger/src/request-logger.test.ts`
   - `packages/logger/src/request-logger-context.test.ts`

4. Update `packages/logger/src/index.ts`
   - Add new exports

### Phase 2: Migrate apps

For each app (`uptime`, `blog`, `auth`, `books`):

1. Update `entry.worker.ts` to create and set RequestLogger
2. Update `middleware/logger.ts` to use `getRequestLogger`
3. Remove `loggerMiddleware` from `root.tsx` middleware array
4. Update routes to use scoped loggers
5. Update `entry.server.tsx` to use render scope

## Consequences

### Positive

- **Structured logs**: Organized by lifecycle phase (middleware, loaders, actions, render)
- **Parallel safety**: Scoped loggers prevent interleaving issues
- **Rich context**: Request, response, user, billing data automatically captured
- **Full coverage**: Logging from `entry.worker.ts` catches everything including render errors
- **CF integration**: Leverages `request.cf` for geo, network, and connection data
- **Request correlation**: Unique request ID for tracing

### Negative

- **Migration effort**: All apps need to update their logging patterns
- **API change**: `logger().info()` becomes `logger().loader(routeId).info()`
- **More verbose**: Must specify scope for each log call

### Neutral

- **BatchedLogger preserved**: Still available for workflows, cron, queues
- **Backwards compatible exports**: Existing code using `Logger` singleton works

## Alternatives Considered

### 1. Extend BatchedLogger

Add scoping to `BatchedLogger` instead of creating a new class.

**Rejected because**: The APIs are fundamentally different. `BatchedLogger` is designed for simple event accumulation, while `RequestLogger` needs lifecycle awareness, parallel safety, and rich context.

### 2. Use middleware instead of entry.worker.ts

Keep the middleware pattern but add more context.

**Rejected because**: Middleware can't catch errors in `entry.server.tsx` and doesn't have access to `request.cf` (it's stripped when Request is cloned through React Router).

### 3. Auto-detect scope from stack trace

Automatically determine which loader/action is calling based on stack inspection.

**Rejected because**: Unreliable, especially with async code, bundling, and minification. Explicit scoping is clearer and more maintainable.

## Files to Create/Modify

| File                                                 | Action               |
| ---------------------------------------------------- | -------------------- |
| `packages/logger/src/request-logger.ts`              | Create               |
| `packages/logger/src/request-logger-context.ts`      | Create               |
| `packages/logger/src/request-logger.test.ts`         | Create               |
| `packages/logger/src/request-logger-context.test.ts` | Create               |
| `packages/logger/src/index.ts`                       | Modify (add exports) |

## References

- [Cloudflare IncomingRequestCfProperties](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties)
- [React Router v7 Middleware](https://reactrouter.com/explanation/middleware)
- [Wide Events / Canonical Log Lines](https://www.honeycomb.io/blog/how-are-structured-logs-different-from-events)
