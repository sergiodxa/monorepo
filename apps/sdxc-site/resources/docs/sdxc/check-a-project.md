---
title: Check a project
description: Lint a project for release drift, missing secrets, stale Worker types, migrations a new database cannot replay, layout and wiring mistakes, and the rules you add yourself, with sdxc doctor.
section:
    title: The sdxc command
    order: 2
order: 6
lastUpdated: 2026-10-19
outcomes:
    - "What each `sdxc doctor` check looks for, and the fix it names when it fails"
    - "How to accept a migration that already ran instead of rewriting it"
    - "How to add a check of your own and run `doctor` in CI"
---

```bash
sdxc doctor
```

`sdxc doctor` runs every check against the project and prints one line per check, each marked
`pass`, `warn`, `fail` or `skip`, with the exact command or edit that fixes what it found:

```text
pass  pins        Every @sdxc package is at release 2026.10.17
fail  installed   node_modules differs from package.json: @sdxc/cli 2026.9.4 is installed, package.json pins 2026.10.17. Fix: bun install
pass  remix       remix 3.0.0 is the peer release 2026.10.17 declares
pass  env         .env.example lists every secret cloudflare.config.ts declares
warn  typegen     The Worker's env types were never generated; .cloudflare/types/index.d.ts is missing. Fix: sdxc run typegen
skip  migrations  The project has no migrations
pass  layout      app/ holds only the layout's folders and nothing imports bootstrap/
warn  routes      Found 1 route no router maps: GET /pricing (routes/web.ts pricing) is mapped by no router. Fix: Map each route in its router initializer as router.map(route, lazy(() => import(…))); sdxc make controller writes and maps one
pass  models      app/models/index.ts registers every model in app/models/
pass  emails      3 declared emails mapped, tested and previewable
skip  ui          No @sdxc/ui component is copied
```

A `fail` is something that breaks an install, a build, CI or a new database. A `warn` is a
convention the project strays from. A `skip` is a check with nothing to look at, such as a
project with no migrations, or one that could not reach the npm registry.

`doctor` changes nothing itself, and exits 1 when any check fails, so it fits a CI step or a
pre-commit hook. Warnings leave the exit code at 0.

## The checks

They run in this order:

| Check        | Fails or warns when                                                                                                                                                   | Fix                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `pins`       | fail: an `@sdxc` package is behind its version at the project's release; warn: one is pinned to no release                                                            | `sdxc upgrade <release>`                 |
| `installed`  | fail: `node_modules` holds an `@sdxc` package or `remix` at another version than `package.json` pins, or lacks one                                                    | the install command                      |
| `remix`      | fail: `remix` differs from the version the project's release declares                                                                                                 | `sdxc upgrade <release>`                 |
| `env`        | fail: `.env.example` leaves out a secret `cloudflare.config.ts` declares; warn: it lists a key no binding declares                                                    | the line to add, or the declaration      |
| `typegen`    | warn: `.cloudflare/types/index.d.ts` is missing, or older than `cloudflare.config.ts`, `.dev.vars` or `.env.example`                                                  | `sdxc run typegen`                       |
| `migrations` | fail: a `make.migrations` chain does not replay on an empty database with double-quoted strings off; warn: an accepted error no longer occurs                         | the migration to correct, or the entry   |
| `layout`     | warn: a folder in `app/` the layout does not have, or an import of `bootstrap/` from `app/`, `config/`, `database/`, `resources/` or `routes/`                        | the file to move                         |
| `routes`     | warn: a route no router maps, or a controller or action that loads with the router                                                                                    | the mapping to write                     |
| `models`     | warn: a file in `app/models/` calls `createModel` and `app/models/index.ts` does not register it                                                                      | the registration to add                  |
| `emails`     | fail: an email `app/emails/index.ts` declares that `app/initializers/mail.ts` maps no template for; warn: a template without a test beside it, or without `preview()` | the mapping, test or `preview` to write  |
| `ui`         | warn: a copied component is behind the installed release; edited copies are listed for review                                                                         | `sdxc ui update <names>`, `sdxc ui diff` |

