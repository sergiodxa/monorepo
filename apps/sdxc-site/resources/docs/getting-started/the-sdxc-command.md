---
title: The sdxc command
description: Start a project from a template, generate files where the layout puts them, copy UI components to edit, upgrade with a prompt for your agent, and run your app's own commands.
section:
    title: Getting started
    order: 1
order: 4
lastUpdated: 2026-10-15
---

The `sdxc` command writes a new project, adds controllers, jobs, models and the rest where the
app layout puts them, copies `@sdxc/ui` components into your project when you want to edit one,
and moves the project to a newer release with a prompt that tells an AI agent what changed for
the code you have.

It ships in [`@sdxc/kit`](/api/kit). Install it globally so you can type the commands as
written here; your app imports each package it uses by its own name, such as `@sdxc/result`:

```bash
npm add -g @sdxc/kit
```

Every command runs from the project root, the nearest folder with a `package.json`, and
`sdxc <command> --help` lists its arguments and flags. On a terminal a command asks for what
you left out, and every question has a flag, so a script or an agent passes the answer up front
and never waits on one.

## Start a project

```bash
sdxc create my-app
```

`create` writes the built-in `app` template into `my-app`: a Remix v3 Worker on Cloudflare in
the folder layout the generators below expect, with `cloudflare.config.ts`, a Vite+
configuration, a test runner, its own command line in `bootstrap/cli.ts`, each `@sdxc`
package it uses pinned to its latest release, and `remix` pinned to the version those releases
need. The target folder must be missing
or empty apart from a `.git` folder, so `git init` before `create` works too; without a
directory, it writes into the current one.

Any GitHub repository is a template as well, with no manifest to declare. Name it as
`org/repo`, with a folder inside it and a branch, tag or commit when you need them:

```bash
sdxc create blog --template acme/templates/apps/blog#main --no-git
```

`GITHUB_TOKEN` or `GH_TOKEN` in the environment authenticates the download, which a private
repository needs. `create` writes files and runs nothing from them: it installs no dependencies
and runs no scripts, and prints the commands to run next with the project's package manager.
When it made the folder, it asks whether to initialize git there; `--git` and `--no-git` answer
in advance, and without a terminal the answer is no.

## Configure the command line

