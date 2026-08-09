# ADR-014: Compiled Binary and Concurrent Execution

## Status

**Proposed** - 2026-08-09

This ADR records two runtime performance decisions for the spec CLI: how it
**starts** (a compiled standalone binary) and how it **schedules** tests
(bounded, opt-in concurrency). Like
[ADR-009](./ADR-009-v1-typescript-implementation.md),
[ADR-011](./ADR-011-project-and-third-party-plugins.md),
[ADR-012](./ADR-012-database-capability.md), and
[ADR-013](./ADR-013-project-config-permissions.md), it is an implementation
ADR: not standalone, free to reference this monorepo's packages and
conventions, and bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending
it. Its parent is [ADR-009](./ADR-009-v1-typescript-implementation.md), the v1
implementation plan: this document refines two of ADR-009's shipping choices
without reopening any design-suite **Open** item. Each choice forced by
shipping is recorded as **v1 provisional**: binding on this implementation,
invisible to the design record, cheap to revisit. The two decisions are
independent — the binary is a distribution/startup change, concurrency a
scheduling change — and are recorded together because both trade against the
same budget: the wall-time an operator waits for a suite.

## Context

[ADR-009 §1](./ADR-009-v1-typescript-implementation.md) shipped the CLI as a
workspace binary declared `"bin": { "spec": "./src/cli.ts" }` with a
`#!/usr/bin/env bun` shebang. That makes `spec` run anywhere the package is
installed, but every launch re-transpiles the TypeScript entry and its module
graph before the first test runs. For a single interactive run the cost is
invisible; for the dogfood suite it is not. The dogfood harness — the
`bun:test` wrapper that runs the CLI's own `.spec` files through the real CLI —
spawns one `spec` process per test, and several of those
tests spawn a **nested** `spec` to observe the CLI's exit codes — so the
per-launch transpile cost is paid dozens of times in a single suite run.

Two levers reduce the wall-time an operator waits:

1. **Startup** — pay the transpile/bundle cost once, ahead of time, instead of
   on every launch. This is the compiled binary, decided below.
2. **Scheduling** — let independent tests overlap so wall-time tracks the app
   under test rather than the runner. This is bounded concurrency, recorded in
   this ADR's concurrency half.

This half decides the first lever.

## Decision

### 1. A compiled standalone binary

Add a `build` script to `packages/spec/package.json` that compiles the CLI
entry into a single self-contained executable with Bun's bundler:

```jsonc
// packages/spec/package.json
"scripts": {
	"build": "bun build ./src/cli.ts --compile --outfile bin/spec"
}
```

`bun build --compile` bundles `src/cli.ts` and its entire module graph together
with the Bun runtime into one native executable at `packages/spec/bin/spec`.
This buys three things:

- **Fast start.** The transpile and bundle happen once at build time, not on
  every launch. Startup drops to process spawn plus a bundled-code load — there
  is no per-launch TypeScript compilation.
- **A single file.** The executable carries its own runtime and dependencies;
  it needs no `node_modules`, no `bun install`, and no source tree beside it.
- **Run anywhere.** Because it depends on nothing in its directory, the binary
  can be copied to any location and invoked from any working directory.
  `./bin/spec run <suite> --allow-*` resolves the suite against the caller's
  cwd exactly as the source entry does — verified by copying the binary to a
  temp directory and running a suite there, with no repo in sight.

**Source stays the dev entry.** The compiled binary is the
distribution/performance artifact, not a replacement for the source path.
`bun packages/spec/src/cli.ts run …` (and the workspace-linked `spec` bin from
[ADR-009 §1](./ADR-009-v1-typescript-implementation.md), which still points at
`./src/cli.ts`) remain the development entry: they pick up source edits with no
rebuild, which is what you want while iterating. You rebuild the binary when you
want the fast, shippable artifact.

**The binary is not committed.** `bin/` is gitignored. The executable is ~60MB
(it embeds the Bun runtime) and is fully reproducible from source with
`bun run build`, so committing it would only bloat history. It is a build
output, regenerated on demand, the same way a `dist/` would be.

**The dogfood harness spawns the compiled binary.** `src/dogfood.test.ts`
compiles the binary from current source, then runs the dogfood suite through it
— and places a `spec` symlink to that same binary on `PATH`, so the nested
`spec` processes the meta-tests spawn are also the fast binary. Every layer of
the acceptance run is the shipped artifact rather than a `bun cli.ts` transpile.
Building fresh in the test (rather than reusing a possibly-stale `bin/spec`)
keeps the acceptance layer honest to whatever source `bun test` is checking; the
compile costs ~100ms, negligible next to the suite it enables.

**Measured effect.** Running the 37-test dogfood suite end-to-end (outer runner
and every nested `spec` alike), on this machine with a warm cache:

| Launch mode                 | Dogfood wall-time (median of 3) |
| --------------------------- | ------------------------------- |
| `bun cli.ts` spawn (source) | ~1.10s                          |
| Compiled binary spawn       | ~0.90s                          |

The ~0.2s saving is the amortized transpile cost the source path pays on every
one of the suite's process launches. The win grows with the number of launches;
a single interactive `spec run` sees a smaller absolute difference but the same
faster first-test start.

## Consequences

- An operator (or CI job) that runs a suite repeatedly can build once with
  `bun run build` and pay no transpile cost per launch thereafter.
- The binary is portable: copy `bin/spec` onto a machine with neither Bun's
  source-mode toolchain nor the repo and it still runs suites, resolving them
  against the caller's cwd.
- Two entry points now exist with a clear division of labor — source
  (`bun …/src/cli.ts`, live edits, dev) and binary (`bin/spec`, fast, ship) —
  and neither shadows the other; the package's `bin` field is unchanged.
- The dogfood acceptance test now exercises the exact artifact a user would run,
  not an approximation, and got faster doing so.
- A ~60MB artifact lands under `packages/spec/bin/` after a build; it is
  gitignored, so it never enters version control, but a `bun run build` is now
  part of producing the shippable CLI.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **Cross-platform and published artifacts.** `bun run build` compiles for the
  host platform only. Cross-compilation (`--target`) and a release pipeline that
  attaches per-OS binaries are out of scope for v1; the source entry remains the
  portable fallback anywhere Bun is installed.
- **Bytecode caching.** Bun offers `--bytecode` for a further startup reduction
  at the cost of a larger artifact and a tighter Bun-version coupling. It was
  left off pending a measured need beyond what the plain compile already buys.