The project's release is the newest date among its `@sdxc` pins, so `pins` names each package
that lags behind the others. `pins` and `remix` read the npm registry; without it they report
`skip` and every other check still runs.

`env` exists because CI builds `.dev.vars` from `.env.example` before it generates the Worker's
types: a secret only your local `.dev.vars` holds types fine on your machine and fails there.
`migrations` replays each chain the way a new database or a new tenant gets it, with SQLite's
double-quoted string literals off, so a `"value"` meant as a string, or a rebuild that reads a
column by its new name, fails here instead of in production.

`routes` judges each mapping by what loads with the router. A controller mapped through
`lazy()` loads on the first request that reaches it. A controller with several actions passes
when each action sits behind `lazy()` or is an inline handler that loads its module with a
dynamic `import()`; an action that imports its code up front is named by its key path, as in
`app/initializers/router.ts maps routes.board action edit without lazy()`.

`emails` fails on a declared email with no template, because every send of it fails at
runtime, and warns on a template `sdxc run emails preview` and `/_emails` cannot render without
a `preview()`. A project without `app/emails/index.ts` reports `skip`.

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
checks the rest of the chain. In a file split by Drizzle's `--> statement-breakpoint`, it skips
only the statement that raised the error and runs the ones after it; any other file is one step.
A passing line counts the accepted errors and lists each as a finding, and an entry whose error
no longer occurs warns, so the list shrinks once the migration is fixed.

<warning>
Leave a migration production applied as it is. The databases that ran it never run it again, so
an edit reaches only new databases, and they end up on a schema production does not have.
</warning>

## Run some of them

```bash
sdxc doctor --only pins,remix
sdxc doctor --skip ui --skip typegen
```

`--only` and `--skip` take check names, repeated or comma-separated, your own checks included.
A name `doctor` does not have stops it with the list it has:

```text
No check is named nope; sdxc doctor runs pins, installed, remix, env, typegen, migrations, layout, routes, models, emails, ui
```

## As JSON

`--json` prints the same report as one JSON document for an agent: `ok` is `false` when any
check failed, and each check carries its `findings` one per entry, and its `fix`:

```text
{
  "ok": true,
  "checks": [
    {
      "name": "routes",
      "status": "warn",
      "message": "Found 1 route no router maps",
      "findings": ["GET /pricing (routes/web.ts pricing) is mapped by no router"],
      "fix": "Map each route in its router initializer as router.map(route, lazy(() => import(…))); sdxc make controller writes and maps one"
    }
  ]
}
```

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

Every path these take stays inside the project. A check's name is lowercase words joined by
dashes, unique among your checks, and none of the built-in names. Checks run with the project's
runtime; on Node, a check written in TypeScript needs Node 22.18 or newer.

A check that fails to load, throws, returns something other than a result, shares a name, or
runs longer than 30 seconds is reported as `fail` under its name, and every other check still
runs.

## In a workflow

`doctor` is the step after anything that moves the project:

```bash
sdxc upgrade
sdxc doctor
```

A `pins` or `remix` failure names the `sdxc upgrade <release>` that fixes it,
[`sdxc upgrade`](/docs/sdxc/upgrade) catches up a lagging package even when no newer release is
out, and a `ui` warning names the copies `sdxc ui update` brings current. In CI, run it before
[`sdxc deploy`](/docs/sdxc/deploy) so a missing secret or a migration a new database cannot
replay stops the pipeline before production.

## Where to go next

- [Upgrade](/docs/sdxc/upgrade) — move every package to a newer release.
- [List routes](/docs/sdxc/list-routes) — `sdxc routes --unused` lists what the `routes` check
  warns about, with the controller files nothing loads.
- [Install and pin](/docs/getting-started/install-and-pin) — why every package in a project
  shares one release date.
