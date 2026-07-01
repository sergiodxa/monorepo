# ADR-008: Service Container For Remix V3

## Status

**Proposed** - 2026-06-30

## Background

Remix v3 applications in this monorepo need a consistent way to construct and share application services such as databases, loggers, repositories, mailers, queues, storage clients, billing clients, and API clients. Today those dependencies are commonly created directly in route handlers, middleware, or module-level helpers, which makes ownership unclear and can couple business logic to Remix or Cloudflare Worker runtime details.

Laravel's service container and service provider model offers useful ideas for dependency registration, dependency resolution, and request-scoped lifetimes. We will adapt those ideas to TypeScript and Remix v3 without copying Laravel's runtime model, decorators, reflection, or string-based container keys.

## Context

### Runtime Constraints

The target runtime is Cloudflare Workers. A Worker isolate can reuse module-level state across requests, but requests are still concurrent and must not share request-specific values through global mutable state.

Remix v3 route handlers receive a typed request context object. Middleware can enrich that context with values using `context.set(Key, value)`, and handlers can retrieve them with `context.get(Key)`. Remix v3 middleware should own request lifecycle concerns such as session loading, current-user loading, request IDs, locale detection, CSRF checks, permission checks, response headers, timing, flash messages, and redirects.

### Issues Identified

| Issue | Impact |
| ----- | ------ |
| Service construction inside route handlers | Routes become harder to test and accumulate infrastructure wiring |
| Service registration inside middleware | Application dependencies are redefined per request and mixed with lifecycle logic |
| String or symbol dependency keys | Type inference is weaker and call sites are easier to mistype |
| Global request state | Unsafe on Workers because isolates can handle overlapping requests |
| Decorator or reflection-based injection | Adds runtime magic and does not align with Workers-friendly explicit code |

## Decision

Implement a small TypeScript service container pattern for Remix v3 applications running on Cloudflare Workers.

The container will use classes as dependency keys, support application and request lifetimes, and integrate with Remix v3 through typed request context. Service providers will register how dependencies are built. Middleware will create request scopes and attach request-specific values. Route handlers will resolve dependencies explicitly through the request-scoped container or a typed `inject` helper.

### Container API

The container will use constructor functions as keys:

```typescript
container.get(Database);
container.get(Logger);
container.get(AuthService);
```

The minimum API is:

```typescript
interface ServiceKey<T> {
	readonly prototype: T;
}

interface HasContainer {
	get<T>(key: ServiceKey<T>): T;
}

interface Container {
	singleton<T>(key: ServiceKey<T>, factory: (container: Container) => T): void;
	scoped<T>(key: ServiceKey<T>, factory: (container: Container) => T): void;
	instance<T>(key: ServiceKey<T>, value: T): void;
	get<T>(key: ServiceKey<T>): T;
	createScope(): Container;
}
```

The semantics are:

| Method | Lifetime |
| ------ | -------- |
| `singleton(Class, factory)` | One instance per application container, reused across requests in the same Worker isolate |
| `scoped(Class, factory)` | One instance per request-scoped container |
| `instance(Class, value)` | A manually provided value in the current container, commonly used for request-specific values |
| `get(Class)` | Resolve the dependency for the current container |
| `createScope()` | Create a child container from the global application container |

Singleton definitions and instances belong to the application container. Scoped instances belong to the request container that resolves them. `instance` values should override parent definitions for the current scope so request-specific values such as `Request`, Cloudflare bindings, Cloudflare execution context, current user, session, and request ID can be attached safely.

Values that do not already have a runtime class, such as Cloudflare `env` interfaces or request ID strings, should use small wrapper classes as keys:

```typescript
class CloudflareBindings {
	constructor(readonly value: Env) {}
}

class CloudflareExecutionContext {
	constructor(readonly value: ExecutionContext) {}
}

class RequestId {
	constructor(readonly value: string) {}
}
```

### Service Providers

Service providers will be classes responsible only for registering dependencies:

```typescript
interface ServiceProvider {
	register(container: Container): void;
}

class DatabaseServiceProvider implements ServiceProvider {
	register(container: Container) {
		container.scoped(Database, (container) => {
			let bindings = container.get(CloudflareBindings);
			return new Database(bindings.value.DB);
		});
	}
}
```

