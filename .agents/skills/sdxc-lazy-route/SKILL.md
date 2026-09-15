---
name: sdxc-lazy-route
description: "@sdxc/lazy-route provides lazy(), a stand-in for a remix/router route target that imports its module on the first request that matches, keeping controller module graphs out of cold start. Use when router.map() calls statically import every controller, when a cold isolate pays for routes it never serves, or when a route group's guard should answer before its controller is loaded."
---

# @sdxc/lazy-route

Maps a route to a module that is imported on the first request that reaches it. `lazy(load, middleware?)` returns a stand-in typed as the module's own default export, so it goes wherever an action or a controller goes on a `remix/router` router: the route is still mapped at startup, so matching and URL generation are unchanged, but the module behind it arrives with the first matching request. Pointing a route at the wrong module stays a type error at the `router.map()` call. It has one export and one dependency, `remix`.

Full API, options and examples: [packages/lazy-route/README.md](packages/lazy-route/README.md)

## When to reach for it

- A router module imports every controller at the top, so a cold start pays for the whole route table before serving one request.
- A runtime starts an isolate per cold request, so that cost is paid again in full every time, including for routes the request will never touch.
- A guarded section should answer an unauthorized request without importing the controller behind it.
- A route map's actions live in different modules and each should load on its own.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/lazy-route": "workspace:*" } }
```

```ts
import { lazy } from "@sdxc/lazy-route";

router.map(
	routes.bookmarks,
	lazy(() => import("./controllers/bookmarks")),
);
```

A group's shared guard goes in the second argument, where it runs before the module is loaded at all:

```ts
router.map(
	routes.admin.articles,
	lazy(() => import("./controllers/admin/articles"), [requireAdmin, purgeListing]),
);
```

## Suggestions

- Deferring the whole route table is usually the right default: each route pays a single import on the first request that reaches it, and a route the process never serves costs nothing beyond its pattern.
- Point the loader at a bare `import()` so the bundler can split the chunk. A loader that computes its specifier cannot be split, and the deferral buys nothing.
- The `middleware` argument is typed as middleware with no context transform, so one that publishes a context value is rejected — the loaded handler's type is the module's own and cannot grow to know a value declared at the map call. Publish those from the router's own chain or from inside the module.
- A stand-in is an object rather than a function, so it cannot be the `handler` of an outer action object. Pass the group's guards to `lazy()` instead of wrapping the loader.
- Validation a static map does at startup — a controller mapped to a single route, an action mapped to a route map, a controller missing a declared action — moves to the first request to that route, with the same detail. The corresponding type errors still fire at the `router.map()` call.
- A loader resolving a named export works too: `lazy(() => import("./controllers/health").then((it) => it.check))`.
