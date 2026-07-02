# @pkg/service-container

Class-keyed service container for TypeScript applications.

## Overview

`@pkg/service-container` centralizes application dependency construction while keeping scoped services isolated per child container. It uses runtime classes and abstract classes as type-safe keys, so `container.get(Database)` returns a `Database` without strings, symbols, decorators, or reflection.

The package works with request handlers, jobs, tests, and any runtime that can wrap work in an active container scope. Application startup registers singleton and scoped factories once, scopes isolate scoped services, and handlers resolve dependencies explicitly or through `inject`.

## Usage

### Basic Example

```typescript
import { ServiceContainer, type ServiceProvider } from "@pkg/service-container";

class Database {
	findMany() {
		return [];
	}
}

class DatabaseProvider implements ServiceProvider {
	register(container: ServiceContainer) {
		container.scoped(Database, () => new Database());
	}
}

let appContainer = new ServiceContainer();

new DatabaseProvider().register(appContainer);

let database = appContainer.get(Database);

database.findMany();
```

### Injected Handler

```typescript
import { inject, ServiceContainer } from "@pkg/service-container";

let appContainer = new ServiceContainer();

let handler = inject([Database] as const, async (database) => {
	let items = database.findMany();

	return Response.json({ items });
});

let response = appContainer.scope(() => handler());
```

## API

### `ServiceContainer`

Small class-keyed service container with application and request lifetimes.

#### `new ServiceContainer(parent?: ServiceContainer)`

Creates an application container when no parent is provided, or a child scope when used internally by `scope`.

**Parameters:**

- `parent`: Optional parent container used for fallback lookups.

#### `container.singleton<T>(key: ServiceKey<T>, factory: (container: Container) => T): void`

Registers an isolate-local instance reused by child request scopes.

**Parameters:**

- `key`: Runtime class key for the service.
- `factory`: Factory called once by the application container.

#### `container.scoped<T>(key: ServiceKey<T>, factory: (container: Container) => T): void`

Registers a factory whose value is cached by the resolving request scope.

**Parameters:**

- `key`: Runtime class key for the service.
- `factory`: Factory called once per resolving scope.

#### `container.instance<T>(key: ServiceKey<T>, value: T): void`

Registers an already-constructed service in the current container.

**Parameters:**

- `key`: Runtime class key for the value.
- `value`: Concrete service value to return for this container.

#### `container.get<T>(key: ServiceKey<T>): T`

Resolves a service from the current scope or its parent containers.

**Parameters:**

- `key`: Runtime class key for the requested service.

**Returns:**

- The resolved service instance.

#### `container.scope<T>(callback: () => T): T`

Runs work inside an isolated child scope with async-local access.

**Parameters:**

- `callback`: Work that should share scoped service instances.

**Returns:**

- The callback result.

**Example:**

```typescript
let result = container.scope(() => doWork());
```

### `getServiceContainer()`

Returns the service container bound to the current async execution.

**Returns:**

- The active service container.

### `inject(dependencies, callback)`

Creates a function that resolves dependencies from the active container.

**Parameters:**

- `dependencies`: Ordered service keys resolved from the active container.
- `callback`: Callback receiving resolved services in dependency order.

**Returns:**

- A function that resolves dependencies and returns the callback result.

**Example:**

```typescript
let handler = inject([Database, Logger] as const, async (database, logger) => {
	logger.info("Loading items");

	return Response.json({ items: database.findMany() });
});

let response = container.scope(() => handler());
```

### `ServiceNotFoundError`

Error thrown when a service cannot be resolved by class key.

### `ServiceContainerScopeError`

Error thrown when `inject` or `getServiceContainer` runs outside `container.scope`.

### Types

#### `ServiceKey<T>`

Runtime class or abstract class used as the lookup key for a service.

```typescript
interface ServiceKey<T> {
	readonly prototype: T;
}
```

#### `Container`

Contract implemented by containers that register and resolve class-keyed services.

#### `ServiceProvider`

Provider contract for registering dependencies without performing request-specific work.

#### `InferInstances<Dependencies>`

Infers handler dependency parameters from an ordered tuple of service keys.

## Patterns

### Provider Registration

Register application services once at module startup.

```typescript
let appContainer = new ServiceContainer();
let providers = [new DatabaseProvider(), new LoggerProvider()];

for (let provider of providers) provider.register(appContainer);
```

### Runtime Scope

Create a scope around the unit of work that should share scoped services. Request lifecycle values such as request IDs, sessions, current users, and locale should be owned by middleware or runtime code, not the service container.

```typescript
let result = appContainer.scope(() => doWork());
```

### Remix 3 Context

Register providers once at module startup, create a child scope in the runtime entrypoint, and call `router.fetch(request)` inside that active container scope. Keep request lifecycle values in Remix middleware or direct context entries instead of registering them as container services.

```typescript
import { ServiceContainer, type ServiceProvider } from "@pkg/service-container";

let container = new ServiceContainer();
let providers: ServiceProvider[] = [new DatabaseProvider(), new LoggerProvider()];

for (let provider of providers) provider.register(container);

export default {
	fetch(request) {
		return container.scope(() => router.fetch(request));
	},
};
```

Use `inject` inside controllers. If the Remix `asyncContext()` middleware is installed, the callback can read the current request context with `getContext()`.

```typescript
import { createController } from "remix/fetch-router";
import { getContext } from "remix/middleware/async-context";
import { inject } from "@pkg/service-container";

import { Database } from "~/services/database";
import { Logger } from "~/services/logger";
import { routes } from "~/routes";

export let loginController = createController(routes.something, {
	actions: {
		index: inject([Database, Logger] as const, async (database, logger) => {
			let ctx = getContext();

			logger.info("Handling index action");

			let users = await database.query("SELECT * FROM users");

			return ctx.render({ users });
		}),
	},
});
```

### Cloudflare Queues

Wrap the queue handler in `container.scope(...)` so every message in the batch shares one scoped container. Keep queue metadata such as attempts, ack/retry decisions, and batch control in the queue handler.

```typescript
import { inject, ServiceContainer, type ServiceProvider } from "@pkg/service-container";

import { EmailService } from "~/services/email";
import { Logger } from "~/services/logger";

let container = new ServiceContainer();
let providers: ServiceProvider[] = [new EmailProvider(), new LoggerProvider()];

for (let provider of providers) provider.register(container);

interface EmailJob {
	to: string;
	subject: string;
	body: string;
}

export default {
	queue(batch: MessageBatch<EmailJob>) {
		return container.scope(async () => {
			for (let message of batch.messages) {
				let sendEmail = inject([EmailService, Logger] as const, async (email, logger) => {
					logger.info("Sending queued email");

					await email.send(message.body);
				});

				await sendEmail();
			}
		});
	},
};
```

## Related Packages

- [`@pkg/logger`](/packages/logger) - Logging utilities that can be registered as services.
- [`@pkg/jobs`](/packages/jobs) - Background job helpers that can be resolved from providers.
- [`@pkg/validate`](/packages/validate) - Validation helpers commonly used by route handlers and services.

## Tips

1. Use `singleton` only for services that never hold user-specific or request-specific state.
2. Use `scoped` for services that should be reused inside one request but isolated from other requests.
3. Keep request lifecycle values in middleware; do not model request IDs, sessions, current users, or locale as container services.
4. Keep service providers focused on construction; middleware should own request lifecycle work.
