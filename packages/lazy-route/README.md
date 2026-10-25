# @sdxc/lazy-route

Maps a route to a module imported on the first request that reaches it.

## Installation

```sh
npm add @sdxc/lazy-route
```

It plugs into the router from [`remix`](https://www.npmjs.com/package/remix), which installs alongside it.

## Usage

### Defer a route

Replace the static import with a loader. The route is still mapped at startup, so matching and `href()` work as before; the module arrives with the first request that matches.

```typescript
import { lazy } from "@sdxc/lazy-route";
import { createRouter } from "remix/router";
import { get, route } from "remix/routes";

let routes = route({ bookmarks: get("/bookmarks") });

let router = createRouter();

router.map(
	routes.bookmarks,
	lazy(() => import("./controllers/bookmarks.js")),
);
```

The loader runs once and every later request reuses its module.

### Map actions and controllers alike

A module that default-exports a `createAction(...)` maps to a single route, and one that default-exports a `createController(...)` maps to a route map. The router picks the shape from the route it is given.

```typescript
router.map(
	routes.home,
	lazy(() => import("./controllers/home.js")),
);
router.map(
	routes.session,
	lazy(() => import("./controllers/session.js")),
);
```

Every action of a controller shares one import: the first request to any of them loads the module for all.

### Keep the module's own middleware

The `middleware` an action or controller declares travels with it and runs after the router's chain and before the handler, exactly as it does when imported statically.

```typescript
// ./controllers/settings.ts
import { createController } from "remix/router";

export default createController(routes.settings, {
	middleware: [requireAdmin],
	actions: {
		index: () => new Response("settings"),
	},
});
```

### Guard a route before it loads

Middleware passed as the second argument runs ahead of the module's own, and a guard that answers does so without importing the module.

```typescript
router.map(
	routes.admin,
	lazy(() => import("./controllers/admin.js"), [requireAdmin]),
);
```

### Load a named export

A loader may resolve the handler itself instead of a module with a `default` export.

```typescript
router.map(
	routes.health,
	lazy(() => import("./controllers/health.js").then((module) => module.check)),
);
```

## API

### `lazy(load, middleware?)`

```typescript
function lazy<module>(
	load: () => Promise<module>,
	middleware?: readonly Middleware[],
): Loaded<module>;
```

Returns a stand-in typed as the module's default export (or as the resolved value when it has no `default`), to pass wherever `router.map()` takes an action or a controller. `load` runs on the first matching request and its result serves every request after it, including a rejected import.

`middleware` runs before the module's own chain. A context value it publishes reaches the loaded handler, typed there when its package declares it on `RequestContext`, as `captcha()` does for `ctx.captcha`.

Because the stand-in keeps the module's type, mapping a controller to a single route, an action to a route map, or a controller missing a declared action is a type error at `router.map()`. The router's own runtime checks for those mistakes run on the first request instead, and throw a `TypeError` naming the problem.

## Pattern: Deferring The Whole Route Table

Each route pays one import on its first request, and a route the process never serves costs only its pattern. On a runtime that starts an isolate per cold request, deferring every route keeps startup to the router itself.

```typescript
import { lazy } from "@sdxc/lazy-route";
import { createRouter } from "remix/router";
import { get, route } from "remix/routes";

let routes = route({
	home: get("/"),
	search: get("/search"),
	account: get("/account"),
});

let router = createRouter();

router.map(
	routes.home,
	lazy(() => import("./controllers/home.js")),
);
router.map(
	routes.search,
	lazy(() => import("./controllers/search.js")),
);
router.map(
	routes.account,
	lazy(() => import("./controllers/account.js")),
);

export default { fetch: (request: Request) => router.fetch(request) };
```

Point each loader at a bare `import()` with a literal specifier so the bundler splits the module into its own chunk.

## Pattern: One Guard For A Route Group

A section that shares its guards passes the same list to every `lazy()` call. An unauthorized request is answered before the controller it targets is imported, so a section nobody may enter is never loaded.

```typescript
import type { Middleware } from "remix/router";

import { lazy } from "@sdxc/lazy-route";
import { createRouter } from "remix/router";
import { get, route } from "remix/routes";

let routes = route({
	admin: {
		dashboard: get("/admin"),
		articles: get("/admin/articles"),
	},
});

let requireAdmin: Middleware = (context, next) => {
	if (context.request.headers.get("x-role") !== "admin") {
		return new Response("Forbidden", { status: 403 });
	}
	return next();
};

let router = createRouter();

router.map(
	routes.admin.dashboard,
	lazy(() => import("./controllers/admin/dashboard.js"), [requireAdmin]),
);
router.map(
	routes.admin.articles,
	lazy(() => import("./controllers/admin/articles.js"), [requireAdmin]),
);
```

## Pattern: A Route Map Spread Across Modules

A stand-in is a valid action on its own, so a route map whose actions live in different files maps one loader per action. Inside `createController()` they keep the route map's typing and run behind the controller's middleware, which answers before any of them loads.

```typescript
import type { Middleware } from "remix/router";

import { lazy } from "@sdxc/lazy-route";
import { createController, createRouter } from "remix/router";
import { get, route } from "remix/routes";

let routes = route({
	feeds: {
		all: get("/feeds"),
		articles: get("/feeds/articles"),
		tutorials: get("/feeds/tutorials"),
	},
});

let requireSignIn: Middleware = (context, next) => {
	if (!context.request.headers.has("authorization")) {
		return new Response("Unauthorized", { status: 401 });
	}
	return next();
};

let router = createRouter();

router.map(
	routes.feeds,
	createController(routes.feeds, {
		middleware: [requireSignIn],
		actions: {
			all: lazy(() => import("./controllers/feeds/all.js")),
			articles: lazy(() =>
				import("./controllers/feeds/posts.js").then((module) => module.articles),
			),
			tutorials: lazy(() =>
				import("./controllers/feeds/posts.js").then((module) => module.tutorials),
			),
		},
	}),
);
```

`articles` and `tutorials` name the same specifier to pick different named exports; they share one chunk, imported by whichever of them is requested first.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/lazy-route": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
