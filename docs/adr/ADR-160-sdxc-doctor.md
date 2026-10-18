# ADR-160: `sdxc doctor`

## Status

**Accepted** - 2026-10-18

## Background

ADR-136 deferred `sdxc doctor`, a command that reports a project whose `@sdxc/*` packages come
from different releases. A project drifts in ways no single command notices: a package added by
hand at an older date, a `package.json` edited without an install, a `remix` pin that no longer
matches the peer the release's packages declare, or a secret declared in `cloudflare.config.ts`
that `.env.example` never lists. The last one passes on a developer's machine, which has a
`.dev.vars`, and fails in CI, which builds `.dev.vars` from `.env.example` before generating the
Worker's `Env` types. This ADR records `sdxc doctor`, which reports each of these with the
command that fixes it.

## Context

- `@sdxc/*` versions are UTC dates, and a daily release republishes only what changed, so a
  package at release D is its newest version on or before D (ADR-007). Pins from different dates
  are normal; a pin older than the package's version at the project's release is drift.
- `sdxc upgrade` (ADR-144) already reads the project's release (the newest dated `@sdxc/*` pin),
  resolves every package at a release from the npm registry, and moves `remix` to the peer the
  release's `@sdxc/kit` declares. `doctor` judges a project by the same rules.
- A Worker declares its secrets with `bindings.secret()` in `cloudflare.config.ts`; `cf deploy`
  uploads exactly the declared secrets. Values written in the config (`bindings.text()`,
  `bindings.json()`) carry their value with them, and `.env.example` may override one locally.
- An agent runs the command as often as a person, so the output needs a stable machine form.

## Decision

`sdxc doctor [--json]` runs a list of checks over the project and prints one line per check:
its status (`pass`, `warn`, `fail` or `skip`), its name, what it found, and, for a warning or
failure, the command that fixes it. `--json` prints the same report as one JSON document. The
run exits 1 when any check fails and 0 otherwise; a warning or a skipped check leaves it at 0.

### The checks

1. **`pins`**: every `@sdxc/*` pin in `package.json` is the package's version at the project's
   release. A lagging package fails with the version the release has for it, the exact-pin
   install command that moves it there, and, when a newer release exists, the version
   `sdxc upgrade` would move it to. A pin that names no dated version is a warning.
2. **`installed`**: every `@sdxc/*` package and `remix` that `package.json` pins exactly is
   installed in `node_modules`, found the way Node resolves it from the project root, at that
   version. A missing or different install fails with the package manager's install command.
3. **`remix`**: the `remix` pin equals the peer the project's release declares, the rule
   `sdxc upgrade` applies. A different pin fails with the exact-pin install command for the
   peer.
4. **`env`**: every key `cloudflare.config.ts` declares with `bindings.secret()` has a line in
   `.env.example`; a missing one fails. A key in `.env.example` that the config declares under
   no binding is a warning, since CI types it into `Env` and the Worker never receives it.

### Checks as a list

A check is a value with a name and a `run(context)` that answers its result; the command runs
the list in order and formats what comes back. The context loads the project's manifest once
and memoizes registry documents, so `pins` and `remix` share a fetch. A new check is a new entry
in the list and a test beside it.

### Without the registry

`pins` and `remix` need the npm registry. When it cannot be reached, each reports `skip` with
the registry's error, and the run goes on: the offline checks still pass or fail on their own.
A project with no dated `@sdxc/*` pin skips both, since it has no release to compare with.

### Reading the Worker config

`doctor` reads `cloudflare.config.ts` as text and collects every `KEY: bindings.<kind>(` it
contains, so a key declared inside a conditional spread counts too. Evaluating the module would
need the project's `cf` package, a runtime that loads TypeScript, and the mode the config is a
function of; the text form needs none, and every app's config writes its bindings this way. A
project without the file skips the check.

## Consequences

### Positive

- **Drift has one report.** Mixed releases, a skipped install, a mismatched `remix` and a key CI
  will miss show up together, each with its fix.
- **Agents read it directly.** `--json` and the exit code give a tool the verdict without
  parsing prose.
- **Same rules as `upgrade`.** A project `doctor` passes is one `sdxc upgrade` resolves the same
  way.

### Negative

- **Text matching sees only literal bindings.** A key built at runtime (a computed property name,
  an `env` object assembled in another module) is invisible to the `env` check.
- **Registry checks need the network**, and report `skip` without it.

## Implementation Plan

1. The check list, its context and the four checks in `packages/kit/src/doctor/`, with tests
   that answer the registry through MSW.
2. The `doctor` command in the contract, its handler, the README row and a section of the
   `sdxc` guide.

## Alternatives Considered

### 1. Evaluating `cloudflare.config.ts`

**Rejected because**: it ties `doctor` to the project's installed `cf`, a TypeScript loader and a
chosen mode, and a config that fails to evaluate would hide every other key; the bindings are
written literally, which text matching reads.

### 2. Comparing pins with each other

**Rejected because**: a daily release republishes only what changed, so pins from different
dates are the normal state; only the registry knows whether an older pin is the package's
version at the project's release.

### 3. Fixing what it finds

**Rejected because**: each fix is a command the person or agent already has (`sdxc upgrade`, an
install, an edit to `.env.example`), and printing it keeps `doctor` safe to run at any time.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-100: `cf` CLI and `cloudflare.config.ts`](./ADR-100-cf-cli-migration.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)

## Current Progress

- [x] Check list and context (`packages/kit/src/doctor/`)
- [x] `pins`, `installed`, `remix` and `env` checks, with tests
- [x] `sdxc doctor [--json]`, README row and guide section
