# ADR-148: The `sdxc` Command Line Ships as `@sdxc/kit`

## Status

**Accepted** - 2026-10-15

> The wait on npm granting `sdxc` is over: the name stays refused. [ADR-183](./ADR-183-drop-sdxc-umbrella.md)
> deletes the private umbrella; `@sdxc/kit` remains the CLI.

## Background

ADR-136 put the umbrella re-exports and the `sdxc` command line in one unscoped package,
`sdxc`. Publishing it failed: npm refuses new unscoped names it finds too close to existing
packages, and answered `403 Package name too similar to existing packages sax,shx,solc,tsdx,
esdoc,jsdoc`. Names under a scope the publisher owns skip that check. An exception for `sdxc`
has been requested from npm; the answer and its timing are unknown.

## Decision

Split ADR-136's package in two:

- **`@sdxc/kit`** (`packages/kit`) is the command line: `create`, `init`, `make`, `ui`, `upgrade`
  and `run`, with the templates, stubs, configuration and lock schemas, the component registry
  and the changelog the release build writes into it. Its `bin` is named `sdxc`, so
  `npm add -g @sdxc/kit` gives the same `sdxc` command ADR-136 describes. A command's name comes
  from `bin`, not from the package name.
- **`sdxc`** (`packages/sdxc`) stays the umbrella that re-exports every package as `sdxc/*`. It
  re-exports `@sdxc/kit` like any other package, as `sdxc/kit`, and keeps a `bin` named `sdxc`
  that runs the kit's command line, so installing `sdxc` also provides the command once it is
  on npm.

Until npm grants the name, `sdxc` is `private`: the release leaves it out and the
documentation site does not list it. Guides install and import the `@sdxc/*` packages they use.

Documentation writes the command as a global install types it, `sdxc run …`, and installs it
with `npm add -g @sdxc/kit`. Imports name each package, `@sdxc/<name>`.

## Consequences

### Positive

- **The command line ships now.** `@sdxc/kit` publishes under the owned scope, whatever npm
  decides about `sdxc`.
- **Each package has one job.** Imports and the command line version together through the
  daily release but install separately, so a global CLI no longer carries every package's
  source.

### Negative

- **The umbrella still cannot publish** until npm grants `sdxc`; apps import `@sdxc/<name>`
  directly until then.
- **Two packages to bootstrap** on npm instead of one.

### Neutral

- If npm grants `sdxc`, both installs work: `npm add -g sdxc` through the umbrella's `bin`, and
  `npm add -g @sdxc/kit`.

## Alternatives Considered

### 1. Publish the umbrella as `@sdxc/kit` or `@sdxc/sdxc`

**Rejected because**: imports would read `@sdxc/kit/markdown`, and every guide, template and app
would change spelling twice if npm later grants `sdxc`.

### 2. Wait for npm's answer

**Rejected because**: nothing that needs the command line could publish meanwhile, and the
answer may never come.

## References

- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [npm: package name guidelines](https://docs.npmjs.com/package-name-guidelines)

## Current Progress

- [x] `packages/kit` holds the command line, templates, stubs, schemas, registry and changelog
- [x] `packages/sdxc` re-exports `sdxc/kit` and runs the kit from its `bin`
- [x] Bootstrap `@sdxc/kit` on npm and configure its trusted publisher
