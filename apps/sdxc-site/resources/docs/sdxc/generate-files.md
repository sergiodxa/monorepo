---
title: Generate files
description: Write a controller, job, model, migration or any other kind of file where the app layout puts it, declared, mapped and tested, with sdxc make.
section:
    title: The sdxc command
    order: 2
order: 2
lastUpdated: 2026-10-19
---

`sdxc make <kind> <name>` writes one file of that kind where the app layout puts it, with a test
beside it, and makes every edit the file needs to run: a route declared and mapped, a job
registered with the dispatcher, a model added to the registry, a middleware added to a chain. A
new handler answers as soon as the command finishes.

```bash
sdxc make controller sponsors
sdxc make job reports/daily
sdxc make model post title body published_at author_id
```

This page covers what every kind shares. Each kind has its own guide with its flags, the file it
writes and how to fill it in.

## Kinds

| Kind                                         | File                                      | Test | Also edits                                              |
| -------------------------------------------- | ----------------------------------------- | ---- | ------------------------------------------------------- |
| [`controller`](/docs/sdxc/make-controller)   | `app/http/controllers/<name>.tsx`         | yes  | the route contract, the router, the sitemap             |
| [`middleware`](/docs/sdxc/make-middleware)   | `app/http/middleware/<name>.ts`           | yes  | a chain, with `--mount`                                 |
| [`validator`](/docs/sdxc/make-validator)     | `app/http/validators/<name>.ts`           | yes  |                                                         |
| [`job`](/docs/sdxc/make-job)                 | `app/jobs/<name>.ts`                      | yes  | `app/jobs/index.ts`, the dispatcher                     |
| [`model`](/docs/sdxc/make-model)             | `app/models/<name>.ts`                    | yes  | `app/models/index.ts`; writes its migration and factory |
| [`migration`](/docs/sdxc/make-migration)     | `database/migrations/<number>_<Name>.sql` | no   |                                                         |
| [`factory`](/docs/sdxc/make-factory)         | `database/factories/<name>.ts`            | no   |                                                         |
| [`service`](/docs/sdxc/make-service)         | `app/services/<name>.ts`                  | yes  |                                                         |
| [`policy`](/docs/sdxc/make-policy)           | `app/policies/<name>.test.ts`             | yes  | `app/policies/abilities.ts`, `app/policies/policy.ts`   |
| [`initializer`](/docs/sdxc/make-initializer) | `app/initializers/<name>.ts`              | yes  |                                                         |
| [`email`](/docs/sdxc/make-email)             | `app/emails/<name>.tsx`                   | yes  |                                                         |
| [`mcp`](/docs/sdxc/make-mcp)                 | `app/mcp/tools/<name>.ts`                 | yes  | `app/mcp/tools/index.ts`, the MCP handler               |
| [`command`](/docs/sdxc/make-command)         | `app/commands/<name>.ts`                  | yes  | `app/commands/index.ts`, the command line               |

`sdxc make` alone asks for the kind and the name on a terminal. Without one, a missing kind or
name is a usage error that lists the kinds, so a script always names both. `sdxc make <kind>
--help` prints the flags of one kind.

## Names

A slash in the name is a folder inside the kind's folder, so a feature stays together across
layers: `sdxc make job trials/expire` writes `app/jobs/trials/expire.ts`, and
`sdxc make service trials/extend` writes `app/services/trials/extend.ts`. A migration's name is
the one that holds no folders.

Every segment is written in kebab-case on disk, so `Trials/ExpireOld`, `trials/expire_old` and
`trials/expire-old` write the same file. Each segment must start with a letter and hold only
letters, digits and dashes:

```text
"1abc" is not a name; use letters, digits and dashes in each segment, starting with a letter
```

The other spellings come from the last segment: `expire-old` is the camelCase key `expireOld`,
the PascalCase `ExpireOld`, the snake_case `expire_old` and the title `Expire old`. Each kind's
guide says which of them its declaration uses.

## Flags every kind takes

- `--dry-run` prints each file it would write in full and each edit as a diff, and changes
  nothing.
- `--no-test` skips the test for one run, and `--test` writes it when `make.tests` is `false`.
  Migrations and factories never get one.

A run plans every file and every edit before it writes any, and never overwrites a file: a name
that is taken, test included, stops the command and leaves the project as it was.

```text
app/http/controllers/home.tsx already exists; sdxc make leaves it as it is
```

When the run finishes it prints `Wrote` and `Edited` for each path, then runs the `format`
command from your configuration once over all of them, so the files land in your project's
style. A formatter that fails leaves the files as `make` wrote them and says so.

## Declared and mapped

A controller, a job, a model, an MCP tool or resource and a command each need an entry in a
declaration module and a mapping before the app reaches them, and `make` adds both:

| Kind         | Declaration                                                            | Mapping                                |
| ------------ | ---------------------------------------------------------------------- | -------------------------------------- |
| `controller` | `sponsors: get("/sponsors")` in `routes/web.ts`                        | `router.map(…, lazy(() => import(…)))` |
| `job`        | `daily: job({ input: s.object({}) })` in `app/jobs/index.ts`           | `dispatcher.map(…, () => import(…))`   |
| `model`      | `post: () => import("./post")` in `app/models/index.ts`                | read as `ctx.models.post`              |
| `mcp`        | `searchPosts: tool("search_posts", { … })` in `app/mcp/tools/index.ts` | `mcp.tools.map(…, lazy(…))`            |
| `command`    | `grant: command({ … })` in `app/commands/index.ts`                     | `cli.map(…, lazy(() => import(…)))`    |

`make` finds the initializer that serves each one by reading `app/initializers/`: the one that
imports the declaration module and calls `createRouter`, `createJobDispatcher`, `createHandler`
or `createCLI`. The new mapping goes after the last mapping already there, and imports follow
the form the file already uses, `~/app/…` or relative.

