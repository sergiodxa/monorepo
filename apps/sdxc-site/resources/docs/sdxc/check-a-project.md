---
title: Check a project
description: Lint a project for release drift, missing secrets, stale Worker types, migrations a new database cannot replay, layout and wiring mistakes, JSDoc comment shape, and the rules you add yourself, with sdxc doctor.
section:
    title: The sdxc command
    order: 2
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "What each `sdxc doctor` check looks for, and the fix it names when it fails"
    - "How to accept a migration that already ran instead of rewriting it"
    - "How to add a check of your own and run `doctor` in CI"
---

A project drifts in ways no test catches: a package left behind a release, a secret declared
but never set, a migration a new database cannot replay, a route no router maps. Run one
command to find them all before a deploy or a review does:

```bash
sdxc doctor
```

It runs every check against the project and prints one line per check, each marked
`pass`, `warn`, `fail` or `skip`, with the exact command or edit that fixes what it found:

```text
pass  pins             Every @sdxc package is at release 2026.10.17
fail  installed        node_modules differs from package.json: @sdxc/cli 2026.9.4 is installed, package.json pins 2026.10.17. Fix: bun install
pass  remix            remix 3.1.0 is the peer release 2026.10.17 declares
pass  env              .env.example lists every secret cloudflare.config.ts declares
warn  typegen          The Worker's env types were never generated; .cloudflare/types/index.d.ts is missing. Fix: sdxc run typegen
skip  migrations       The project has no migrations
pass  layout           app/ holds only the layout's folders and nothing imports bootstrap/
warn  routes           Found 1 route no router maps: GET /pricing (routes/web.ts pricing) is mapped by no router. Fix: Map each route in its router initializer as router.map(route, lazy(() => import(…))); sdxc make controller writes and maps one
pass  models           app/models/index.ts registers every model in app/models/
pass  emails           3 declared emails mapped, tested and previewable
pass  jsdoc            Every comment is JSDoc within three description lines
pass  complexity       Every function stays at cyclomatic complexity 4 or below
pass  module-size      Every module stays within 200 code lines
pass  dependencies     No import cycles; every layer edge points inward
pass  fan-out          Every module imports at most 15 others
pass  orphans          Every non-entry module is imported somewhere
skip  feature-scatter  No feature folder name appears in more than one layer
pass  duplication      No duplicated blocks of 8+ code lines
pass  result-throws    App source returns Result failures instead of throw
pass  test-ratio       Code to test ratio is 1:0.8 (min 1:0.3)
skip  crap             No coverage at coverage/coverage-final.json; run tests with coverage then re-run doctor
skip  mutation         No mutation report at reports/mutation/mutation.json; run mutation tests then re-run doctor
skip  ui               No @sdxc/ui component is copied
```

A `fail` is something that breaks an install, a build, CI or a new database. A `warn` is a
convention the project strays from. A `skip` is a check with nothing to look at, such as a
project with no migrations, or one that could not reach the npm registry.

`doctor` changes nothing itself, and exits 1 when any check fails, so it fits a CI step or a
pre-commit hook. Warnings leave the exit code at 0.

## Apply the fixes it can make

Several fixes are a command or an edit with one right answer, and `sdxc fix` makes them for you:

```bash
sdxc fix --dry-run
sdxc fix
sdxc fix env
```

| Command           | What it repairs                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `sdxc fix`        | runs the command `pins`, `installed`, `remix`, `typegen` or `ui` names, such as `bun install` or `sdxc run typegen` |
| `sdxc fix env`    | appends each secret `cloudflare.config.ts` declares and `.env.example` lacks                                        |
| `sdxc fix models` | registers each model `app/models/index.ts` leaves out                                                               |
| `sdxc fix emails` | maps each declared email in `app/initializers/mail.ts`                                                              |

`--dry-run` prints what each would run or write. Run `sdxc doctor` again afterwards; the rest of
its findings, such as a migration to correct, need your judgement.

## The checks

They run in this order:

