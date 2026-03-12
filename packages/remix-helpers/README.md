# @pkg/remix-helpers

Convenient type-safe helpers for defining fetch-router actions, form controllers, controllers, and middleware.

## Overview

`@pkg/remix-helpers` wraps `@remix-run/fetch-router` primitives with identity
functions so handler definitions stay concise while preserving strong typing.
The helpers do not change runtime behavior; they only improve authoring
ergonomics.

The intended pattern is to use your app route map as the type source. Passing
generics like `typeof routes.feed`, `typeof routes.cms.posts`, or
`typeof routes.cms.posts.action` gives each handler a route-specific `ctx` with
the correct HTTP method and route params.

## Usage

### Basic Example

```typescript
import type routes from "~/blog/routes";

import action from "@pkg/remix-helpers/action";
import controller from "@pkg/remix-helpers/controller";
import middleware from "@pkg/remix-helpers/middleware";

export const feed = action<typeof routes.feed>(async (_ctx) => {
	return new Response("Feed");
});

export const posts = controller<typeof routes.posts>({
	async index() {
		return new Response("Posts index");
	},

	async show(ctx) {
		return new Response(`Post detail ${ctx.params.id}`);
	},
});

export const withAuth = middleware(async (ctx) => {
	return ctx.next();
});
```

### Entry Points

```typescript
import action from "@pkg/remix-helpers/action";
import controller from "@pkg/remix-helpers/controller";
import form from "@pkg/remix-helpers/form";
import middleware from "@pkg/remix-helpers/middleware";
```

## API

### `action<route, T>(action: T): T`

Defines a single route action handler with route-aware typing.

**When to use:** Single action routes, usually route entries defined with
`get(path)` or `post(path)`.

**Parameters:**

- `action`: Action function that receives route-specific context.

**Returns:**

- The same action function, preserving inferred route method and params types.

**Example:**

```typescript
import type routes from "~/blog/routes";

import action from "@pkg/remix-helpers/action";

export default action<typeof routes.cms.dashboard>(async (_ctx) => {
	return new Response("CMS Dashboard");
});
```

### `form<pattern, T>(controller: T): T`

Defines a form controller constrained to `index` (`GET`) and `action` (`POST`)
for the same route pattern.

**When to use:** Routes defined with `form(path)` where `index` and `action`
should stay aligned.

**Parameters:**

- `controller`: Form controller object containing `index` and `action` handlers.

**Returns:**

- The same form controller with typed `ctx` for both handlers.

**Example:**

```typescript
import form from "@pkg/remix-helpers/form";

export default form<"/setup">({
	middleware: [],
	actions: {
		async index(_ctx) {
			return new Response("Setup");
		},

		async action(_ctx) {
			return new Response("Setup action");
		},
	},
});
```

### `controller<routes>(controller: Controller<routes>): Controller<routes>`

Defines a full controller branch with typed handlers per route action.

**When to use:** Full controller definitions, typically route entries defined
with `resources(path)`.

**Parameters:**

- `controller`: Controller object matching the selected route-map branch.

**Returns:**

- The same controller object with route-specific `ctx` typing for each action.

**Example:**

```typescript
import type routes from "~/routes";

import controller from "@pkg/remix-helpers/controller";

export default controller<typeof routes.cms.postTypes>({
	async index() {
		return new Response("CMS Post Types index");
	},

	async show(ctx) {
		return new Response(`CMS Post Type detail ${ctx.params.id}`);
	},

	async create() {
		return new Response("CMS Post Type created");
	},
});
```

### `middleware<method, params, T>(middleware: T): T`

Defines router middleware functions with typed method and params context.

**When to use:** Router middleware declarations and middleware factories.

**Parameters:**

- `middleware`: Middleware function receiving typed `ctx` and `next`.

**Returns:**

- The same middleware function with preserved generic inference.

**Example:**

```typescript
import type { Database } from "remix/data-table";

import { createStorageKey } from "@remix-run/fetch-router";
import middleware from "@pkg/remix-helpers/middleware";

let key = createStorageKey<Database>();

export default (db: Database) => {
	return middleware((ctx) => {
		ctx.storage.set(key, db);
		return ctx.next();
	});
};
```

## Patterns

### Pattern: Route-Map Typed Single Actions

Export a single action handler for a specific route entry, using `typeof routes...` to get accurate `ctx` types for each handler.

```typescript
import type routes from "~/routes";

import action from "@pkg/remix-helpers/action";

export default action<typeof routes.feed>(async (_ctx) => {
	return new Response("Feed");
});
```

### Pattern: Route-Map Typed Resource Controllers

Export a controller for a group of related routes (index, show, create, update, delete) using `typeof routes...` to get accurate `ctx` types for each handler.

```typescript
import type routes from "~/routes";

import controller from "@pkg/remix-helpers/controller";

export default controller<typeof routes.posts>({
	async index() {
		return new Response("Posts index");
	},

	async show(ctx) {
		return new Response(`Post ${ctx.params.id}`);
	},
});
```

### Pattern: Dependency-Injected Middleware Factory

Export a middleware factory that accepts dependencies (database, services, feature flags), and return a typed middleware function.

```typescript
import type { Database } from "remix/data-table";

import { createStorageKey } from "@remix-run/fetch-router";
import middleware from "@pkg/remix-helpers/middleware";

let key = createStorageKey<Database>();

export default (db: Database) => {
	return middleware((ctx) => {
		ctx.storage.set(key, db);
		return ctx.next();
	});
};
```

## Related Packages

- [`@pkg/validate`](/packages/validate) - Validate request or form input inside handlers
- [`@pkg/result`](/packages/result) - Result type for explicit success and failure flows
- [`@pkg/response`](/packages/response) - Typed response helpers for controller and action outputs

## Tips

1. Use `typeof routes...` generics whenever possible so `ctx` stays accurate for method and params.
2. Use `action` for single `get/post` entries, `form` for `form(path)`, and `controller` for `resources(path)` branches.
3. Keep middleware as factories when they need dependencies (database, services, feature flags).
4. These helpers are identity wrappers, so they improve typing and readability without adding runtime overhead.
