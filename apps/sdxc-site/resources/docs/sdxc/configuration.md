---
title: Configuration
description: Every key in .config/sdxc.jsonc, its default and the command it changes, how the file is found and validated, and the lock file beside it.
section:
    title: The sdxc command
    order: 2
order: 10
lastUpdated: 2026-10-25
outcomes:
    - "Where `sdxc` reads its configuration from, and how a mistake in it is reported"
    - "What every key changes, and its default"
    - "Which files under `.config/` to commit"
---

You need no configuration file until you want a default changed: every `sdxc` command runs on
its defaults without one. A project from `sdxc create` has one anyway, with every key spelled
out, so you can see what each command assumes. In another project, write it with:

```bash
sdxc init
```

## Where it is read from

`sdxc` reads `.config/sdxc.jsonc` in the project root, the nearest folder with a
`package.json`. `sdxc.jsonc` at the root works too, if you prefer it there.

> [!NOTE]
> A project holding both files is refused until you delete one, so two copies never disagree.
> `sdxc init` leaves an existing file as it is, and `--dry-run` prints the file instead of
> writing it.

The file is JSON with comments and trailing commas, so each setting can say why it is set. Its
`$schema` points at `config.schema.json` in `@sdxc/kit`, and your editor completes and checks
the keys from it.

Every command validates the file before it runs anything. A misspelt key, a value of the wrong
type, or a path outside the project stops the command with one line per problem:

```text
.config/sdxc.jsonc: make.test: Unknown key
```