| Check             | Fails or warns when                                                                                                                                                                | Fix                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pins`            | fail: an `@sdxc` package is behind its version at the project's release; warn: one is pinned to no release                                                                         | `sdxc upgrade <release>`                           |
| `installed`       | fail: `node_modules` holds an `@sdxc` package or `remix` at another version than `package.json` pins, or lacks one                                                                 | the install command                                |
| `remix`           | fail: `remix` differs from the version the project's release declares                                                                                                              | `sdxc upgrade <release>`                           |
| `env`             | fail: `.env.example` leaves out a secret `cloudflare.config.ts` declares; warn: it lists a key no binding declares                                                                 | the line to add, or the declaration                |
| `typegen`         | warn: `.cloudflare/types/index.d.ts` is missing, or older than `cloudflare.config.ts`, `.dev.vars` or `.env.example`                                                               | `sdxc run typegen`                                 |
| `migrations`      | fail: a `make.migrations` chain does not replay on an empty database with double-quoted strings off; warn: an accepted error no longer occurs                                      | the migration to correct, or the entry             |
| `layout`          | warn: a folder in `app/` the layout does not have, or an import of `bootstrap/` from `app/`, `config/`, `database/`, `resources/` or `routes/`                                     | the file to move                                   |
| `routes`          | warn: a route no router maps, or a controller or action that loads with the router                                                                                                 | the mapping to write                               |
| `models`          | warn: a file in `app/models/` calls `createModel` and `app/models/index.ts` does not register it                                                                                   | the registration to add                            |
| `emails`          | fail: an email `app/emails/index.ts` declares that `app/initializers/mail.ts` maps no template for; warn: a template without a test beside it, or without `preview()`              | the mapping, test or `preview` to write            |
| `jsdoc`           | warn: a `//` or `/*` comment that is not a tooling directive, a description longer than three prose lines, a `@description` tag, or a multi-line `@param` / `@returns` / `@throws` | rewrite as JSDoc within the limits                 |
| `complexity`      | warn: a function's cyclomatic complexity exceeds `doctor.complexity.max` (default 4)                                                                                               | split the function, or raise the max               |
| `module-size`     | warn: a module's code lines exceed `doctor.moduleSize.maxLines` (default 200)                                                                                                      | split the module, or raise the limit               |
| `dependencies`    | warn: a static import cycle, or a static import from an inner layer to an outer one (models must not import http, and so on)                                                       | `sdxc diagram` shows the graph                     |
| `fan-out`         | warn: a module statically imports more distinct project modules than `doctor.fanOut.max` (default 15)                                                                              | split the module, or raise the max                 |
| `orphans`         | warn: a non-entry module that no module or test imports and no root config file names                                                                                              | delete it, or wire it from an entry                |
| `feature-scatter` | warn: a feature folder already in two layers is missing from another layer that hosts multi-layer features                                                                         | add the folder, or drop the unused layer copy      |
| `duplication`     | warn: the same block of `doctor.duplication.minLines` (default 8) code lines appears in more than one module                                                                       | extract a shared helper, or raise the min          |
| `result-throws`   | warn: app source outside `bootstrap/` uses `throw`                                                                                                                                 | return `failure(...)` from `@sdxc/result`          |
| `local-const`     | warn: a `const` inside a function or block, tests included                                                                                                                         | declare it with `let`, or hoist a true constant    |
| `constant-names`  | warn: a non-exported module-level `const` holding a literal, array, object of data or `new Set`/`Map`/`RegExp`, named outside `UPPER_SNAKE_CASE`                                   | rename it in `UPPER_SNAKE_CASE`                    |
| `stack-imports`   | warn: an import of `zod`, `react`, `react-router`, Tailwind or `remix/html-template`                                                                                               | `remix/data-schema`, `remix/component`, `css()`    |
| `process-env`     | warn: app code outside tests reads `process.env`                                                                                                                                   | import `env` from `cloudflare:workers`             |
| `fetch-param`     | warn: app code declares a `typeof fetch` parameter or option                                                                                                                       | call the global `fetch`; mock it with MSW          |
| `logger`          | warn: app code calls `createLogger()` outside `app/initializers/`                                                                                                                  | log through `ctx.log` or `currentLog()`            |
| `test-ratio`      | warn: `tests / code` from `sdxc stats` is below `doctor.testRatio.min` (default 0.3)                                                                                               | add tests, or lower the min                        |
| `crap`            | warn: a function's CRAP score exceeds `doctor.crap.max` (default 12); skip when the coverage file is missing                                                                       | lower complexity, raise coverage, or raise the max |
| `mutation`        | warn: surviving mutants exceed `doctor.mutation.maxSurvived` (default 0); skip when the report file is missing                                                                     | kill survivors, or raise the max                   |
| `ui`              | warn: a copied component is behind the installed release; edited copies are listed for review                                                                                      | `sdxc ui update <names>`, `sdxc ui diff`           |