Providers may register infrastructure and application services such as database clients, loggers, caches, repositories, mailers, queues, storage clients, billing clients, auth services, feature flag services, API clients, and configuration services.

Providers must not run request-specific logic. They define how services are built, but they do not read the current session, load the current user, generate request IDs, perform redirects, set headers, or inspect permissions.

### Remix V3 Integration

The Worker will bootstrap the application container globally, outside the request handler:

```typescript
let appContainer = new ServiceContainer();

for (let provider of providers) {
	provider.register(appContainer);
}
```

For each incoming request, the Worker or root middleware will create a request scope and attach request-specific values:

```typescript
let requestContainer = appContainer.createScope();

requestContainer.instance(Request, request);
requestContainer.instance(CloudflareBindings, new CloudflareBindings(env));
requestContainer.instance(
	CloudflareExecutionContext,
	new CloudflareExecutionContext(executionContext),
);
```

The request-scoped container will be placed into Remix v3's request context with `context.set(ServiceContainer, requestContainer)`. Route handlers and middleware can retrieve it with `context.get(ServiceContainer)`.

Middleware may resolve services from the container, but middleware must not register application services. For example, auth middleware may resolve `SessionRepository` and `AuthService`, load the current user, then attach `CurrentUser` as an instance on the request container and/or set it directly on Remix context.

### Request Lifecycle Boundaries

Service providers and middleware have separate responsibilities:

| Belongs in service providers | Belongs in middleware |
| ---------------------------- | --------------------- |
| Database client registration | Reading the current session |
| Logger registration | Loading the current user |
| Cache registration | Setting request ID |
| Repository/model registration | Locale detection |
| Mailer registration | CSRF checks |
| Queue client registration | Permission checks |
| Storage client registration | Response headers |
| Billing/API client registration | Timing and instrumentation |
| Auth service registration | Flash messages and redirects |

This keeps dependency construction stable and request lifecycle behavior explicit.

### Injection Helper

Add an `inject` helper for route handlers that resolves dependencies from the request-scoped container and passes them after the normal Remix v3 handler argument.

Desired usage inside a Remix v3 controller action:

```typescript
export default createController(routes.items, {
	actions: {
		index: inject([Database, Logger], async (ctx, db, logger) => {
			logger.info("Loading data");

			let items = await db.items.findMany();

			return Response.json({ items });
		}),
	},
});
```

The first argument passed to the injected function is always the normal Remix v3 request handler argument, commonly named `ctx`. The remaining arguments are resolved from `ctx.get(ServiceContainer)` in the same order as the dependency array.

The helper must preserve parameter and return types:

```typescript
type InferInstances<T extends readonly ServiceKey<unknown>[]> = {
	[K in keyof T]: T[K] extends ServiceKey<infer Instance> ? Instance : never;
};

function inject<
	Dependencies extends readonly ServiceKey<unknown>[],
	Context extends HasContainer,
	Return,
>(
	dependencies: Dependencies,
	handler: (
		ctx: Context,
		...instances: InferInstances<Dependencies>
	) => Return,
): (ctx: Context) => Return {
	return (ctx) => {
		let container = ctx.get(ServiceContainer);
		let instances = dependencies.map((dependency) => container.get(dependency));
		return handler(ctx, ...instances as InferInstances<Dependencies>);
	};
}
```

The implementation can refine `Context` to the concrete Remix v3 action/controller context type used by the application, but it must keep the same runtime behavior: normal context first, resolved dependencies after, and original handler return type preserved.

### Business Logic Boundary

Services and repositories should not know whether they are being used from Remix, Cloudflare Workers, tests, scheduled jobs, or another runtime. They may depend on explicit constructor arguments and interfaces, but they should not call Remix `context.get(...)` or read Cloudflare bindings directly unless the service is specifically an adapter for that runtime.

Route handlers are allowed to ask the container for dependencies. Business services should receive dependencies through constructors or factory functions registered in providers.

## Consequences

### Positive

