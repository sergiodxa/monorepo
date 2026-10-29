# ADR-183: Drop the `sdxc` Umbrella Package

## Status

**Accepted** - 2026-10-28

## Background

[ADR-136](./ADR-136-sdxc-umbrella-package-and-cli.md) introduced an unscoped `sdxc` package that
re-exported every `@sdxc/*` package under `sdxc/*` and carried the `sdxc` CLI.
[ADR-148](./ADR-148-sdxc-kit-cli-package.md) moved the CLI to `@sdxc/kit` after npm refused the
unscoped name (`403 Package name too similar to existing packages sax,shx,solc,tsdx,esdoc,jsdoc`)
and kept `packages/sdxc` private while waiting on an exception. npm's answer is final: the name
will not be granted.

## Context

- Kits, templates, stubs and the UI registry already import and document `@sdxc/*`.
- Guides install the CLI with `npm add -g @sdxc/kit`; the `bin` name remains `sdxc`.
- The main in-repo consumer of `sdxc/*` imports is `apps/sdxc-site`.
- A scoped umbrella (`@sdxc/sdxc`, `@sdxc/all`) would invent a second install story consumers do
  not need; a different unscoped name would rename every guide and template for no gain.

## Decision

1. Delete `packages/sdxc` and the generator, drift tests and release special cases that exist only
   for the unscoped umbrella.
2. Consumers install the packages they use as `@sdxc/<name>`, and install the CLI with
   `npm add -g @sdxc/kit`.
3. Docs, the documentation site, kits and templates show `@sdxc/*` imports and the kit install.
4. Do not publish a scoped or differently named umbrella.

## Consequences

### Positive

- One install story: `@sdxc/<name>` for libraries, `@sdxc/kit` for the command line.
- The private package, its generator and drift tests stop consuming release and CI time.

### Negative

- Lose the Remix-style one-install `sdxc/markdown` UX ADR-136 aimed for.

### Neutral

- Kits and per-package installs were already the public path under ADR-148; published consumers
  see no change.

## Alternatives Considered

### 1. Scoped umbrella (`@sdxc/sdxc` or `@sdxc/all`)

**Rejected** — a second install spelling beside every `@sdxc/<name>`, with no npm-name problem to
solve.

### 2. Different unscoped name

**Rejected** — renames every guide, template and import for a name nobody asked for.

### 3. Keep the umbrella private forever

**Rejected** — a private package only the docs site uses is maintenance cost without a publish
path.

## References

- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-148: The `sdxc` Command Line Ships as `@sdxc/kit`](./ADR-148-sdxc-kit-cli-package.md)
