# @pkg/remix-helpers

Convenient type-safe helpers for defining fetch-router actions, form controllers, controllers, middleware, and rendered views.

## Overview

`@pkg/remix-helpers` wraps `@remix-run/fetch-router` primitives with identity
functions so handler definitions stay concise while preserving strong typing.
It also includes a `view` helper for returning server-rendered HTML responses
from route handlers using the active request context.

The intended pattern is to use your app route map as the type source. Passing
generics like `typeof routes.feed`, `typeof routes.cms.posts`, or
`typeof routes.cms.posts.action` gives each handler a route-specific `ctx` with
the correct HTTP method and route params.

## Usage

### Basic Example

```typescript
import type routes from "~/routes";

import action from "@pkg/remix-helpers/action";
import controller from "@pkg/remix-helpers/controller";
import middleware from "@pkg/remix-helpers/middleware";
import view from "@pkg/remix-helpers/view";

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

export const notFound = action(async () => {
	return view(<h1>Not Found</h1>, { status: 404 });
});
```

### Entry Points

```typescript
import action from "@pkg/remix-helpers/action";
import controller from "@pkg/remix-helpers/controller";
import form from "@pkg/remix-helpers/form";
import middleware from "@pkg/remix-helpers/middleware";
import view from "@pkg/remix-helpers/view";
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
import type routes from "~/routes";

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

### `view(node, init?): Promise<Response>`

Renders a Remix component tree into an HTML `Response` using the active request
context.

**When to use:** Route handlers that return server-rendered views and need frame
resolution to reuse the current fetch-router request context.

**Parameters:**

- `node`: Remix component tree to render.
- `init`: Optional `ResponseInit` used to set status and additional headers.

**Returns:**

- A `Response` with the rendered HTML body and `content-type` set to
  `text/html; charset=utf-8`.

**Example:**

```tsx
import action from "@pkg/remix-helpers/action";
import view from "@pkg/remix-helpers/view";

export default action(async () => {
	return view(<main>Dashboard</main>);
});
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

### Pattern: Server-Rendered Route Responses

Return a rendered HTML response directly from a route handler while keeping the
current request context available for frame resolution.

```tsx
import action from "@pkg/remix-helpers/action";
import view from "@pkg/remix-helpers/view";

export default action(async () => {
	return view(<main>Welcome</main>, { status: 200 });
});
```

## Related Packages

- [`@pkg/validate`](/packages/validate) - Validate request or form input inside handlers
- [`@pkg/result`](/packages/result) - Result type for explicit success and failure flows
- [`@pkg/response`](/packages/response) - Typed response helpers for controller and action outputs

## Tips

1. Use `typeof routes...` generics whenever possible so `ctx` stays accurate for method and params.
2. Use `action` for single `get/post` entries, `form` for `form(path)`, and `controller` for `resources(path)` branches.
3. Keep middleware as factories when they need dependencies (database, services, feature flags).
4. Use `view` when a route handler should return HTML rendered from a Remix component tree.
5. The route helpers are identity wrappers, so they improve typing and readability without adding runtime overhead.
