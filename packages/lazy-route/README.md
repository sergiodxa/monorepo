# @sdxc/lazy-route

Maps a route to a module that is imported on the first request that reaches it.

## Installation

```bash
npm add @sdxc/lazy-route
```

It stands in for a handler mapped on a [`remix`](https://www.npmjs.com/package/remix) fetch router, which installs alongside this package.

## Usage

### Basic Example

Replace the static import with a loader. The route is still mapped at startup, so matching and URL generation are unchanged, but the module behind it arrives with the first request that matches.

```typescript
import { lazy } from "@sdxc/lazy-route";

// Before
import bookmarks from "./controllers/bookmarks";
router.map(routes.bookmarks, bookmarks);

// After
router.map(
	routes.bookmarks,
	lazy(() => import("./controllers/bookmarks")),
);
```

### Actions And Controllers

Both work from the same call, because the router decides which shape it wants from the target it was given rather than from the module.

```typescript
// A single route, whose module default-exports a `createAction(...)`
router.map(
	routes.home,
	lazy(() => import("./controllers/home")),
);

// A route map, whose module default-exports a `createController(...)`
router.map(
	routes.session,
	lazy(() => import("./controllers/session")),
);
```

A controller's actions share one load: the first request to any of them imports the module, and every other action is served from it without importing again.

### Middleware The Module Declares

Whatever an action or controller declares travels with it and runs ahead of the handler, in the order the router would have run it.

```typescript
// ./controllers/settings.ts
export default createController(routes.settings, {
	middleware: [requireAdmin],
	actions: {
		index: () => new Response("settings"),
	},
});
```

`requireAdmin` runs before `index`, after the router's own chain, exactly as it does when the controller is imported statically.

### Guards The Router Owns

A group of routes that shares a guard passes it as the second argument, where it runs before anything the module declares — and answers before the module is loaded at all.

```typescript
router.map(
	routes.admin.articles,
	lazy(() => import("./controllers/admin/articles"), [requireAdmin, purgeListing]),
);
```

### Loading A Named Export

A loader may resolve the handler itself, for a module that exports it under a name.

```typescript
router.map(
	routes.health,
	lazy(() => import("./controllers/health").then((it) => it.check)),
);
```

## API

### `lazy(load, middleware?)`

Returns a stand-in for the route's module, typed as that module's default export, to pass wherever an action or a controller goes.

```typescript
function lazy<module>(
	load: () => Promise<module>,
	middleware?: readonly Middleware[],
): Loaded<module>;
```

`load` is called at most once, on the first request that matches the route, and its result is reused for every request after that. It may resolve either a module with a `default` export or the handler value itself.

`middleware` runs ahead of whatever the module declares. It is typed as middleware with no context transform, so a middleware that publishes a context value is rejected: the loaded handler's type is the module's own and cannot grow to know a value declared at the map call. Publish those from the router's chain, or from inside the module.

The return type is the module's own, so pointing a route at the wrong module stays a type error at the `router.map()` call — a controller mapped to a single route, an action mapped to a route map, and a controller missing an action the route map declares are all rejected there.

```typescript
let handler = lazy(() => import("./controllers/bookmarks"));
// typed as
let handler: typeof import("./controllers/bookmarks").default;
```

### What Moves To The First Request

A static map validates a controller's actions against its route map while the router is being built. A lazy one cannot, because the actions are not there yet, so those checks run on the first request to the route and throw with the same detail.

| Mistake                                        | Reported                                        |
| ---------------------------------------------- | ----------------------------------------------- |
| A controller mapped to a single route          | At the map call, and again on the first request |
| An action mapped to a route map                | At the map call, and again on the first request |
| A controller missing a declared action         | At the map call, and again on the first request |
| A module whose default export is not a handler | At the `lazy()` call, and on the first request  |

## Pattern: Deciding What To Defer

The saving is the cost of the modules a request does not need, so the routes worth deferring are the ones with the heaviest module graphs. On a server that starts once, that cost is paid once; on a runtime that starts an isolate per cold request, it is paid again every time, and in full, including the routes that request will never touch.

Deferring the whole table is usually the right default. Each route pays a single import on the first request that reaches it, and every route the process never serves costs nothing beyond its pattern.

```typescript
import { lazy } from "@sdxc/lazy-route";

router.map(
	routes.home,
	lazy(() => import("./controllers/home")),
);
router.map(
	routes.search,
	lazy(() => import("./controllers/search")),
);
router.map(
	routes.admin,
	lazy(() => import("./controllers/admin")),
);
```

Point the loader at a bare `import()` and let the bundler split the chunk. A loader that computes its specifier cannot be split, and the deferral buys nothing.

## Pattern: Keeping A Group's Guard In One Place

A stand-in is an object rather than a function, so it cannot be the `handler` of an outer action object. A composition root that owns a route group's guard passes it to `lazy()` instead of wrapping the loader.

```typescript
import type { Middleware } from "remix/router";

import { lazy } from "@sdxc/lazy-route";

const ADMIN_GUARDS: Middleware[] = [requireSignIn, requireAdmin];

router.map(
	routes.admin.dashboard,
	lazy(() => import("./controllers/admin/dashboard"), ADMIN_GUARDS),
);
router.map(
	routes.admin.articles,
	lazy(() => import("./controllers/admin/articles"), ADMIN_GUARDS),
);
```

The guard answers an unauthorized request without importing the controller it protects, so a section nobody is allowed into is never loaded.

## Pattern: A Route Map Assembled From Several Modules

A stand-in is a valid action in its own right, so a route map whose actions live in different modules maps one loader per action.

```typescript
import { lazy } from "@sdxc/lazy-route";

router.map(routes.feeds, {
	actions: {
		all: lazy(() => import("./controllers/feeds/all")),
		articles: lazy(() => import("./controllers/feeds/articles")),
		tutorials: lazy(() => import("./controllers/feeds/tutorials")),
	},
});
```

Where the actions share a module, prefer one loader for the whole controller: splitting them only multiplies chunks over the same source.

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
