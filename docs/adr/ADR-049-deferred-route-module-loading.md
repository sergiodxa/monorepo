# ADR-049: Deferred Route Module Loading

## Status

**Implemented** - 2026-09-06

## Background

A Worker answers its first request on a cold isolate, and everything the entry point
imports is evaluated before that request is dispatched. The router's composition root
imports every controller so it can map every route, which means a visit to `/` waits
for the admin section, the OAuth endpoint set, the account pages and every view,
schema and helper each of those pulls in.

That cost grows with the URL surface rather than with the request, and it is paid
again on every cold start. An authorization server with thirty mapped routes loads
all thirty controllers to answer one.

## Context

### What the router needs, and when

The router takes a handler at map time and calls it at request time, and those are
two different moments. Mapping needs the route pattern, the request method, and
enough of the handler to register a matcher entry; serving needs the handler itself.
Only the first has to happen at startup.

The handler a route is mapped with takes one of two shapes, decided by the target
rather than by the module:

| Target         | Handler                                   |
| -------------- | ----------------------------------------- |
| A single route | A function, or `{ middleware?, handler }` |
| A route map    | `{ middleware?, actions }`                |

A controller's actions are read against the keys of the route map it was mapped to,
and each action's middleware is merged behind the controller's before the entry is
registered.

### Why middleware is the hard half

Deferring only the handler function is not enough. Route middleware is registered
alongside the handler at map time, so a stand-in that produces a handler later has
no middleware to hand over, and the chain the module declared would silently not
run. In an app where `requireAdmin` is declared on the controller it guards, that is
not a missing feature but an open admin section.

So a deferred route must run the loaded module's middleware itself, at request time,
in the same order and with the same short-circuit contract the router uses. That is
the one piece of router behavior this decision reimplements.

### Where validation moves

Mapping a controller statically validates it against the route map immediately: an
unknown action, a nested route map used as an action key, and a missing action all
throw while the router is being built. A deferred route has no actions to check
until it loads, so those checks move to the first request that reaches the route.

Most of them are still caught earlier by types, because the stand-in carries the
type of the module's default export: a controller mapped to a single route, an
action mapped to a route map, and a controller missing an action are all type errors
at the `router.map()` call. What actually moves is the runtime backstop behind them.

## Decision

Add `@sdxc/lazy-route`, a package whose single export wraps a loader:

```ts
router.map(
	routes.authorize,
	lazy(() => import("~/app/http/controllers/authorize")),
);
```

`lazy()` returns one value that stands in for both handler shapes — an object with a
`handler` method and an `actions` proxy — because which one the router reads is
decided by the map target, and it never reads both. The proxy answers for any action
name and enumerates as empty, which is what tells the router that every action it
asks for is present and that none of them is a stray.

On the first request the module is imported, its default export is taken as the
action or controller, its middleware chain is assembled, and the chain runs ahead of
the handler. The resolved module is memoized, so every later request to any route
backed by it is served without importing again.

The return type is the type of the module's default export, unchanged, so the route
checks its params and its request context exactly as a static import did.

## Consequences

### Positive

- A cold start loads only the modules the routes it actually serves need.
- The URL surface is untouched: routes are still declared in one place and mapped at
  startup, so `.href()` resolves everywhere and matching is unchanged.
- Adoption is per route. A composition root can defer its heaviest, least-visited
  controllers and leave the hot path static.
- Type checking is unchanged, so a route pointed at the wrong module is still a type
  error at the map call.

### Negative

- A controller's action validation happens on the first request to the route rather
  than at startup, so a wiring mistake that types did not catch surfaces as a failed
  request instead of a failed boot.
- The middleware chain contract is reimplemented in this package, and would need to
  follow the router if that contract changed.
- The first request to a deferred route pays the import it was spared elsewhere.

### Neutral

- Splitting is the bundler's job. A loader that computes its specifier cannot be
  split, so the deferral only pays off with a literal `import()`.

## Alternatives Considered

### Defer only the handler, declare middleware at the map call

Keeps the package trivial — no middleware runner — but moves each route's guards out
of the module they guard and into the composition root, where they are easy to omit
and easy to get out of order. Rejected: it makes the dangerous mistake the quiet one.

### Build a child router per deferred route at load time

Would reuse the router's own middleware handling exactly rather than reimplementing
it. Rejected: dispatching through a child router builds a fresh request context, so
everything the parent's middleware installed — the session, the invocation's log,
the container-resolved services — would be lost on the way in.

### Leave it to the bundler

A bundler can split a chunk but cannot decide not to evaluate a module the entry
point imports. Deferring the import is what the entry point has to express.

## References

- [`packages/lazy-route/README.md`](../../packages/lazy-route/README.md)
