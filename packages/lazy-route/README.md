# @sdxc/lazy-route

Maps a route to a module that is imported on the first request that reaches it.

## Overview

A router maps every route at startup, which means the entry point imports every
controller before it can answer anything. On a long-lived server that cost is paid
once. On a Worker it is paid on every cold start, by whichever request happened to
land on a fresh isolate — and it is paid in full, including the controllers that
request will never touch. An admin section, an OAuth endpoint set, and a webhook
receiver are all loaded so that a visit to `/` can be answered.

`lazy()` breaks that link. The route is still mapped at startup, so the URL surface
is complete and matching is unchanged, but the module behind it is imported the
first time a request matches. Every route the process never serves costs nothing
beyond its pattern.

The stand-in it returns keeps the type of the module's default export, so the route
still checks its params and its request context exactly as a static import did.
Whatever `middleware` the action or controller declares travels with it and runs
ahead of the handler.

## Usage

Replace the static import with the loader:

```ts
import { lazy } from "@sdxc/lazy-route";

import routes from "~/routes/web";

// Before
import bookmarks from "~/app/http/controllers/bookmarks";
router.map(routes.bookmarks, bookmarks);

// After
router.map(
	routes.bookmarks,
	lazy(() => import("~/app/http/controllers/bookmarks")),
);
```

Actions and controllers both work, because the router decides which one it wants
from the target it was given rather than from the module:

```ts
// A single route, whose module default-exports a `createAction(...)`
router.map(
	routes.home,
	lazy(() => import("~/app/http/controllers/home")),
);

// A route map, whose module default-exports a `createController(...)`
router.map(
	routes.authorize,
	lazy(() => import("~/app/http/controllers/authorize")),
);
```

A controller's actions share one load. The first request to any of them imports the
module, and every other action is served from it without importing again.

Middleware the module declares still runs, in the order it would have:

```ts
// ~/app/http/controllers/admin/clients.tsx
export default createController(routes.admin.clients, {
	middleware: [requireAdmin],
	actions: {
		index: (context) => context.render(<ClientList />),
	},
});
```

`requireAdmin` runs before `index`, after the router's own middleware chain, exactly
as it does when the controller is imported statically.

A loader may also resolve the handler itself, for a module that exports it under a
name instead of as its default:

```ts
router.map(
	routes.health,
	lazy(() => import("~/app/http/health").then((it) => it.check)),
);
```

## API

### `lazy(load)`

Returns a stand-in for the route's module, typed as that module's default export, to
pass wherever an action or a controller goes.

`load` is called at most once, on the first request that matches the route, and its
result is reused for every request after that.

```ts
function lazy<module>(load: () => Promise<module>): Loaded<module>;
```

The loader may resolve either a module with a `default` export or the handler value
itself. Anything else — a module whose default export is not a handler, an action
where the route expects a controller — is rejected at the `router.map()` call, since
the stand-in carries the module's own type.

## Patterns

### Deciding what to defer

The saving is the cost of the modules a request does not need, so the routes worth
deferring are the ones with the heaviest module graphs and the least traffic. An
admin section behind a guard, a rarely used export endpoint, and an OAuth client
registration screen are each a controller and its whole subtree of views, schemas
and services that a visit to the home page currently pays for.

Keep the routes on the hot path static. A route that is served by nearly every cold
start gains nothing from deferring and adds one microtask to its first response.

### Keeping the URL surface complete

Routes stay declared in one place and mapped at startup either way, so `.href()`
still resolves everywhere and the route map still describes every URL the server
answers. `lazy()` changes when the handler arrives, never whether the route exists.

### Where a mistake surfaces

Most wiring mistakes are still type errors at the `router.map()` call: a controller
mapped to a single route, an action mapped to a route map, and a controller missing
an action the route map declares are all rejected there.

What moves is the runtime check behind them. A static map validates a controller's
actions against the route map while the router is being built; a lazy one cannot,
because the actions are not there yet. Those checks run on the first request to the
route instead and throw with the same detail. Deferring a route trades a startup
failure for a first-request failure.

## Tips

- Point the loader at a bare `import()` and let the bundler split the chunk. A loader
  that computes its specifier cannot be split, and the deferral buys nothing.
- Defer whole controllers rather than single actions. A controller shares one module,
  so splitting its actions across loaders only multiplies chunks.
- Keep a route's own middleware in its module rather than at the map call, so it is
  deferred along with the handler it guards.
