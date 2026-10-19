---
title: Configuration
description: Every key in .config/sdxc.jsonc, its default and the command it changes, how the file is found and validated, and the lock file beside it.
section:
    title: The sdxc command
    order: 2
order: 10
lastUpdated: 2026-10-19
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

<note>
A project holding both files is refused until you delete one, so two copies never disagree.
`sdxc init` leaves an existing file as it is, and `--dry-run` prints the file instead of
writing it.
</note>

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
		"stubs": ".config/sdxc/stubs",
	},
	"doctor": {
		"checks": ".config/sdxc/checks",
		"migrations": { "accept": [] },
	},
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
components land in your project's style rather than the template's. It is an argument list,
run without a shell, once per command, with every written path appended. `sdxc create` sets it
to Vite+'s formatter; set it to your own, such as `["bunx", "prettier", "--write"]`.

A formatter that fails leaves the files as the command wrote them and says so. Without the key,
nothing is formatted.

## make

What [`sdxc make`](/docs/sdxc/generate-files) and [`sdxc scaffold`](/docs/sdxc/scaffold-a-resource)
write and where.

| Key               | Default                                | What it decides                                                          |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `make.routes`     | `"web"`                                | the contract in `routes/` a controller is declared in without `--routes` |
| `make.migrations` | `{ "default": "database/migrations" }` | the migration chains, by name, that `--chain` picks from                 |
| `make.tests`      | `true`                                 | whether a file gets a test beside it without `--test` or `--no-test`     |
| `make.stubs`      | `".config/sdxc/stubs"`                 | the folder whose stubs replace the built-in ones                         |

- **`make.routes`** names a module in `routes/`. An app that is mostly an API sets it to
  `"api"`, so `sdxc make controller keys` writes a JSON endpoint without `--routes api`.
- **`make.migrations`** has one chain per database. An app with a database per tenant adds a
  second chain, such as `"tenant": "database/tenant"`, and writes to it with
  `sdxc make migration add-plan --chain tenant`; the `default` chain is the one used without
  the flag. [Make a migration](/docs/sdxc/make-migration#chains) covers chains.
- **`make.tests`** set to `false` skips the test for every kind; `--test` writes one for a single
  run. Migrations and factories never get a test.
- **`make.stubs`** is where `sdxc make stubs` copies the built-in stubs to, and where every kind
  looks for yours first. [Generate files](/docs/sdxc/generate-files#make-the-generated-files-your-own)
  lists the stubs and their placeholders.

## ui

What [`sdxc ui`](/docs/sdxc/copy-ui-components) copies and where.

| Key            | Default                      | What it decides                                   |
| -------------- | ---------------------------- | ------------------------------------------------- |
| `ui.directory` | `"resources/components/ui"`  | the folder `sdxc ui add` writes each copy into    |
| `ui.alias`     | from `tsconfig.json` `paths` | the import prefix the copies are imported through |
| `ui.tests`     | `false`                      | whether a component's tests are copied beside it  |

`ui.alias` is the specifier your code imports a copy by, such as `~/components/ui`, when
`sdxc ui add` rewrites an import from `@sdxc/ui/dialog` to your copy. Leave it out and it is
worked out from the `paths` entry in your `tsconfig.json` that covers `ui.directory`; with no such
entry, the copies are imported by relative path.

## doctor

What [`sdxc doctor`](/docs/sdxc/check-a-project) runs besides its built-in checks.

| Key                        | Default                 | What it decides                                            |
| -------------------------- | ----------------------- | ---------------------------------------------------------- |
| `doctor.checks`            | `".config/sdxc/checks"` | the folder of your own checks, each module run by `doctor` |
| `doctor.migrations.accept` | `[]`                    | migration errors the `migrations` check steps past         |

Each entry in `doctor.migrations.accept` is `{ "file", "column" }`: a migration file name,
without its folder, and the column SQLite's error names. It is for a migration production
applied long ago that an empty database can no longer replay:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"doctor": {
		"migrations": {
			"accept": [{ "file": "0007_rename_slug.sql", "column": "slug" }],
		},
	},
}
```

[Check a project](/docs/sdxc/check-a-project#add-your-own-checks) shows how to write a check
for `doctor.checks`.

## lock

| Key    | Default                     |
| ------ | --------------------------- |
| `lock` | `".config/sdxc.lock.jsonl"` |

The file where the CLI keeps its state, one JSON record per line, such as each `@sdxc/ui` copy
with the release it came from and a hash of each of its files. `sdxc ui` reads it to tell an
edited copy from an untouched one.

<warning>
Commit the lock file and leave its contents to the CLI. It is the only record of which release
each copy came from and whether you have edited it, so `sdxc ui diff` and `sdxc ui update` read
it on every run.
</warning>

## What to commit

Commit everything under `.config/`: the configuration, the lock file, your stubs and your
checks. Each one changes what a command does, so a teammate and CI need the same copy you have.

## Where to go next

- [Start a project](/docs/sdxc/start-a-project) — the project `sdxc create` writes this file
  into.
- [Generate files](/docs/sdxc/generate-files) — the commands `make` configures.
- [`@sdxc/kit`](/api/kit) — every command and its flags.
