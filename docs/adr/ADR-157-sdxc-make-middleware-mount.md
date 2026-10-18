# ADR-157: `sdxc make middleware --mount`

## Status

**Implemented** - 2026-10-18

## Background

ADR-143 declares and maps a job, a controller, an MCP handler, a command and a model as soon as
`sdxc make` writes it, and deferred the middleware: `sdxc make middleware require-user` writes
`app/http/middleware/require-user.ts` and its test, and the middleware runs nowhere until the
developer imports it into a chain and calls it there. This ADR records `--mount`, which does that
second step in the same run.

## Context

The app layout (ADR-129) and the app template give a request two kinds of chain:

| Chain              | Where                                   | Shape                                                            |
| ------------------ | --------------------------------------- | ---------------------------------------------------------------- |
| The router's chain | `app/initializers/router.tsx`           | `createRouter({ middleware: [asyncContext(), log(logger), …] })` |
| A controller chain | `app/http/middleware/page.ts`, `api.ts` | `export default createMiddleware(formData(), cop(), …)`          |

AGENTS.md requires the router's global middleware inline in `createRouter({ middleware: [...] })`,
so `AppContext` reads what each entry publishes, and every page and API controller passes the
chain its contract uses as its `middleware`. An app may have more chains than the template's two
(an admin chain, a webhook chain) and more than one router initializer, so the set of places a
middleware can go is the project's, not a fixed list.

`@sdxc/codemod` (ADR-137) adds a property to an object literal and a statement after a call, but
had no edit that appends to a list: an array literal or a call's own arguments.

## Decision

### `--mount <target>`

`sdxc make middleware <name> --mount <target>` writes the middleware and its test as before, then
imports the middleware's default export into the target and calls it at the end of the target's
chain:

```bash
sdxc make middleware require-user --mount page
sdxc make middleware request-id --mount router
```

```ts
// app/http/middleware/page.ts
import requireUser from "~/app/http/middleware/require-user";

export default createMiddleware(
	formData(),
	// …
	render({ assets: assetResolver }),
	requireUser(),
);
```

The built-in middleware stub default-exports a factory that takes no arguments, so the mounted
entry is `<key>()`, the camelCase name of the file's last segment. A middleware that needs options
gets them by hand after the run.

### Targets come from the project

`make` reads the project for the targets it can mount on, and each is named after its file:

- **Router chains.** Every initializer in `app/initializers/` that imports `createRouter` and
  calls it, named after the file without its extension: `router` for `router.tsx`. The entry is
  appended to the `middleware` array of the object literal the first `createRouter(…)` call
  receives.
- **Controller chains.** Every module under `app/http/middleware/` whose default export is a
  `createMiddleware(…)` call, named after its path inside that folder without the extension:
  `page`, `api`, `admin/page`. The entry is appended to the call's arguments.

A router initializer and a chain with the same name resolve to the router initializer. A target
the project does not have is a usage error that lists the ones it does, and nothing is written:

```text
No middleware chain "admin" to mount on; this project has: router, api, page
```

### Appended last, through `@sdxc/codemod`

The new entry goes after the chain's last one, so it runs after everything the chain already
publishes (the session, the language, the renderer) and right before the controller or the
contract's chain. Moving it earlier is a hand edit; the end of the chain is the one position that
never runs a middleware before something it reads.

`@sdxc/codemod` gains `addElement`, which appends source text to a list: the arguments of the
first call to a callee, or the array literal reached through `path` inside the object literal
that call receives. It follows the list's layout the way `addProperty` does: one entry per line
with the siblings' indentation and trailing-comma style, or inline after the last entry.

The import follows the form the target already uses for app modules (`~/app/…` in the template,
relative otherwise), as ADR-143's mappings do.

### Lands with the file, or is printed

The edit follows ADR-143's rule: it is computed before anything is written, and when it cannot
be placed — the router passes no `middleware` array, or the target already binds the
middleware's name — `make` writes the middleware and its test, leaves the target untouched, and
prints the import and the entry to add. `--dry-run` prints the target's diff with the files.

## Consequences

### Positive

- **A generated middleware runs immediately.** The one remaining kind whose file is dead until a
  hand edit now wires itself in.
- **The targets are the project's own chains.** An app with an admin chain mounts on `admin`
  without configuration, and a project without a `page.ts` is never offered one.

### Negative

- **Only the end of a chain.** A middleware that must run before an existing one is moved by
  hand.
- **Option-taking middleware.** A project stub whose factory takes arguments mounts a call with
  none, which the type checker reports.

## Alternatives Considered

### 1. A fixed set of targets (`router`, `page`, `api`)

**Rejected because**: the template's names are a starting point; apps add chains and rename
initializers, and a fixed list would refuse the chains an app actually uses.

### 2. Insert before a named middleware (`--before render`)

**Rejected because**: the entries are calls with arbitrary arguments, so naming one by its
callee is ambiguous for chains that call a helper twice, and the end of the chain is right for
the middleware `make` writes, which publishes on the context for the controller.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-153: One Router for Pages and API](./ADR-153-one-router-for-pages-and-api.md)

## Current Progress

- [x] `addElement` in `@sdxc/codemod`
- [x] `--mount` on `sdxc make middleware`, with targets read from the project