- **Clear ownership**: Providers own service construction, middleware owns request lifecycle logic, and route handlers consume dependencies.
- **Typed dependency keys**: Class keys allow `container.get(Database)` to infer `Database` without string constants or symbols.
- **Worker-safe request scope**: Request-specific values live in a child container instead of global mutable state.
- **Testable services**: Business logic can be instantiated with fake dependencies without a Remix request or Cloudflare Worker runtime.
- **Remix v3 aligned**: The design uses typed request context and middleware instead of Remix v2 `getLoadContext` assumptions.
- **Explicit injection**: The `inject` helper avoids decorators, metadata, and runtime reflection while keeping route handlers concise.

### Negative

- **More infrastructure code**: The container, providers, request-scope middleware, and type helpers must be maintained.
- **Class-key limitation**: Interfaces cannot be used directly as keys, so interface-backed dependencies need concrete token classes or abstract classes.
- **Factory discipline required**: Providers must avoid doing request work during registration and must choose singleton versus scoped lifetimes carefully.
- **Runtime resolution failures**: Missing registrations are discovered when `get` is called unless tests or startup validation cover them.

### Neutral

- **One singleton per isolate**: Singleton lifetime is per Worker isolate, not globally unique across all Cloudflare locations.
- **Container complements Remix context**: Remix context remains the request carrier; the container is used for application dependency resolution.
- **Middleware can still set direct context values**: Values that are naturally Remix middleware outputs may remain available through `context.get(Key)` as well as the request container when useful.

## Implementation Plan

### Phase 1: Container Core

1. Implement the `ServiceContainer` class with `singleton`, `scoped`, `instance`, `get`, and `createScope`.
2. Add tests for singleton reuse, scoped reuse, parent lookup, instance override, missing registration errors, and scope isolation.
3. Document lifetime semantics and the class-key constraint.

### Phase 2: Provider Model

1. Add the `ServiceProvider` interface.
2. Register initial providers for database, logger, repositories, and application services.
3. Keep provider registration at module startup so it runs once per Worker isolate.

### Phase 3: Remix V3 Request Scope

1. Add root middleware that creates `appContainer.createScope()` for each request.
2. Attach request values such as `Request`, Cloudflare bindings, Cloudflare execution context, and request ID.
3. Store the request container in Remix context with `context.set(ServiceContainer, requestContainer)`.
4. Ensure lifecycle middleware resolves services but does not register services.

### Phase 4: Typed Injection

1. Implement the fully typed `inject` helper.
2. Verify dependency tuple inference for `inject([Database, Logger], ...)`.
3. Verify the wrapped handler preserves the original return type.
4. Add representative route handler tests.

### Phase 5: Adoption

1. Move route-local dependency construction into providers where the service is reused.
2. Keep route-specific one-off code near the route until reuse is real.
3. Update documentation with examples for services, middleware, tests, and route handlers.

## Alternatives Considered

### Manual Construction In Every Handler

Rejected because repeated construction spreads infrastructure wiring across routes and makes handlers harder to test.

### Register Services In Middleware

Rejected because middleware runs per request and should own lifecycle behavior, not application service definitions.

### Symbols Or Strings As Keys

Rejected because the desired API is class-keyed and class keys provide better TypeScript inference at call sites.

### Decorators And `reflect-metadata`

Rejected because they add runtime reflection, implicit dependencies, and bundling complexity that are unnecessary for this explicit Workers-friendly design.

### Global Mutable Request State

Rejected because Cloudflare Worker isolates can process overlapping requests and request data must not leak between them.

### Remix V2 `getLoadContext`

Rejected because the target framework is Remix v3. The design should use Remix v3 typed request context and middleware APIs.

## Notes

- Use class keys for concrete services and abstract classes for interface-like dependencies when a stable runtime key is needed.
- Avoid registering `Request`, Cloudflare `env`, `ExecutionContext`, current user, session, or request ID in service providers; attach them per request.
- Treat singleton factories as isolate-local. Do not store user-specific or request-specific data in singleton services.
- Prefer route handlers that ask for dependencies at the boundary and keep business services independent from Remix and Cloudflare where possible.