`pins` and `remix` read the npm registry; without it they report `skip` and every other check
still runs. `env` exists because CI builds `.dev.vars` from `.env.example` before it generates
the Worker's types, so a secret only your local `.dev.vars` holds fails there. `migrations`
replays each chain the way a new database or tenant gets it, with SQLite's double-quoted string
literals off, so a `"value"` meant as a string fails here instead of in production.

`routes` warns on a controller that loads with the router rather than through `lazy()`.
`dependencies` warns when an inner layer (models, services, policies, initializers) imports an
outer one (http, jobs, commands), or on any import cycle; a `lazy()` mapping or dynamic
`import()` loads after startup, so it closes no cycle. Each check that takes a threshold reads
its own keys under `doctor` in [configuration](/docs/sdxc/configuration#doctor).

### Accept a migration that already ran

A migration production applied long ago can fail on an empty database. List it under
`doctor.migrations.accept` in `.config/sdxc.jsonc`, with the file and the column its error
names, rather than editing the file:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"doctor": {
		"migrations": {
			"accept": [{ "file": "0007_rename_slug.sql", "column": "slug" }],
		},
	},
}
```

The replay steps past that error alone, so a different error in the same file still fails, and
an entry whose error no longer occurs warns, so the list shrinks once the migration is fixed.

> [!WARNING]
> Leave a migration production applied as it is. The databases that ran it never run it again, so
> an edit reaches only new databases, and they end up on a schema production does not have.

## Run some of them

```bash
sdxc doctor --only pins,remix
sdxc doctor --skip ui --skip typegen
```

`--only` and `--skip` take check names, repeated or comma-separated, your own checks included.

## As JSON

`--json` prints the same report as one JSON document for an agent: `ok` is `false` when any
check failed, and each check carries its `status`, `message`, `findings` and `fix`.

## Add your own checks

A rule that belongs to your project, and to no other, is a module in `.config/sdxc/checks/`,
the `doctor.checks` key of your configuration. Each module default-exports one check, or an
array of them, made with `defineCheck` from `@sdxc/kit/doctor`:

```ts {% title=".config/sdxc/checks/no-env-in-views.ts" %}
import { defineCheck } from "@sdxc/kit/doctor";

export default defineCheck({
	name: "no-env-in-views",
	async run(ctx) {
		let found = [];
		for (let file of await ctx.files("resources")) {
			if ((await ctx.readFile(file))?.includes("cloudflare:workers"))
				found.push(file);
		}
		if (found.length === 0)
			return { status: "pass", message: "Views read no bindings" };
		return {
			status: "warn",
			message: "Views import env",
			findings: found,
			fix: "Pass the value in from the controller",
		};
	},
});
```

`run` returns `{ status, message, findings?, fix? }`, with `status` one of `pass`, `warn`,
`fail` or `skip`, and the line prints like a built-in one. Its context reads the project and
changes nothing:

| Field      | What it holds                                                       |
| ---------- | ------------------------------------------------------------------- |
| `root`     | the project's root folder                                           |
| `manifest` | the parsed `package.json`                                           |
| `config`   | the `sdxc` configuration, defaults filled in                        |
| `routes`   | every route, as `sdxc routes --json` lists them                     |
| `readFile` | a file's text, or `null` when it is missing                         |
| `exists`   | whether a path exists                                               |
| `files`    | every file under a folder, leaving out `node_modules` and dot-files |

A check's name is lowercase words joined by dashes, and none of the built-in names. A check that
fails to load, throws, or runs longer than 30 seconds is reported as `fail` under its name, and
every other check still runs.

## In a workflow

`doctor` is the step after anything that moves the project:

```bash
sdxc upgrade
sdxc doctor
```

In CI, run it before [`sdxc deploy`](/docs/sdxc/deploy) so a missing secret or a migration a new
database cannot replay stops the pipeline before production.

## Where to go next

- [Upgrade](/docs/sdxc/upgrade) — move every package to a newer release.
- [List routes](/docs/sdxc/list-routes) — `sdxc routes --unused` lists what the `routes` check
  warns about, with the controller files nothing loads.
- [Install and pin](/docs/getting-started/install-and-pin) — how one release decides the version
  of every package in a project.