Every setting has a default, so a project needs no configuration file until it changes one.
`sdxc init` writes `.config/sdxc.jsonc` with every key spelled out, and a `$schema` your editor
completes them from:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	// Where `sdxc ui add` writes components
	"ui": { "directory": "resources/components/ui", "tests": false },
	"make": {
		// The route contract in routes/ that `sdxc make controller` adds to
		"routes": "web",
		"migrations": { "default": "database/migrations" },
		"tests": true,
	},
	// Run once on every file a command wrote or edited, with the paths appended
	"format": ["bunx", "vp", "fmt"],
}
```

The file is JSON with comments, so each setting can say why it is set. `format` is the one most
projects set: a generated file and a copied component then come out in your project's style.
`sdxc.jsonc` at the project root is read too, when you prefer it there.

## Generate files

`sdxc make <kind> <name>` writes one file of that kind where the layout puts it, with a test
beside it:

| Kind          | File                                      |
| ------------- | ----------------------------------------- |
| `controller`  | `app/http/controllers/<name>.tsx`         |
| `middleware`  | `app/http/middleware/<name>.ts`           |
| `validator`   | `app/http/validators/<name>.ts`           |
| `job`         | `app/jobs/<name>.ts`                      |
| `model`       | `app/models/<name>.ts`                    |
| `migration`   | `database/migrations/<number>_<Name>.sql` |
| `factory`     | `database/factories/<name>.ts`            |
| `service`     | `app/services/<name>.ts`                  |
| `policy`      | `app/policies/<name>.ts`                  |
| `initializer` | `app/initializers/<name>.ts`              |
| `email`       | `app/emails/<name>.tsx`                   |
| `mcp`         | `app/mcp/tools/<name>.ts`                 |
| `command`     | `app/commands/<name>.ts`                  |

A slash in the name is a folder inside the kind's folder, so features stay together:
`sdxc make job trials/expire` writes `app/jobs/trials/expire.ts`.

A controller, a job, an MCP tool or resource and a command are also declared and mapped. The
command adds the route, job, tool or command to its declaration module and maps the new handler
in the initializer that serves it, through `lazy()`, so the handler answers as soon as the
command finishes:

```bash
sdxc make controller sponsors
sdxc make controller ping --method post --path /api/ping
sdxc make controller signup --method form
sdxc make job reports/daily --cron "0 8 * * *"
sdxc make mcp search-posts
sdxc make mcp article --resource
sdxc make command users/grant
```

`--method` takes `get`, `post`, `put`, `patch`, `delete` or `form`, a page with an action
beside it, and `--routes` picks a route contract other than `make.routes`. `--cron` declares a
scheduled job instead of one with input.

A `get` or `form` controller is a page, so when a controller builds the sitemap with
`fromRoutes` over the same route contract, `make` adds the page's decision there too: `true`,
or `[]` when the pattern has required params, for you to fill with the pages to list. A page
inside a group the sitemap already excludes with `false` stays excluded.

When an edit cannot be placed, such as a project whose initializer is laid out differently,
`make` writes the handler, leaves the other files as they are, and prints every edit for you
to make, so a declaration never lands without its mapping.

A migration is named like the files already in its chain and sorts after all of them. A chain
of `0004-add-feeds.sql` files gets `0005-add-index.sql`, a chain of
`20261008100000_add_feeds.sql` files gets the current UTC time as `20261015090807_add_index.sql`,
and an empty chain starts at `0001_AddIndex.sql`. `--chain` picks a chain from
`make.migrations` for an app with more than one database. `--no-test` skips the test for one
run, `make.tests: false` skips it everywhere, and `--dry-run` prints what would be written.

When the generated code imports an `@sdxc` package your `package.json` does not list yet, `make`
adds it at the same release as the packages you have, the newest version published on or
before that date, and prints the install command to run:

```text
Added @sdxc/jobs@2026.10.12 to package.json; run bun install
```

### Make the generated files your own

Each kind is written from a stub, and a stub in `make.stubs` replaces the built-in one of the
same name. Copy the built-in stubs to start from:

```bash
sdxc make stubs controller job
```

A stub is the file's text with `{{name}}`-style placeholders. Edit only the ones you want to
change; every other kind keeps the built-in stub.

## Copy a UI component to edit it

[`@sdxc/ui`](/api/ui) components are imported from the package, so a release updates them for
you. When a design needs a component changed, copy it into the project:

```bash
sdxc ui add dialog
```

The copy lands in `ui.directory`, and every file in the project that imported
`@sdxc/ui/dialog`, or `Dialog` from `@sdxc/ui`, now imports the copy. A component that reaches
others keeps importing them from the package; `--with-deps` copies those as well.

The command records each copy, the release it came from and a hash of each file in
`.config/sdxc.lock.jsonl`. Commit that file and leave it to the command line, which reads it
to tell an edited copy from an untouched one:

```bash
sdxc ui list            # every component, marking copies that are edited or behind
sdxc ui diff dialog     # how the copy differs from the installed version
sdxc ui update dialog   # take the installed version where the copy is untouched
sdxc ui remove dialog   # delete the copy and point imports back at @sdxc/ui/dialog
```

`update` replaces only the files you have not edited and names the rest; `--force` replaces
those too.

## Upgrade

```bash
sdxc upgrade
```

`upgrade` moves every `@sdxc` package in `package.json` to the latest release, or to the
release you name, each to its newest version published on or before that date. It asks first
when the release has breaking changes in packages your code imports, moves `remix` along when
that release needs a different one, and installs. Then it
prints a prompt for an AI agent: the changes between the two releases to the packages your code
imports, breaking ones first with their migration steps, the components you copied whose
source changed since, and your project's own `check`, `typecheck` and `test` scripts to run
once the edits are done.

The prompt goes to stdout, so it pipes into your agent's command line or clipboard, and
`--output upgrade.md` writes it to a file instead. `--no-install` changes `package.json` only
and prints the commands to run next. To write the prompt again later, name the release you
moved from:

```bash
sdxc upgrade --prompt --from 2026.9.4
```

The prompt comes from the new release's own changelog: `upgrade` runs that release of
`@sdxc/kit` to write it, so the notes match what you installed.
[Install and pin](/docs/getting-started/install-and-pin) covers why a release is one exact
date.

## Run your app's commands

An app created from the template has a command line of its own, in `bootstrap/cli.ts`, for
work that belongs to the app but to no request: seeding, backfills, granting a role. `sdxc run`
runs it from any folder in the project, with Bun for a project on Bun and Node otherwise:

```bash
sdxc run about
sdxc run users grant ada@example.com --role admin
sdxc run --help
```

Every word after `run` reaches your app's command line as typed, `--help` included, and its
exit code is `sdxc run`'s. [Your app's command line](/docs/operations-and-testing/your-apps-command-line)
writes those commands.

## Where to go next

- [Your app's command line](/docs/operations-and-testing/your-apps-command-line) — the
  commands `sdxc make command` adds, and the services they read.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — `@sdxc/cli`, the
  package this command line is built on.
- [Wire the router](/docs/building-remix-apps/wire-the-router) — what the controllers `make`
  maps are mapped into.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher
  `make job` adds to.
- [`@sdxc/kit`](/api/kit) — every command and configuration key.
