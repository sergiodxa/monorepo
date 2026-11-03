# ADR-189: Scripted CI with Local Signoff

## Status

**Accepted** - 2026-11-03

## Background

Every check this repository runs before a change lands is defined twice: once as commands a
developer runs by hand (`bun check`, `bun run doctor`, `bun run test`) and once as steps in
`.github/workflows/ci.yml`. The YAML is where the authoritative order, the setup between steps and
the per-workspace split live, and none of it can be run on a laptop. A developer who already ran
every check locally still waits for GitHub Actions to run them again on every push to `main` and
every pull request.

Rails 8.1 answered the same problem with `bin/ci` and `config/ci.rb`
([rails/rails#54693](https://github.com/rails/rails/pull/54693)): CI is a script in the
repository, the same script runs locally and on a CI host, and a green local run signs the commit
off with a GitHub commit status so the hosted run can be skipped. This ADR adopts that model as a
standalone package, `@sdxc/ci`, integrated into `@sdxc/kit` as `sdxc ci`.

## Context

### Current CI

| Job                  | What it runs                                                                        |
| -------------------- | ----------------------------------------------------------------------------------- |
| `check`              | Install, example secrets, `cli typegen` in every app, `bun run doctor`, `bun check` |
| `commits`            | `sdxc doctor --only commits` over the pushed range                                  |
| `workspaces`         | `git ls-files` piped through `awk` to list every workspace holding a test           |
| `test (<workspace>)` | One job per listed workspace, with Chromium installed when it has browser tests     |

The matrix gives each workspace its own job, its own check on GitHub and its own log, and the
jobs run on separate machines. A local run has none of that: `bun run test` is one process, and a
failure is found by reading its output.

### Constraints specific to this repository

| Constraint                                                    | Consequence for a local signoff                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Several sessions share one checkout and commit to `main`      | A run can see another session's uncommitted files or a moved HEAD               |
| Most changes are pushed straight to `main`, not opened as PRs | A signoff must work on a push, where CI starts the moment it lands              |
| CI types each Worker's env from `.env.example`                | A local run types it from `.dev.vars`, which can hold extra keys                |
| CI copies `.env.example` over `.dev.vars`                     | Doing that locally would overwrite real secrets                                 |
| Tests always run from the repository root                     | A workspace's tests run as `bun run test "<absolute path>/"`, not in its folder |
| `@sdxc/kit` owns where a project keeps its configuration      | A standalone CI package must take the script's path as input                    |
| The script imports `@sdxc/ci` from `node_modules`             | Dependencies must be installed before the script can load                       |
| CI installs through Socket Firewall (`sfw bun install`)       | The hosted install must stay in the workflow, wrapped by the firewall           |

## Decision

1. **`@sdxc/ci`** is a standalone package: the script API, the runner, the cache, signoff and
   push, and the `sdxc-ci` command line. It holds no opinion on where a script lives.
2. **`@sdxc/kit`** integrates it as `sdxc ci`, reading `.config/sdxc/ci.ts`, adding workspace
   scoping, and writing a default script and workflow into every app `sdxc create` makes.
3. **This repository** gets one root `.config/sdxc/ci.ts`. Apps and packages inside it get no
   script of their own; per-workspace work is a matrix inside the root script.
4. **GitHub Actions** runs the same script, and skips the whole run when a contributor has already
   signed the commit off.

### Dependencies come before the script

The script imports `@sdxc/ci`, and its steps run tools from `node_modules`, so installing
dependencies is a precondition of a run and never a step inside it. A step that reinstalled
would also replace modules under the process already running them.

| Runner  | Who installs                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Local   | `sdxc ci`, before it loads the script, with the project's package manager and its frozen-lockfile flag |
| Remote  | The workflow's own install step, wrapped by Socket Firewall; `sdxc ci` skips its install               |
| Neither | `sdxc-ci run` installs nothing; the caller installs first                                              |

The local install is what keeps a signoff honest: a run against a `node_modules` older than the
lockfile would test the wrong dependencies, and a lockfile out of sync with a `package.json` fails
the frozen install before any step runs. It prints as the first line of the run, outside the step
summary; a failure exits 1 without loading the script. `--no-install` skips it for a run that
already installed.

### The script

A script is an async function. `await` orders steps, `ci.parallel` and `ci.matrix` run them
concurrently, and ordinary control flow expresses everything else, so there is no separate
dependency graph to declare.

```typescript
import { defineCI } from "@sdxc/ci";

export default defineCI(async (ci) => {
	if (ci.runner === "remote") await ci.step("Example secrets", copyExampleSecrets, { halt: true });
	await ci.step("Typegen", "bun --filter '*' cli typegen", { halt: true });

	await ci.parallel("Static checks", [
		() => ci.step("Doctor", "bun run doctor"),
		() => ci.step("Check", "bun run check"),
		() => ci.step("Commits", "sdxc doctor --only commits"),
	]);

	let tested = (await ci.workspaces()).filter((ws) => ws.has("**/*.test.{ts,tsx}"));
	await ci.parallel("Tests", [
		() => ci.step("Tests for root", "bun run test --project root", { cache: true }),
		() =>
			ci.matrix("Workspaces", tested, async (ws) => {
				await ci.step(`Tests for ${ws.name}`, `bun run test "${ws.absolute}/"`, { cache: true });
			}),
	]);

	if (ci.status === "passing") await ci.signoff("All systems go.");
	else ci.failure("CI failed. Do not push.", "Fix the steps above and run `sdxc ci` again.");
});
```

### `ci.step(name, run, options?)`

`run` is a shell string, an argv array, or a function. A string is shorthand for
`(step) => step.run(string)`.

```typescript
await ci.step("Build apps", async (step) => {
	let typegen = await step.run("bun --filter './apps/*' cli typegen");
	if (isFailure(typegen)) return typegen;
	return step.run("bun --filter './apps/*' build");
});
```

| Step handle member | Contract                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| `step.run(cmd)`    | Runs a command into the step's output buffer and returns a `Result`              |
| `step.log(...)`    | Writes to the same buffer                                                        |
| `step.signal`      | An `AbortSignal` fired on Ctrl-C or the step's `timeout`; `step.run` forwards it |

A function step's outcome is the `Result` it returns; with no return value, it fails when any
`step.run` inside it failed. A thrown error fails the step and is reported under it. Commands run
inside a function belong to its log; one step is one row of the summary.

| Option    | Default | Contract                                                                    |
| --------- | ------- | --------------------------------------------------------------------------- |
| `halt`    | `false` | A failure halts the run (or the matrix entry); later steps return `skipped` |
| `cache`   | off     | `true`, or `{ inputs, env, outputs }`; see Caching                          |
| `cwd`     | root    | Directory the command runs in                                               |
| `env`     | none    | Extra environment variables for the command                                 |
| `timeout` | none    | Milliseconds after which `step.signal` fires and the step fails             |

`ci.step` resolves to the step's outcome: `{ status: "passed" | "failed" | "skipped", cached,
duration, output }`. A halted run never throws: every later call resolves to `skipped`, so the
script keeps its shape and still reaches its closing call.

### `ci.parallel(name, functions, options?)`

Runs each function concurrently as one group with its own header and status. It takes functions
rather than promises because each one is called inside the group's async context, which is how a
`ci.step` started in it is attributed to the group.

| Option        | Default                     | Contract                                            |
| ------------- | --------------------------- | --------------------------------------------------- |
| `failFast`    | `false`                     | A failure aborts the siblings through `step.signal` |
| `concurrency` | `os.availableParallelism()` | Upper bound on this group's running steps           |

Only leaf steps take a concurrency slot. Groups and matrix entries hold none, so nesting can never
deadlock, and the global `--concurrency` (default `os.availableParallelism()`) bounds the number
of commands running at once however groups are nested. Parallel output is buffered per step and
printed whole when the step finishes.

### `ci.matrix(name, items, fn, options?)`

`ci.parallel` with one call of `fn` per item. Each call is a matrix entry: a sub-run with its own
summary row, its own steps nested under it, its own `passing | failing | halted` status, and a key.
`halt` inside an entry halts only that entry.

The key defaults to the item's `name`, or the item itself when it is not an object, and the
`key` option overrides it. An entry is addressed as `<matrix>/<key>`
(`Workspaces/@sdxc/jwt`) by `--only`, `--scope` and the GitHub Actions matrix. Options are those of
`ci.parallel` plus `key`.

### `ci.workspaces()`

Reads the root `package.json` `workspaces` globs and returns plain objects, so filtering is
ordinary array code.

| Field          | Contract                                                             |
| -------------- | -------------------------------------------------------------------- |
| `name`         | The workspace's package name                                         |
| `path`         | Path relative to the repository root                                 |
| `absolute`     | Absolute path on disk                                                |
| `manifest`     | The parsed `package.json`                                            |
| `dependencies` | Workspaces this one depends on through `workspace:` ranges           |
| `dependents`   | Workspaces that depend on this one, directly or transitively         |
| `files()`      | The workspace's tracked files                                        |
| `has(glob)`    | Whether any tracked file matches, synchronously, for use in `filter` |

The root suites (`test/`, `scripts/`) are no workspace and run as their own step.

### Run state: `ci.status`, `ci.runner`, `ci.scope`

| Property    | Values                                    | Contract                                             |
| ----------- | ----------------------------------------- | ---------------------------------------------------- |
| `ci.status` | `pending`, `passing`, `failing`, `halted` | See below; never returns to `passing`                |
| `ci.runner` | `local`, `remote`                         | From the `CI` variable, overridden by `--runner`     |
| `ci.scope`  | `string[]` or `null`                      | Workspace paths from `--scope`; `null` on a full run |

`pending` means no step has finished; `passing` means at least one passed and none failed;
`failing` means a step failed and later steps still run; `halted` means a `halt` step failed and
later steps return `skipped`. The status changes the moment a failing step settles, so a script
reads it after awaiting the group it cares about. Statuses describe a run in progress, which is
why they read `passing`/`failing`; a step's own outcome is final and reads `passed`/`failed`.

### Closing calls

| Call                          | Prints                        | Posts a status  | Exit code                       |
| ----------------------------- | ----------------------------- | --------------- | ------------------------------- |
| `ci.success(title, detail?)`  | Green closing message         | No              | 0                               |
| `ci.signoff(title?, detail?)` | Green message and the signoff | Yes, if guarded | 0; 1 with `--push` when refused |
| `ci.failure(title, detail?)`  | Red closing message           | No              | 1                               |

`ci.failure` fails a run whose steps all passed, for checks the script makes itself. `ci.success`
and `ci.signoff` called while the status is not `passing` are script errors: the run prints the
failure and exits 1. A script that calls none of them ends with the summary, and the steps decide
the exit code. `--no-signoff` turns `ci.signoff` into `ci.success` for one run; on the remote
runner `ci.signoff` posts nothing, because the hosted checks are the green mark there.

### Signoff

A signoff is a GitHub commit status with context `sdxc/ci`, posted through the REST API with a
token from `GITHUB_TOKEN` (or the variable `--token-env` names), falling back to `gh auth token`.
Its description records the machine and the duration.

`ci.signoff` posts only when every guard holds:

| Guard                                                     | Protects against                           |
| --------------------------------------------------------- | ------------------------------------------ |
| Every step passed (cached counts) and status is `passing` | Signing a failure                          |
| The run was complete: no `--only`, `--skip` or `--scope`  | Signing a partial run                      |
| `git status --porcelain` is empty at start and end        | Testing files that are not in the commit   |
| HEAD at the end equals HEAD at the start                  | Another session committing during the run  |
| The commit exists on the remote                           | The status API rejecting an unknown commit |

Every green, complete, clean run writes `.git/sdxc-ci/<sha>.json`, whether or not it signs off.
Signoffs from macOS are accepted; the pinned browser-test fonts already remove the known
platform differences in test results.

### Push

`--push` runs the script; when the closing call is `ci.signoff` and its guards up to the last one
hold, it pushes the exact tested commit (`git push <remote> <sha>:<upstream branch>`) and posts the
status immediately. Pushing first and signing afterwards cannot work, because CI starts the moment
the push lands; pushing from the tool shrinks the gap to the seconds the gate job waits. A rejected
push (another session pushed first) exits 1; the rebased commit is a new commit and needs a new run.
Pull-request branches work the same way: the upstream is the PR branch and the status lands on the
PR's head commit.

### Caching

A step with `cache` is skipped as `passed (cached)` when a previous run passed it with the same key:
the command, the content of every input (git object hashes for tracked files, hashed contents for
untracked ones), the listed environment variables, the OS, and the Bun and Node versions. Only
passing results are stored, in `.git/sdxc-ci/cache/`, shared by every worktree of the clone.

| Field     | Contract                                                                    |
| --------- | --------------------------------------------------------------------------- |
| `inputs`  | Globs whose content forms the key                                           |
| `env`     | Environment variables whose values form the key                             |
| `outputs` | Paths a hit requires to still exist and match, for steps that produce files |

`cache: true` inside a matrix entry over workspaces uses the entry's files, its dependencies' files
and the root lockfile, configuration and `tsconfig.json`; elsewhere it uses every tracked file, so
it hits only when nothing changed. Cached passes count toward a signoff, which is what makes a full
run cheap enough to be the one that signs off. `--no-cache` ignores the cache for one run.

### `sdxc-ci` command line

It follows ADR-187: `bin` `sdxc-ci`, `--json` on every report, exit codes 0 done / 1 problems found
/ 2 usage or unreadable input, and the token read from an environment variable, never argv.

```text
sdxc-ci run <script> [flags]     Run a CI script; sign off and push when it asks to
sdxc-ci list <script> [flags]    Print the steps and matrix entries a fully passing run takes
sdxc-ci signoff [<sha>]          Post the signoff recorded by an earlier green run of <sha>
sdxc-ci verify <sha> [flags]     Exit 0 when a contributor signed <sha> off
```

| `run` flag               | Contract                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `--only <glob>`          | Run only matching steps or entries (`Workspaces/@sdxc/jwt`); repeatable            |
| `--skip <glob>`          | Skip matching steps or entries; repeatable                                         |
| `--scope <path>`         | Keep entries whose key or path is in scope, plus their dependents; sets `ci.scope` |
| `--runner local\|remote` | Override detection from `CI`                                                       |
| `--push`                 | Push the tested commit, then sign off                                              |
| `--no-signoff`           | `ci.signoff` behaves as `ci.success`                                               |
| `--no-cache`             | Run every step                                                                     |
| `--concurrency <n>`      | Global limit on running steps; default `os.availableParallelism()`                 |
| `--remote <name>`        | Remote to push to and read the repository from                                     |
| `--token-env <NAME>`     | Variable holding the GitHub token                                                  |
| `--json`                 | Every step and entry with status, duration and output, plus the signoff            |

`run` takes a path only: the script is a module to import, so the ADR-187 stdin input does not
apply. `list` runs the script with every step stubbed to `passed`, so branches taken only on
failure are absent; it exists to build `--only` patterns and the hosted matrix
(`list --matrix Workspaces --json` prints the entry keys). `signoff` refuses a commit with no
record under `.git/sdxc-ci/`, so it can never mark an untested commit green.

`verify` accepts only a successful `sdxc/ci` status whose creator has write, maintain or admin
permission on the repository. `--wait <duration>` polls until one appears; `--repo` overrides the
repository read from the remote. It exits 0 when signed, 1 when not (the report names no status, a
failed one, or one from a non-contributor), and 2 when the API is unreachable, so an outage never
reads as "unsigned".

### `sdxc ci` in `@sdxc/kit`

```text
sdxc ci [flags]                  sdxc-ci run .config/sdxc/ci.ts [flags], from the project root
sdxc ci list [flags]             sdxc-ci list .config/sdxc/ci.ts [flags]
sdxc ci signoff [<sha>]          sdxc-ci signoff [<sha>]
sdxc ci verify <sha> [flags]     sdxc-ci verify <sha> [flags]
```

- On the local runner, `sdxc ci` installs dependencies with a frozen lockfile before loading the
  script; `--no-install` skips that.
- Run from inside a workspace, `sdxc ci` adds `--scope <that workspace>`; the scope widens to every
  dependent, so `packages/jwt` also runs each app using `@sdxc/jwt`.
- An optional `ci.script` key in `sdxc.jsonc` moves the script; with none found, `sdxc ci` exits 2
  and names the expected path.
- `sdxc doctor` gains a `ci` check: the script exists, loads, and names every step uniquely within
  its group, since `--only`, `--skip` and the summary address steps by name.
- `sdxc create` writes a default `.config/sdxc/ci.ts` (typegen, doctor, check, build, test,
  signoff) and a `ci.yml` with the gate wired to `sdxc ci verify`. Inside an existing
  workspace it writes neither, because the repository root owns CI.

### GitHub Actions

`ci.yml` gains a `gate` job that every other job needs:

```yaml
gate:
  outputs:
    signed: ${{ steps.verify.outputs.signed }}
  steps:
    - id: verify
      run: if sdxc ci verify "$SHA" --wait 60s; then echo "signed=true" >> "$GITHUB_OUTPUT"; fi
```

| Job                   | Becomes                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `check` and `commits` | `sdxc ci --runner remote --skip "Tests*"`                                |
| `workspaces`          | `sdxc ci list --runner remote --matrix Workspaces --json`                |
| `test (<entry>)`      | `sdxc ci --runner remote --only "Workspaces/<entry>"`, one job per entry |
| root suites           | `sdxc ci --runner remote --only "Tests for root"`                        |

Every job runs `if: needs.gate.outputs.signed != 'true'`; GitHub treats skipped jobs as passing
for required checks. Commits nobody signed off (cloud sessions, web edits, outside contributors)
run in full exactly as today. Each job keeps its `sfw bun install --frozen-lockfile` step before
running `sdxc ci`, which skips its own install on the remote runner. Chromium's cache and system
dependencies stay in YAML, because caching is an Actions feature. `codeql.yml`, `release.yml` and
`deploy-apps.yml` do not change.

## Consequences

### Positive

- **One definition of CI** - the script is what runs locally and on GitHub Actions; the YAML
  only provisions machines and expands the matrix.
- **No duplicate runs** - a commit a contributor signed off skips the hosted run entirely.
- **Per-workspace results locally** - matrix entries give the same separate rows, logs and
  re-runnable keys the hosted jobs give.
- **Fast full runs** - with caching, a full run re-tests only workspaces whose inputs changed,
  so the run that signs off costs about as much as a scoped one.
- **Safe in a shared checkout** - the clean-tree and unchanged-HEAD guards keep a run from signing
  off files another session left behind.
- **Reusable** - `@sdxc/ci` works in any repository with a `package.json`; the kit's opinions stay
  in the kit.

### Negative

- **Trust moves to the contributor's machine** - a signoff from a machine with a stale toolchain or
  a different OS is accepted. The `.env.example` parity gap needs its own step to stay closed.
- **Push races cost a re-run** - when another session pushes first, the rebased commit needs a new
  run; the cache keeps that short but not free.
- **Cache inputs can be incomplete** - a step whose real inputs exceed its declared ones can hit a
  stale green. Workspace defaults cover the common case; `--no-cache` is the escape hatch.
- **First uncached local run is slower** - one Vitest process per workspace pays startup per
  entry instead of once.

### Neutral

- **GitHub only** - signoff and verify use GitHub commit statuses; other hosts can run the script
  but cannot skip their runs until a status backend exists for them.
- **YAML remains** - machine setup, Chromium caching and matrix expansion stay in `ci.yml`.

## Implementation Plan

### Phase 1: `@sdxc/ci` runner

**Priority:** High

1. Package skeleton per the new-package checklist, `defineCI`, `ci.step` with string, argv and
   function runs, `halt`, `cwd`, `env`, `timeout`.
2. `ci.parallel`, `ci.matrix`, the leaf-step concurrency queue, buffered output and the summary.
3. `ci.status`, `ci.runner`, closing calls, `sdxc-ci run` and `list` with `--only`, `--skip`,
   `--json`.

### Phase 2: Signoff

**Priority:** High

1. Guards, `.git/sdxc-ci/<sha>.json` records, `ci.signoff`, `--push`, `sdxc-ci signoff`.
2. `sdxc-ci verify` with the contributor-permission check and `--wait`.

### Phase 3: Workspaces and caching

**Priority:** Medium

1. `ci.workspaces()` with the dependency graph, `--scope`, `ci.scope`.
2. Cache keys, storage, `outputs`, workspace-default inputs, `--no-cache`.

### Phase 4: Kit and this repository

**Priority:** Medium

1. `sdxc ci`, the local frozen install and `--no-install`, scoping from the current folder, the
   `ci.script` key, the doctor check.
2. Default script and workflow in the `sdxc create` template.
3. This repository's `.config/sdxc/ci.ts`, a parity step for `.dev.vars` keys missing from
   `.env.example`, and `ci.yml` rewritten around the gate.

## Alternatives Considered

### 1. The `gh-signoff` extension

Rails signs off with `gh extension install basecamp/gh-signoff`.

**Rejected because**: it is a manual "mark green" command with no link to a run. Posting the status
from the runner lets the guards decide, and the REST API needs no extension.

### 2. A `ci.ts` in every app and package

**Rejected because**: a signoff covers one commit, so separate scripts are each partial and still
need a root script to combine them; about 140 near-identical scripts would say "run my tests". A
matrix over `ci.workspaces()` picks up new workspaces automatically.

### 3. A declarative step graph with `needs`

**Rejected because**: it rebuilds GitHub Actions' YAML model in TypeScript. `await`,
`ci.parallel` and `halt` express the same ordering, and step outcomes allow any branch a graph
cannot.

### 4. A matrix callback that returns a step description

An earlier design had `ci.matrix` callbacks return `{ key, run, cache }`.

**Rejected because**: an entry then holds exactly one command. Running `ci.step` inside the
callback lets an entry build and then test, with `halt` scoped to the entry.

### 5. A boolean `ci.success`

**Rejected because**: before any step finishes, `true` claims a success that has not happened and
`false` claims a failure that has not either. `ci.status` names that state `pending`.

### 6. Signoff in git notes pushed with the commit

An atomic push of the commit and a `refs/notes/sdxc-ci` note would remove the race with the
hosted run.

**Rejected because**: every session appends to the same notes ref, so concurrent pushes conflict
on it, and GitHub shows no green check for a note.

### 7. Installing dependencies as the script's first step

**Rejected because**: the script cannot load until `@sdxc/ci` is installed, and reinstalling from
inside a run replaces modules the runner is executing. On the hosted runner the install must also
stay wrapped by Socket Firewall, which only the workflow provides.

### 8. `sdxc ci` inside `@sdxc/kit` only

**Rejected because**: the runner, cache and signoff know nothing about sdxc projects and are useful
in any repository; the kit keeps only the script's location, scoping and templates.

## References

- [rails/rails#54693: Add `bin/ci`](https://github.com/rails/rails/pull/54693)
- [basecamp/gh-signoff](https://github.com/basecamp/gh-signoff)
- [GitHub REST API: commit statuses](https://docs.github.com/en/rest/commits/statuses)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-187: Package Command Lines](./ADR-187-package-command-lines.md)
- [ADR-188: Deterministic Browser Tests](./ADR-188-deterministic-browser-tests.md)

## Current Progress

- [x] Phase 1: `@sdxc/ci` runner
- [x] Phase 2: Signoff
- [x] Phase 3: Workspaces and caching
- [ ] Phase 4: Kit and this repository
  - [x] `sdxc ci`, `list`, `signoff`, `verify`, the frozen install, scoping and `ci.script`
  - [x] Default script and workflow in the `sdxc create` template, left out inside a workspace
  - [ ] The `sdxc doctor` `ci` check
  - [ ] This repository's `.config/sdxc/ci.ts` and `ci.yml` around the gate

## Notes

- `ws.has(glob)` is synchronous so it works in `Array.prototype.filter`; it reads from the tracked
  file list `ci.workspaces()` loads once.
- The gate waits 60 seconds because `--push` posts the status seconds after the push; a signoff
  posted later than that only costs a redundant hosted run.
- Contributors are resolved per status creator through the collaborator-permission endpoint, so a
  fork's contributor cannot skip CI on a pull request by posting a status from their own token.