## When an edit cannot be placed

A project laid out differently from the template, such as one whose dispatcher lives outside
`app/initializers/`, may have no place `make` can edit. The command then writes the file and
its test, leaves every other file as it is, and prints the edits for you to make, so a
declaration never lands without its mapping:

```text
Declare and map it by hand, since no initializer in app/initializers/ creates the job dispatcher:
In app/jobs/index.ts, in jobs({ … }):
  digest: job({ input: s.object({}) }),
In the job dispatcher's initializer:
  dispatcher.map(jobs.digest, () => import("~/app/jobs/digest"));
```

`--dry-run` prints the same instructions after the files.

## Packages the code imports

When the generated code imports an `@sdxc` package your `package.json` does not list yet, `make`
adds it at the same release as the packages you have, the newest version published on or
before that date, and prints the install command to run:

```text
Added @sdxc/uuid@2026.10.13 to package.json; run bun install
```

## Configuration

`make` reads its settings from `.config/sdxc.jsonc`, and `sdxc init` writes the file with every
default spelled out:

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"make": {
		// Route contract `sdxc make controller` adds to, a module in routes/
		"routes": "web",
		// Migration chains by name; `--chain <name>` picks one
		"migrations": { "default": "database/migrations" },
		// Write a test beside every generated file except migrations and factories
		"tests": true,
		// Stubs here replace the built-in ones; `sdxc make stubs` copies them out
		"stubs": ".config/sdxc/stubs",
	},
	// Command run on every file the CLI writes or edits, paths appended
	"format": ["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"],
}
```

| Key               | Default                                | What it decides                                                          |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `make.routes`     | `web`                                  | the contract in `routes/` a controller is declared in without `--routes` |
| `make.migrations` | `{ "default": "database/migrations" }` | the chains `make migration --chain` picks from                           |
| `make.tests`      | `true`                                 | whether a test is written beside the file without `--test`/`--no-test`   |
| `make.stubs`      | `.config/sdxc/stubs`                   | the folder whose stubs replace the built-in ones                         |
| `format`          | none                                   | the command run once over every written and edited file                  |

The `doctor` key holds the settings of [`sdxc doctor`](/docs/sdxc/check-a-project):
`doctor.checks`, the folder of your own checks (`.config/sdxc/checks`), and
`doctor.migrations.accept`, the migration errors its `migrations` check steps past (`[]`).

## Make the generated files your own

Each file is written from a stub, and a stub in `make.stubs` replaces the built-in one of the
same name. Copy the built-in stubs to start from:

```bash
sdxc make stubs controller job
```

```text
Wrote .config/sdxc/stubs/job.cron.stub
Wrote .config/sdxc/stubs/job.stub
Wrote .config/sdxc/stubs/job.test.stub
```

That writes every stub whose name starts with each kind, such as `controller.stub`,
`controller.form.stub`, `controller.api.stub` and their `.test.stub` partners. `sdxc make stubs
scaffold` copies the ones [`sdxc scaffold`](/docs/sdxc/scaffold-a-resource) writes from, and with
no kind it copies all of them. A stub already in the folder is kept, so your edits survive a
second run. Delete the ones you leave unchanged: every kind without a stub of yours keeps the
built-in one, and takes its improvements when you upgrade.

A kind's stub is `<kind>.stub`, a flag that changes the file selects `<kind>.<variant>.stub`, and
the test is `<kind>.test.stub` or `<kind>.<variant>.test.stub`, falling back to the kind's test
stub when a variant has none of its own:

| Stub                   | Selected by                                      |
| ---------------------- | ------------------------------------------------ |
| `controller.form.stub` | `make controller --method form`                  |
| `controller.api.stub`  | `make controller --routes api`, by contract name |
| `job.cron.stub`        | `make job --cron`                                |
| `mcp.resource.stub`    | `make mcp --resource`                            |

A stub is the file's text with `{{placeholder}}`s. Every kind can use these:

| Placeholder     | For `trials/expire-old`                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `{{name}}`      | `expire-old`                                                                         |
| `{{key}}`       | `expireOld`                                                                          |
| `{{Name}}`      | `ExpireOld`                                                                          |
| `{{snake}}`     | `expire_old`                                                                         |
| `{{title}}`     | `Expire old`                                                                         |
| `{{specifier}}` | `~/app/jobs/trials/expire-old`, the file's import path                               |
| `{{header}}`    | the `@author` and `@copyright` tags, from `package.json`'s `author` or your git user |

Some kinds add their own:

| Kind         | Placeholders                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `controller` | `{{path}}`, the route's key path (`posts.show`); `{{routes}}`, the contract (`~/routes/web`)                    |
| `job`        | `{{path}}`, the job's key path (`trials.expireOld`)                                                             |
| `model`      | `{{columns}}`, a column line per field; `{{table}}`, the plural table (`posts`)                                 |
| `factory`    | `{{model}}`, the model's import path (`~/app/models/post`); `{{attributes}}`, a sample value per field          |
| `mcp`        | `{{path}}`; `{{tool}}`, the tool name (`search_posts`); `{{uri}}`, a resource's URI                             |
| `command`    | `{{command}}`, the words typed (`users grant`); `{{member}}` (`.users.grant`); `{{words}}` (`"users", "grant"`) |

A placeholder the kind does not define stops the command and lists the ones it accepts, so a
typo never reaches a generated file.

## Where to go next

- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — every file a resource needs, from
  one command.
- [Make a controller](/docs/sdxc/make-controller) — the kind most features start from.
- [List routes](/docs/sdxc/list-routes) — confirm what a new controller is mapped to.
