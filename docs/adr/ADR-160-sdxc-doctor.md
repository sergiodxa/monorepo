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
- Every app follows one layout (ADR-129) and a set of conventions (routes through `lazy()`,
  models registered in `createModels`, migration chains that replay on an empty database) that
  the repo's own tests enforce for its apps. A project made with `sdxc create` has none of those
  tests, so `doctor` is where a project learns it drifted from them.
- A project has rules of its own that no built-in check knows, and the kit already lets a
  project replace its stubs from a configured folder (`make.stubs`).

## Decision

`sdxc doctor [--json] [--only <check>] [--skip <check>]` runs a list of checks over the
project, then the checks the project defines, and prints one line per check: its status
(`pass`, `warn`, `fail` or `skip`), its name, what it found, and, for a warning or failure, the
command that fixes it. `--json` prints the same report as one JSON document. The run exits 1
when any check fails and 0 otherwise; a warning or a skipped check leaves it at 0. `--only` and
`--skip` take check names, repeated or comma-separated; a name no check has ends the run with
the list of names there are.

A check **fails** on what breaks an install, a build, CI or a new database, and **warns** on a
convention the app still runs without. A check whose input the project lacks (no `routes/`, no
copied component) reports `skip`, so the same command runs on any project.

### The checks

1. **`pins`**: every `@sdxc/*` pin in `package.json` is the package's version at the project's
   release. A lagging package fails with the version the release has for it and, when a newer
   release exists, the version `sdxc upgrade` would move it to; the fix is
   `sdxc upgrade <release>`. A pin that names no dated version is a warning.
2. **`installed`**: every `@sdxc/*` package and `remix` that `package.json` pins exactly is
   installed in `node_modules`, found the way Node resolves it from the project root, at that
   version. A missing or different install fails with the package manager's install command.
3. **`remix`**: the `remix` pin equals the peer the project's release declares, the rule
   `sdxc upgrade` applies. A different pin fails with `sdxc upgrade <release>`, which pins the
   peer together with any lagging `@sdxc/*` package.
4. **`env`**: every key `cloudflare.config.ts` declares with `bindings.secret()` has a line in
   `.env.example`; a missing one fails. A key in `.env.example` that the config declares under
   no binding is a warning, since CI types it into `Env` and the Worker never receives it.
5. **`typegen`**: `.cloudflare/types/index.d.ts` exists and is newer than `cloudflare.config.ts`,
   `.dev.vars` and `.env.example`. Missing or older types warn with `sdxc run typegen`: a
   binding added since types as missing until it runs.
6. **`migrations`**: every chain in `make.migrations` replays on an empty in-memory SQLite
   database with double-quoted string literals disabled, the replay `make migration
--from-model` already uses. A file that stops the replay fails, named with SQLite's error: a
   new database, tenant or test run replays the whole chain, and with double-quoted strings on,
   as the adapters run, `"old_name"` in a rebuild's `SELECT` silently copies the string.
   A migration that already ran in production cannot be edited, so a project lists its known
   errors under `doctor.migrations.accept`, each as the file and the column SQLite's error
   names. The replay steps past an accepted error, a statement at a time between Drizzle's
   `--> statement-breakpoint` markers, so the rest of the file and every later file are still
   checked; any other error in the same file still fails. Accepted errors are findings on a
   passing line, and an entry no error matches any more warns, so the list shrinks with the
   errors it excuses.
7. **`layout`**: `app/` holds only the layout's folders (ADR-129), and no module in `app/`,
   `config/`, `database/`, `resources/` or `routes/` imports `bootstrap/`. Each stray folder and
   each import is a warning.
8. **`routes`**: every route a root contract declares is mapped by a router, and every
   `router.map()` goes through `lazy()`, read with the same source reader as `sdxc routes`. An
   unmapped route answers 404 while links to it type check; an eager mapping loads its
   controller on every request. Both warn. A controller object is judged action by action: an
   action behind `lazy()`, or an inline handler that loads its module with a dynamic `import()`,
   is lazy, and only an action loaded with the router is named.
9. **`models`**: every module in `app/models/` that calls `createModel(` is imported by
   `app/models/index.ts`, statically or on first use. Helpers and Durable Objects beside the
   models create no model, so they are left alone. A missing one warns, since `ctx.models`
   never reaches it.
10. **`ui`**: every component copied with `sdxc ui add` is current with the installed kit's
    registry, the comparison `sdxc ui list` makes. A copy a later release changed warns with
    `sdxc ui update <names>`; an edited copy is a finding with the `sdxc ui diff` to read, and
    leaves the status as it is.

The order puts what an install fixes first and the app's own code last.

### Project checks

A project adds checks as modules in the `doctor.checks` folder, `.config/sdxc/checks/` by
default, the configuration key and location `make.stubs` follows. Each `.ts` or `.js` module
(tests and declaration files left out) default-exports one check or a list of them:

```ts
import { defineCheck } from "@sdxc/kit/doctor";

export default defineCheck({
	name: "no-env-in-resources",
	async run(ctx) {
		let files = await ctx.files("resources");
		let found = [];
		for (let file of files) {
			if ((await ctx.readFile(file))?.includes("cloudflare:workers")) found.push(file);
		}
		if (found.length === 0) return { status: "pass", message: "Views read no bindings" };
		return {
			status: "fail",
			message: "Views import env",
			findings: found,
			fix: "Pass the value in from the controller",
		};
	},
});
```

