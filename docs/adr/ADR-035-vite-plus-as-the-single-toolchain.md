# ADR-035: Vite+ As The Single Toolchain

## Status

**Accepted** - 2026-08-16

## Background

Tooling in this monorepo is split across five independent tools with no shared configuration and no shared cache: Bun runs scripts, installs dependencies and executes tests; Oxlint lints; Oxfmt formats; `tsc --noEmit` type-checks once per workspace; Vite builds every app. Each has its own config file, its own CI job, and no knowledge of the others.

[Vite+](https://viteplus.dev) packages exactly this set of tools — Vite 8, Vitest, Oxlint, Oxfmt, tsgolint, tsdown — behind one `vp` CLI, one `vite.config.ts`, and a dependency-aware task runner with content-based caching. It is MIT-licensed and in beta. Because the repo already runs Vite 8, Oxlint and Oxfmt, adopting it is largely a consolidation of tools already in use rather than an introduction of new ones.

## Context

### Measured Baselines

Taken on this repo, 2026-08-16:

| Workload            | Time      | CPU  | Notes                           |
| ------------------- | --------- | ---- | ------------------------------- |
| Full test suite     | 4m36s     | 116% | 11,417 tests across 1,054 files |
| `apps/uptime` tests | 96s       | 112% | 262 files, ~366ms per file      |
| `bun typecheck`     | 33s local | 647% | 60 separate `tsc --noEmit` runs |
| Typecheck in CI     | 2m31s     | —    | slowest CI job by a wide margin |
| Lint / Format in CI | 15s / 38s | —    | already fast                    |

### The Test Runner Is Serial

`bun test --isolate` never exceeds ~116% CPU. `--isolate` is mandatory here because 356 call sites use `mock.module()`, which permanently replaces a module for the rest of the process; isolation buys a fresh registry per file at the cost of running files one at a time.

Measured against Vitest 4.1.10 on identical inputs:

| Workload                                    | `bun test --isolate` | `vp test` (threads) | Result             |
| ------------------------------------------- | -------------------- | ------------------- | ------------------ |
| `packages/u` — 303 small files, 1,033 tests | **4.14s** @ 116%     | 6.15s @ 796%        | Vitest 1.5x slower |
| 60 synthetic files @ ~350ms each            | 16.6s @ **99%**      | **5.5s** @ 395%     | Vitest 3x faster   |

Vitest carries higher per-file overhead and wins anyway, because this suite is dominated by heavy files. `apps/uptime` alone is 96s of the 276s total and runs effectively serially.

### Verified By Spike

Each of the following was executed, not inferred:

| Question                                                 | Result                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Does `vp` work in a Bun-installed workspace?             | Yes; Bun is detected as the package manager                                |
| Can `vi.doMock` replace `mock.module`?                   | Yes — 1:1 with the existing `doMock` + dynamic-import pattern              |
| Can the `cloudflare:workers` stub survive?               | Yes — a ~10-line Vite plugin replaces `test/setup.ts`                      |
| Does tsgolint match `tsc`?                               | Yes — identical TS2440 / TS2345 / TS2307 diagnostics, in 460ms             |
| Does `@cloudflare/vitest-pool-workers` work under Vite+? | Yes — `cloudflareTest()` plugin form, Vitest 4.1 peer satisfied            |
| Does MSW work inside workerd?                            | **Yes** — `msw/node` `setupServer` works under `nodejs_compat`             |
| Does `msw/browser` work inside workerd?                  | No — `setupWorker` throws "Failed to execute in a non-browser environment" |

The MSW result is the load-bearing one. It was initially assumed that `msw/node` could not run in workerd, which would have blocked `vitest-pool-workers` outright given 22 files depend on MSW and the repository guidelines forbid stubbing `globalThis.fetch`. Direct testing disproved that, including a negative control confirming that unhandled requests are rejected rather than silently passed through, and that per-test `server.use()` overrides work.

### Migration Surface

| Item                                       | Count |
| ------------------------------------------ | ----- |
| Files importing `bun:test`                 | 1,054 |
| `mock.module` / `mock` call sites          | 356   |
| Files mocking `cloudflare:workers`         | 84    |
| ...of those, using `@pkg/cloudflare-mocks` | 2     |
| Files using `bun:sqlite`                   | 37    |
| `Bun.*` API calls in tests                 | 47    |
| Files using MSW                            | 22    |
| `.spec` files (`@pkg/spec`)                | 44    |

`.spec` files run under their own CLI and are unaffected.

### Workspaces

Vite+ does not define workspace membership. It detects the package manager from the workspace root and reads its workspace declaration — here, `workspaces: ["apps/*", "packages/*"]` in the root `package.json`. What Vite+ owns is orchestration over that set: dependency-ordered `vp run -r`, `--filter` selection, transitive `-t` runs, and caching.

## Decision

Adopt Vite+ as the single toolchain. Bun is retained as the package manager and as the source of truth for workspace membership, and for nothing else.

### 1. Vite+ Owns The Commands

| Concern               | Before                    | After                      |
| --------------------- | ------------------------- | -------------------------- |
| Format                | `bunx oxfmt`              | `vp fmt` (via `vp check`)  |
| Lint                  | `oxlint --deny-warnings`  | `vp lint` (via `vp check`) |
| Typecheck             | 60x `tsc --noEmit`        | `vp check` (tsgolint)      |
| Test                  | `bun test --isolate`      | `vp test`                  |
| Build / dev / preview | `vite build` / `vite dev` | `vp build` / `vp dev`      |
| Task orchestration    | `bun run --workspaces`    | `vp run -r`, with caching  |

`.oxlintrc.json` and `.oxfmtrc.json` collapse into `lint` and `fmt` blocks in the root `vite.config.ts`, using `overrides` for the per-app settings they carry today.

### 2. Bun Is The Package Manager Only

`bun install`, the `workspaces` array, and the lockfile stay. `bun run <script>` and `bun test` are replaced. Vite+ managed Node.js (`vp env`) is left on, since Vitest and the toolchain run on Node regardless.

### 3. Vitest Replaces `bun:test`

`vi.doMock` replaces `mock.module`, `vi.fn`/`vi.spyOn` replace `mock`/`spyOn`, and `node:sqlite` replaces `bun:sqlite` wherever a test is not running inside workerd.

### 4. Worker Tests Run In workerd

Tests for the Workers apps move to `@cloudflare/vitest-pool-workers`. `cloudflare:workers` becomes the real module, `env` comes from Wrangler config plus Miniflare bindings, and D1, KV, queues and Durable Objects are the real implementations rather than fakes. This deletes the `mock.module("cloudflare:workers", ...)` injection point entirely — it is the only option that does so without refactoring application source to inject `env`.

Package tests that do not exercise a Worker stay on the default Node pool.

### 5. `@pkg/cloudflare-mocks` Is Adopted First, Then Narrowed

The 84 files that hand-roll ad-hoc binding literals are migrated to `@pkg/cloudflare-mocks` factories **before** the workerd migration, not after, even though workerd will later make most of those fakes unnecessary.

This ordering is deliberate. A file that reads `env: createEnv<Env>({ DB: createD1Database() })` converts to real bindings by deleting a block. A file with a bespoke literal like `QUEUE: { send: async () => {} }` has to be understood first — its stub encodes assumptions the test never states. Normalizing to the package makes the later migration mechanical and reviewable, and it is worth doing on its own merits regardless of whether the workerd step ever lands: [ADR-024](./ADR-024-cloudflare-binding-mocks-package.md) called for exactly this and adoption reached 2 files out of 84.

After the workerd migration, `@pkg/cloudflare-mocks` remains for package-level tests that never enter workerd. It is expected to shrink.

## Consequences

### Positive

- The suite parallelizes. The serial ceiling that costs 96s on `apps/uptime` alone is removed; the full suite is expected to land near 1.5-2 minutes rather than 4m36s.
- One config file and one cache replace five tools with no shared state. `vp check` collapses the three static-check CI jobs into one, targeting the 2m31s typecheck that is currently the slowest.
- Task caching skips unchanged work across runs and in CI, which no current tool does.
- Worker tests execute against real bindings in the real runtime. A malformed SQL statement, a queue retry, or a Durable Object transaction fails where it would in production instead of passing against a fake.
- `--isolate` stops being a mandatory footgun; isolation becomes the runner's default rather than a flag every invocation must remember.

### Negative

- Vite+ is beta software, and `@cloudflare/vitest-pool-workers` support for it landed only days ago ([workers-sdk#13075](https://github.com/cloudflare/workers-sdk/issues/13001)). Both are moving targets.
- The migration touches 1,054 test files. Most of it is mechanical, but the `mock.module` call sites need per-file judgement.
- Small, fast test files get measurably slower under Vitest — `packages/u` regresses from 4.14s to 6.15s. This is accepted as the cost of unblocking the heavy half.
- `vite` is aliased to `@voidzero-dev/vite-plus-core`, whose version does not satisfy the `vite: ^8` peer range that `@cloudflare/vite-plugin` declares. Peer warnings are expected.
- Three `MUST` rules in `AGENTS.md` are invalidated and have to be rewritten: use Bun to execute tests, write tests with `bun:test`, and run tests from the repo root.

### Neutral

- `@pkg/spec` and its 44 `.spec` files are untouched.
- Wrangler, deploys and migrations are unaffected; `bunx wrangler` stays.
- Type-aware lint walks `node_modules` when no `.gitignore` is present (48s over 8,960 files in a bare spike). This repo has one, so it does not apply here, but it is worth knowing when scaffolding new workspaces.

## Implementation Plan

### Phase 0 — Adopt `@pkg/cloudflare-mocks` (in progress)

Replace ad-hoc binding literals with package factories across the 84 files, typed as `createEnv<Env>(...)`. Committed per app or package. No runner change. Delivers value independently of every later phase.

### Phase 1 — `vp check`

Add the root `vite.config.ts` with `lint` and `fmt` blocks ported from `.oxlintrc.json` and `.oxfmtrc.json`, enable `typeAware` and `typeCheck`, and collapse the Format, Lint and Typecheck CI jobs into one. No test changes. Reversible by deleting one file.

### Phase 2 — Vitest pilot on `apps/uptime`

The largest and slowest workspace, and therefore the honest test of whether the mock translation holds at scale. Convert `bun:test` imports, `mock.module` to `vi.doMock`, and `bun:sqlite` to `node:sqlite`. Keep the Node pool. Gate the decision to continue on this phase's result.

### Phase 3 — Remaining workspaces

Mechanical once Phase 2 establishes the patterns. `Bun.file`, `Bun.serve`, `Bun.write`, `Bun.sleep` and `Bun.spawn` in tests move to Node equivalents. Retire `test/setup.ts` in favour of the Vite plugin that resolves `cloudflare:workers`.

### Phase 4 — `vitest-pool-workers` for the Workers apps

Per app, with MSW retained via `msw/node` under `nodejs_compat`. Deletes the `cloudflare:workers` module replacement and the Vite plugin stub. Shrinks `@pkg/cloudflare-mocks` to what package-level tests still need.

### Phase 5 — Task orchestration and cleanup

Move workspace scripts to `run.tasks` in the root config, enable caching in CI, and update `AGENTS.md`.

## Alternatives Considered

**Stay on `bun:test`.** Zero migration cost, and faster on small files. Rejected because the serial ceiling is structural: `--isolate` is required by the `mock.module` pattern, and no amount of tuning parallelizes a runner that runs one file at a time. It also leaves the toolchain split across five tools with no cache.

**Inject `env` through `@pkg/service-container` instead of moving to workerd.** Would remove the module replacement without changing runners. Rejected as a larger and riskier change: it refactors application source across every Worker rather than test code, and it still leaves tests asserting against fakes instead of real bindings.

**A dedicated task runner (Nx, Turborepo) alongside the current tools.** Would deliver caching and dependency-ordered tasks without touching the test runner. Rejected because it adds a sixth tool and a sixth config to a problem defined by tool sprawl, and does nothing for the serial test suite.

**`msw/browser` inside workerd.** Proposed as the workaround for the assumed `msw/node` incompatibility. Rejected on test: `setupWorker` requires `navigator.serviceWorker` and throws in a non-browser environment. Moot, since `msw/node` works.

## References

- [Vite+ documentation](https://viteplus.dev)
- [ADR-024: Cloudflare Binding Mocks Package](./ADR-024-cloudflare-binding-mocks-package.md)
- [Cloudflare Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)
- [workers-sdk#13001 — Vite+ support for vitest-pool-workers](https://github.com/cloudflare/workers-sdk/issues/13001)

## Current Progress

- [x] Phase 0 — `@pkg/cloudflare-mocks` adopted across the 84 files
- [x] Phase 1 — `vp check` replaces Format, Lint and Typecheck
- [x] Phase 2 — `apps/uptime` on Vitest
- [x] Phase 3 — remaining workspaces on Vitest
- [ ] Phase 4 — Workers apps on `vitest-pool-workers` (deferred, see below)
- [ ] Phase 5 — task orchestration, caching, `AGENTS.md`

## Phase 1 Outcome

`vp check` runs format, lint and type check in ~8s, against ~3m24s across the three CI jobs it
replaces. `.oxlintrc.json`, `packages/ui/.oxlintrc.json` and `.oxfmtrc.json` are gone; the root
`vite.config.ts` is the only place any of it is configured.

Enabling the type-aware path surfaced **769 findings the previous setup could not see**, all
now fixed. Two causes, in roughly equal measure:

- Ten packages excluded their own test files from `tsc`, so those files had never been type
  checked at all. Removing the exclusions took the error count from 31 to 61.
- The eight type-aware lint families had never run.

Among them were real defects, not style noise. `no-base-to-string` alone found file uploads
being written to the database as the literal `[object File]` across the blog-engine CMS, post
metadata destroyed as `[object Object]` on a database write, and the same `[object File]`
coercion in four apps' urlencoded form submissions. `no-floating-promises` found an unhandled
rejection that also left `data-transitioning` stuck on the host in `packages/ui`, and 18
unawaited rejection assertions in `packages/jwt` — one in a callback that was not even `async`.
`require-array-sort-compare` found a numeric sort that passed only because its fixture was
1–4. `packages/u`'s `isLength` was an unsound type predicate narrowing scale names to `never`,
so four mixins were interpolating `never` into CSS variable names.

Two tsgolint limitations are suppressed with `@ts-ignore` rather than worked around, both
documented at the site: compound-component expando assignment (`Chart.Tooltip = …`, which
`tsc` accepts) and the deliberately-incompatible override in `types/bun-test.d.ts`. Note that
`oxlint-disable` cannot suppress a `typescript(TSnnnn)` diagnostic — only `@ts-ignore` can, and
`@ts-expect-error` fails `tsc` with TS2578 because `tsc` reports no error there.

`types/bun-test.d.ts` corrects `bun-types`' declaration of the `resolves`/`rejects` chains,
which are typed as the synchronous matcher set. Without it the type-aware path flags every
`await expect(...).rejects` as awaiting a non-thenable, and the tempting fix — dropping the
`await` — would silently stop those assertions from asserting under Vitest, which only
auto-awaits a hanging assertion as a deprecated courtesy. All 116 rejection assertions are now
awaited, including 62 that already were not before this work.

## Phases 2 and 3 Outcome

The suite runs under Vitest: **1,058 files / 11,474 tests in 50.7s**, against the 276s baseline
this ADR opened with — **5.4x faster**. `vp check` is 8.6s. One file remains on `bun test`.

### The one file that keeps its own runner

`packages/spec/src/plugins/db.test.ts`. `packages/spec` is a `bun build --compile` CLI, and that
file's `describe("db end to end (SQLite)")` block connects through Bun's built-in `SQL` client to
prove the `rows` / `affected_rows` / `count` shaping and the connect-reuse-dispose lifecycle. Bun's
`SQL` has no Node equivalent, and under Node the lazy `import("bun")` fails, so those tests would
error rather than skip. Its other 11 tests never open a connection and could be split out; that
would leave `bun test` running three tests instead of fourteen, which is not worth splitting a
cohesive file for.

Everything else in the package did port: 25 of its modules already used `node:` APIs, and
`bun build --compile` accepts them, so the compiled binary came out **byte-identical** at
63,594,722 bytes with its `.spec` dogfood suites at 48/48.

The rest of the package's Bun surface became: `Bun.file` → `node:fs`, `Bun.spawn` →
`node:child_process`, `Bun.stdin` → `process.stdin`, `Bun.argv` → `process.argv`, `Bun.which` → a
PATH scan, `Bun.serve` → `node:http`, `Glob` → `globSync`, `Bun.sleep` → `node:timers/promises`,
`import.meta.dir` → `import.meta.dirname`, and `Bun.CryptoHasher` → `node:crypto`.

### Where Vitest costs time

`packages/u` — 303 files, 1,033 tests, a median of three assertions each — is **2-3x slower**
under Vitest:

|                    | bun   | Vitest |
| ------------------ | ----- | ------ |
| loaded (best of 5) | 3.11s | 5.71s  |
| idle               | 1.60s | 5.10s  |

Vitest's own breakdown explains it: 13.8s of import and 2.5s of transform fanned across threads
for 3.6s of actual execution. Per-file setup dominates when files are tiny. The aggregate still
wins by a wide margin, because the heavy files dominate the total — but this workspace is a real
loss, not an averaging artifact.

### Cross-runner divergences, each found by a failing test

`bun:sqlite` and `node:sqlite` disagree in four ways, all now absorbed by
`@pkg/cloudflare-mocks/sqlite` so a test cannot observe which runtime it is on:

| Divergence                                                                   | Consequence before the fix                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integral numbers bind as REAL under Node, INTEGER under Bun                  | `?/60000` did float division; `claimDue` computed different results per runner, and several tests passed while exercising arithmetic production never performs                                                                                                                                                                                                                      |
| A single array argument is positional under Bun, named parameters under Node | `Unknown named parameter '0'`                                                                                                                                                                                                                                                                                                                                                       |
| Double-quoted string literals are enabled under Bun, not Node                | An unresolved identifier degrades to a string. The migration history depends on this: `20250520185608` copies `"subject_id"` from a table whose column is `user_id`, so on any SQLite with the legacy behaviour every migrated row got the literal text. The adapter matches Bun so the runners agree; the migration bug is untouched and still latent for a fresh replay with rows |
| A miss is `undefined` under Node, `null` under Bun                           | Callers compare against `null`                                                                                                                                                                                                                                                                                                                                                      |

Two more, outside SQLite: Bun's `setSystemTime()` with no argument un-mocks the clock while
Vitest's **pins to real-now**, so the translation is `vi.useRealTimers()`; and Bun empties a
`Response` body stream when `clone()` runs after `.body` was read, which MSW's interceptor does —
worked around with a body-getter helper in the one affected file.

### Constraints worth knowing before editing the config

- **A `testTimeout` beside `projects` is not inherited by a project.** Verified with a 7s test that
  still failed at `Test timed out in 5000ms`. Each project sets its own. The slowest files spend
  ~4s applying every migration before their first assertion, so the 5s default left under 25%
  margin on a machine faster than CI.
- **A second `vi.doMock` for the same specifier in one file has no effect** — the second dynamic
  import resolves to the instance already in the registry rather than re-running its top-level
  code. This is why the two healthcheck branches are separate files.
- **`apps/pkmn` runs with `fileParallelism: false`.** Four of its dev-export tests snapshot, write
  and restore the app's real manifest and `src/assets` — writing to the real paths is what they
  assert. That was only ever correct because `bun test` ran files one at a time; in parallel one
  file's restore clobbers another's write. Parallelism exposed a genuine test-isolation bug rather
  than causing one.

### Phase 4 is deferred, not cancelled

`@cloudflare/vitest-pool-workers` would run the Workers apps' tests inside workerd against real
bindings, and the blocker this ADR identified is gone: `msw/node` works under `nodejs_compat`, and
Vite+ support landed in workers-sdk#13075. It is deferred because Phases 2 and 3 already removed
the reason it was urgent — the suite is 5.4x faster and `@pkg/cloudflare-mocks` gives every Worker
test behaviour-accurate bindings. Revisit it when a bug slips through that only real bindings would
have caught.
