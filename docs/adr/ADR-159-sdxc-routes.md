# ADR-159: `sdxc routes`

## Status

**Accepted** - 2026-10-18

## Background

An app's URL surface is spread over several files: the route contracts in `routes/` declare
names, methods and patterns; the router initializer maps each route onto a controller through
`lazy()`, with guards in `lazy()`'s second argument and global middleware in
`createRouter({ middleware })`; and each controller adds its own chain (`page`, `api`). Answering
"what runs for `POST /cms/articles`?" means reading all of them. React Router answers the same
question with `react-router routes`. This ADR records `sdxc routes`, which prints the whole table
for a person or, with `--json`, for an agent.

## Context

- Route contracts are `route({ … })` declarations built from the `remix/routes` helpers (`get`,
  `post`, `put`, `patch`, `del`, `head`, `options`, `form`, `resources`, `resource`), nested in
  plain objects or `route(prefix, { … })` groups, spread (`...resources(…)`), and composed from
  other contracts (`cms: route("/cms", cms)`).
- Router initializers (ADR-129) map a route, a group of routes or an object of routes onto a
  handler: usually `lazy(() => import("…"))`, sometimes `.then((it) => it.named)`, a local helper
  that returns a `lazy()`, or an inline `{ actions: { … } }` controller.
- Neither file can be imported by the command line as it is. The router initializer imports
  `cloudflare:workers`, reads bindings and resolves `~/` aliases through the app's bundler; route
  contracts resolve the same aliases and may import schema packages. `sdxc` runs under Node.
- `@sdxc/codemod` (ADR-137) already scans JavaScript, TypeScript and JSX into tokens, which is what
  `sdxc make` builds its edits on.

## Decision

### Read the project statically

`sdxc routes` reads `routes/`, `app/initializers/` and the controllers they import as source, with
the `@sdxc/codemod` scanner and a small expression reader in `@sdxc/kit`. It evaluates the subset
of TypeScript a contract is written in (string literals, object and array literals, spreads,
member access, imports between project modules and module-level `const`s) and runs the
`remix/routes` helpers' own rules over it: `form()` declares `index` and `action`, `resources()`
and `resource()` expand to their seven or six actions with `only`, `exclude`, `param` and
`names`, and a prefix joins every pattern under it.

**Static over runtime** because the command then works in any project without bindings, an
environment, a bundler or a dependency install, runs under Node as fast as it reads files, and has
no side effects: nothing in the app executes. The price is that a route written with code the
reader does not evaluate (a computed key, a pattern built at runtime) is reported rather than
resolved; the table still lists everything else.

`@sdxc/codemod` exports its scanner (`tokenize`) for this, so the command reads strings, template
literals, regular expressions and JSX the same way the edits `sdxc make` writes do.

### What a route reports

| Field        | Meaning                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `method`     | `GET`, `POST`, …, or `ANY` for a bare pattern                                                                                  |
| `pattern`    | The full URL pattern, prefixes joined                                                                                          |
| `contract`   | The route contract it is declared in, `routes/web.ts`; a contract composed into another reports the outer one                  |
| `name`       | Its key path in the contract, `posts.show`                                                                                     |
| `router`     | The initializer that maps it, or `null` when no router does                                                                    |
| `controller` | `{ file, export }`: the module `lazy()` or an import loads and the export used, or `null`                                      |
| `middleware` | `router` (global, in order), `guards` (`lazy()`'s second argument), `controller` (the controller's chain and the action's own) |

A middleware entry is `{ name, from }`: the expression as written (`log(logger)`, `page`), a long
call shortened to `rateLimit(…)`, and `from` the project file or package it is imported from, or
`null` when it is declared in the same file. A module-level array of middleware (`CMS_GUARDS`)
and its spreads are expanded to the middleware they hold.

### Output

- **Default:** a table per contract (method, pattern, name, controller, guards and controller
  middleware), with each router's global middleware listed once above it, since every route runs
  it first.
- **`--json`:** one array of the objects above, in contract order then declaration order, the
  same for every run over the same files. Diagnostics go to stderr in both modes, so stdout
  always parses.
- A route no router maps is listed with `controller: null`. A mapping whose handler the reader
  cannot follow keeps its `router` with `controller.file: null`, and the file and expression are a
  diagnostic; an inline controller reports the initializer as its file and `export: null`.

## Consequences

### Positive

- **One view of the URL surface** for a person, and a stable document an agent reads instead of
  opening the contract, the router and every controller.
- **Runs anywhere:** no bindings, no build, no app code executed.
- **Unmapped routes surface:** a declared route with `controller: null` is a mapping that is
  missing.

### Negative

- **The reader follows the shapes the templates and ADR-129 use.** A route or mapping built with
  arbitrary code is reported as unresolved.
- **The `remix/routes` helper rules are restated** in `@sdxc/kit`; a Remix release that changes
  them needs a matching change.

## Alternatives Considered

### 1. Import the router at runtime

Run the router initializer under the app's runtime and walk the mapped routes.

**Rejected because**: the initializer imports `cloudflare:workers` and builds middleware from
bindings, so it only loads inside the Worker toolchain, and a router keeps no public list of what
it maps or of the middleware a lazy controller declares.

### 2. Import only the route contracts at runtime

**Rejected because**: under Node the contracts' `~/` imports do not resolve without the app's
bundler, and the mapping, guards and controller chains still need the static reader.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-153: One Router for Pages and API](./ADR-153-one-router-for-pages-and-api.md)