## The whole file

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"$schema": "https://unpkg.com/@sdxc/kit/config.schema.json",
	"ui": {
		"directory": "resources/components/ui",
		// "alias": "~/components/ui",
		"tests": false,
	},
	"make": {
		"routes": "web",
		"migrations": { "default": "database/migrations" },
		"tests": true,
		"specs": true,
		"stubs": ".config/sdxc/stubs",
	},
	"doctor": {
		"checks": ".config/sdxc/checks",
		"migrations": { "accept": [] },
		"complexity": { "max": 4 },
		"moduleSize": { "maxLines": 200 },
		"crap": { "max": 12, "coverage": "coverage/coverage-final.json" },
		"testRatio": { "min": 0.3 },
		"fanOut": { "max": 15 },
		"duplication": { "minLines": 8 },
		"mutation": { "report": "reports/mutation/mutation.json", "maxSurvived": 0 },
	},
	"run": { "entry": "bootstrap/cli.ts" },
	"format": ["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"],
	"lock": ".config/sdxc.lock.jsonl",
}
```

Every path is relative to the project root.

## format

| Key      | Default | Example                                                    |
| -------- | ------- | ---------------------------------------------------------- |
| `format` | none    | `["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"]` |

The command every file the CLI writes or edits is run through, so generated code and copied
components land in your project's style. It is an argument list, run without a shell, once per
command, with every written path appended; set it to your own formatter, such as
`["bunx", "prettier", "--write"]`. Without the key, nothing is formatted.

## make

What [`sdxc make`](/docs/sdxc/generate-files) and [`sdxc scaffold`](/docs/sdxc/scaffold-a-resource)
write and where.

| Key               | Default                                | What it decides                                                          |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `make.routes`     | `"web"`                                | the contract in `routes/` a controller is declared in without `--routes` |
| `make.migrations` | `{ "default": "database/migrations" }` | the migration chains, by name, that `--chain` picks from                 |
| `make.tests`      | `true`                                 | whether a file gets a test beside it without `--test` or `--no-test`     |
| `make.specs`      | `true`                                 | whether a file gets a pairing `.spec` without `--spec` or `--no-spec`    |
| `make.stubs`      | `".config/sdxc/stubs"`                 | the folder whose stubs replace the built-in ones                         |

An app that is mostly an API sets `make.routes` to `"api"`, so `sdxc make controller keys`
writes a JSON endpoint without `--routes api`. An app with a database per tenant adds a second
chain to `make.migrations`, as [Make a migration](/docs/sdxc/make-migration#chains) shows.
`make.stubs` is where `sdxc make stubs` copies the built-in stubs to, and where every kind looks
for yours first, as
[Generate files](/docs/sdxc/generate-files#make-the-generated-files-your-own) covers.

## ui

What [`sdxc ui`](/docs/sdxc/copy-ui-components) copies and where.

| Key            | Default                      | What it decides                                   |
| -------------- | ---------------------------- | ------------------------------------------------- |
| `ui.directory` | `"resources/components/ui"`  | the folder `sdxc ui add` writes each copy into    |
| `ui.alias`     | from `tsconfig.json` `paths` | the import prefix the copies are imported through |
| `ui.tests`     | `false`                      | whether a component's tests are copied beside it  |

Leave `ui.alias` out and it is worked out from the `paths` entry in your `tsconfig.json` that
covers `ui.directory`; with no such entry, the copies are imported by relative path.

## doctor

What [`sdxc doctor`](/docs/sdxc/check-a-project) runs besides its built-in checks.

| Key                           | Default                            | What it decides                                                |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `doctor.checks`               | `".config/sdxc/checks"`            | the folder of your own checks, each module run by `doctor`     |
| `doctor.migrations.accept`    | `[]`                               | migration errors the `migrations` check steps past             |
| `doctor.complexity.max`       | `4`                                | maximum cyclomatic complexity per function                     |
| `doctor.moduleSize.maxLines`  | `200`                              | maximum code lines per module                                  |
| `doctor.crap.max`             | `12`                               | maximum CRAP score per function                                |
| `doctor.crap.coverage`        | `"coverage/coverage-final.json"`   | Istanbul coverage file the `crap` check reads                  |
| `doctor.testRatio.min`        | `0.3`                              | minimum tests/code ratio from `sdxc stats`                     |
| `doctor.fanOut.max`           | `15`                               | maximum distinct modules one file may import                   |
| `doctor.duplication.minLines` | `8`                                | minimum consecutive code lines that count as a duplicate block |
| `doctor.mutation.report`      | `"reports/mutation/mutation.json"` | mutation report JSON the `mutation` check reads                |
| `doctor.mutation.maxSurvived` | `0`                                | maximum surviving mutants the `mutation` check allows          |

Each entry in `doctor.migrations.accept` is `{ "file", "column" }`: a migration file name and
the column SQLite's error names. [Check a project](/docs/sdxc/check-a-project#add-your-own-checks)
shows how to write a check for `doctor.checks`.

## run

| Key         | Default              |
| ----------- | -------------------- |
| `run.entry` | `"bootstrap/cli.ts"` |

The module [`sdxc run`](/docs/sdxc/run-app-commands) starts, with the words you typed passed
on. An app from `sdxc create` keeps the default; a project whose command line starts elsewhere
names that module here.

## lock

| Key    | Default                     |
| ------ | --------------------------- |
| `lock` | `".config/sdxc.lock.jsonl"` |

The file where the CLI keeps its state, one JSON record per line, such as each `@sdxc/ui` copy
with the release it came from and a hash of each of its files. `sdxc ui` reads it to tell an
edited copy from an untouched one.

> [!WARNING]
> Commit the lock file and leave its contents to the CLI. It is the only record of which release
> each copy came from and whether you have edited it, so `sdxc ui diff` and `sdxc ui update` read
> it on every run.

## What to commit

Commit everything under `.config/`: the configuration, the lock file, your stubs and your
checks. Each one changes what a command does, so a teammate and CI need the same copy you have.

## Where to go next

- [Start a project](/docs/sdxc/start-a-project) — the project `sdxc create` writes this file
  into.
- [Generate files](/docs/sdxc/generate-files) — the commands `make` configures.
- [`@sdxc/kit`](/api/kit) — every command and its flags.