`@sdxc/kit/doctor` exports `defineCheck`, which only types the check, and the types of its
context and result. A result needs a `status` and a `message`; `findings` defaults to none and
`fix` to `null`. The name is lowercase words joined by dashes, and it must differ from every
built-in check and every other project check, since `--only`, `--skip` and an agent reading
`--json` address a check by name.

The checks run after the built-in ones, in one child process of the project's runtime, the
runtime `sdxc run` picks (Bun for a Bun project, Node otherwise), started in the project root.
That is how `make migration --from-model` loads a model: the kit itself runs under Node or Bun,
and a check imports what the app imports, resolved by the app's own `node_modules` and loader.
The parent hands the child its input on stdin and reads the reports back from one marked line
of stdout, so anything a check logs stays out of the report.

The context is read-only: the project root, `package.json` as written, the configuration with
its defaults, the routes as `sdxc routes --json` lists them, and `readFile`, `exists` and
`files` over paths relative to the root. A path that leads outside the project throws. Writing
is left out on purpose: `doctor` stays safe to run at any time, in CI and by an agent.

Whatever a check does comes back as a report and never stops the run. A module that fails to
import, or that exports no check, fails under its path; a check that throws, answers a result
with no known status or message, uses a name already taken, or runs past 30 seconds fails under its
name, with the error as its finding and the module to fix. A runner that cannot start at all
fails once, under the folder's path.

### Checks as a list

A check is a value with a name and a `run(context)` that answers its result; the command runs
the list in order and formats what comes back. The context loads the project's manifest once
and memoizes registry documents, so `pins` and `remix` share a fetch. A new check is a new entry
in the list and a test beside it.

### Without the registry

`pins` and `remix` need the npm registry. When it cannot be reached, each reports `skip` with
the registry's error, and the run goes on: the offline checks still pass or fail on their own.
A project with no dated `@sdxc/*` pin skips both, since it has no release to compare with.

### In CI

The monorepo runs `bun run doctor` in CI after typegen: the root CLI's `doctor` command runs the
kit's command line from the checkout in every app, each report folded under the app's name, and
fails the job when any app fails. Apps pin `@sdxc/*` packages to the workspace, so `pins` and
`remix` skip without asking the registry, and the run stays offline.

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

- **A project's rules run with the rest.** A team's own conventions report in the same lines,
  with the same exit code and JSON, as the kit's.
- **A broken check cannot hide the others.** Load errors, throws and hangs are failed reports.

### Negative

- **Text matching sees only literal bindings.** A key built at runtime (a computed property name,
  an `env` object assembled in another module) is invisible to the `env` check.
- **Registry checks need the network**, and report `skip` without it.
- **Source reading has limits.** `routes` reads `lazy()` only where the initializer calls it or a
  local helper returns it; a `lazy()` value imported from another module reads as eager.
  `models` recognises a model by its `createModel(` call.
- **`typegen` compares modification times**, so a checkout that touches every file reports the
  types as stale until they are regenerated.
- **Node needs type stripping for TypeScript checks**, which Node 22.18 and later have; on an
  older Node a project writes its checks in JavaScript.

## Implementation Plan

1. The check list, its context and the four checks in `packages/kit/src/doctor/`, with tests
   that answer the registry through MSW.
2. The `doctor` command in the contract, its handler, the README row and a section of the
   `sdxc` guide.
3. `typegen`, `migrations`, `layout`, `routes`, `models` and `ui`, each with a test over a
   fixture project.
4. Project checks: `@sdxc/kit/doctor`, the `doctor.checks` key, the runner and `--only` /
   `--skip`, with tests that run each failure mode in a real child process.

## Alternatives Considered

### 1. Evaluating `cloudflare.config.ts`

**Rejected because**: it ties `doctor` to the project's installed `cf`, a TypeScript loader and a
chosen mode, and a config that fails to evaluate would hide every other key; the bindings are
written literally, which text matching reads.

### 2. Comparing pins with each other

**Rejected because**: a daily release republishes only what changed, so pins from different
dates are the normal state; only the registry knows whether an older pin is the package's
version at the project's release.

### 3. Loading project checks in the kit's own process

**Rejected because**: the kit runs under Node or Bun whatever the project uses, so a check
would resolve its imports from the kit rather than the app, and a check that hangs or calls
`process.exit` would take `doctor` down with it.

### 4. Listing check modules in the configuration

**Rejected because**: a folder needs no edit to add a check, matches how `make.stubs` locates
project files, and still moves with one key.

### 5. A per-check child process

**Rejected because**: starting the runtime once per check multiplies startup cost by the number
of checks; one child with a per-check time limit isolates each check's failure the same way.

### 6. Fixing what it finds

**Rejected because**: each fix is a command the person or agent already has (`sdxc upgrade`, an
install, an edit to `.env.example`), and printing it keeps `doctor` safe to run at any time.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-100: `cf` CLI and `cloudflare.config.ts`](./ADR-100-cf-cli-migration.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-129: App Folder Layout](./ADR-129-app-folder-layout.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)

## Current Progress

- [x] Check list and context (`packages/kit/src/doctor/`)
- [x] `pins`, `installed`, `remix` and `env` checks, with tests
- [x] `sdxc doctor [--json]`, README row and guide section
- [x] `typegen`, `migrations`, `layout`, `routes`, `models` and `ui` checks, with tests
- [x] Project checks (`@sdxc/kit/doctor`, `doctor.checks`), `--only` and `--skip`, with tests
- [x] `doctor.migrations.accept` for errors of migrations that already ran, with tests
- [x] `bun run doctor` over every app, run in CI after typegen
- [ ] Guide section for project checks
