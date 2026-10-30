---
title: Run your app's commands
description: Run the command line your app ships in bootstrap/cli.ts from any folder in the project, for migrations, seeding, backfills and other work no request does.
section:
    title: The sdxc command
    order: 2
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "How `sdxc run` finds and runs your app's command line"
    - "Which commands a new app ships with"
    - "How to migrate, seed and query the local database, and preview an email, from the terminal"
---

An app created from the template has a command line of its own, in `bootstrap/cli.ts`, for
work that belongs to the app but to no request: migrations, seeding, backfills, granting a role.
`sdxc run` runs it from any folder in the project. This page is about running the commands;
[Your app's command line](/docs/operations-and-testing/your-apps-command-line) is about writing
them.

```bash
sdxc run --help
sdxc run about
sdxc run users grant ada@example.com --role admin
```

Every word after `run` reaches your app's command line as typed, `--help` included, and its
exit code is `sdxc run`'s, so a script or CI step can rely on it.

## How it runs

`sdxc run` finds the project root, the nearest folder with a `package.json`, and runs
`bootstrap/cli.ts` there, or the module `run.entry` names in
[the configuration](/docs/sdxc/configuration#run):

- with Bun for a project on Bun, as its `packageManager` or lock file says, and with Node
  otherwise;
- with the project's `node_modules/.bin` first on `PATH`, as a package script has it, so a
  command that runs `cf` or `vp` gets the project's own version;
- with its output straight on your terminal, and only the app's own messages when it fails.

A project without that module stops with a message naming where the command line goes.

## The commands a new app has

| Command                        | What it does                                                                |
| ------------------------------ | --------------------------------------------------------------------------- |
| `about`                        | the app's name, its `@sdxc/cli` and `remix` versions, and the runtime       |
| `console`                      | Bun's REPL with the local database as `db` and the app's models as `models` |
| `db migrate`                   | apply the migrations in `database/migrations/` the local database lacks     |
| `db migrate --remote`          | apply them to the production database with `cf d1 migrations apply`         |
| `db migrate --pending`         | print the ones the database lacks, one per line, applying none              |
| `db seed`                      | run the steps in `database/seed.ts` on the local database                   |
| `db fresh`                     | drop every local table and apply every migration again                      |
| `db fresh --seed`              | the same, then run `db seed`                                                |
| `db prepare`                   | apply pending local migrations, and seed a database that had none applied   |
| `db console`                   | a SQL prompt over the local database                                        |
| `emails preview <name>`        | print a declared email's subject and text part, rendered from `preview()`   |
| `emails preview <name> --html` | print its HTML part instead                                                 |
| `deploy`                       | upload the build in `.cloudflare/output` with `cf deploy --prebuilt`        |
| `deploy --dry-run`             | run `cf`'s checks on the build and upload nothing                           |
| `typegen`                      | write the Worker's `env` types from `cloudflare.config.ts`                  |

`db migrate` and `db console` use the same SQLite file `bun dev` serves, so a migration applied
here is the schema the dev server runs, and a row inserted at the prompt is on the next page
load. An applied migration is skipped, so `db migrate` is safe to run twice:

```bash
sdxc run db migrate
sdxc run db console --execute "SELECT count(*) FROM posts"
sdxc run db console < seed.sql
```

Run `typegen` after adding a binding or a secret, so `env` type checks against what the Worker
receives; [`sdxc doctor`](/docs/sdxc/check-a-project) warns when the types are older than
`cloudflare.config.ts`.

## Seed and reset the local database

`database/seed.ts` declares the rows a new database starts with, as named steps that write
through your models or factories, with `defineSeed` from `@sdxc/data-model/seed`. `db seed`
runs the steps in order and prints `Seeded <name>` for each:

```ts {% title="database/seed.ts" %}
import { defineSeed } from "@sdxc/data-model/seed";

import registry from "~/app/models";
import { PostFactory } from "~/database/factories/post";

export default defineSeed(registry, {
	posts: ({ factories }) => factories.createMany(PostFactory, 10),
});
```

```bash
sdxc run db seed
sdxc run db fresh --seed
sdxc run db prepare
```

Factories draw from one fixed seed, so `db fresh --seed` writes the same rows every time.
`db seed` writes on every run, while `db prepare` seeds only a database with no migration applied,
so it is safe to run on every start. `db seed`, `db fresh` and `db prepare` change the local
database alone and refuse `--remote`.

`console` opens Bun's REPL with `bootstrap/console.ts` preloaded, so `db` and `models` are
there at the prompt:

```bash
sdxc run console
```

```text
> await models.post.query().all()
```

## Preview an email

`emails preview` renders a declared email from its template's `preview()` props, in the
language `--locale` names or the fallback one, and prints its subject and text part, or the HTML
document with `--html`. While `bun dev` runs, `/_emails` shows the same renders as an inbox, in
every supported language:

```bash
sdxc run emails preview teams.invite --locale es
sdxc run emails preview teams.invite --html
```

## Migrations in production

`--pending` works with `--remote` too, and that pair is how
[`sdxc deploy`](/docs/sdxc/deploy) lists what production lacks before it asks.

> [!WARNING]
> `db migrate --remote` changes production on its own. Ship a migration with `sdxc deploy`
> instead, which applies it right before the code that needs it and after one look at the plan.

## Add your own

[`sdxc make command`](/docs/sdxc/make-command) writes a command's handler and test, declares
it in `app/commands/index.ts` and maps it in `app/initializers/cli.ts`. A slash in the name is
a group, so `users/grant` runs as `sdxc run users grant`:

```bash
sdxc make command users/grant
sdxc run users grant --help
```

The commands run with the app's database, models, jobs and mailer, and only `bootstrap/cli.ts`
loads them, so none of them ships in the Worker. `sdxc scaffold --command` writes a resource's
`list`, `show`, `create` and `delete` commands the same way. Filling one in, with its arguments,
flags and the services it reads, is covered in
[Your app's command line](/docs/operations-and-testing/your-apps-command-line).

## Where to go next

- [Make a command](/docs/sdxc/make-command) — what `sdxc make command` writes and edits.
- [Deploy](/docs/sdxc/deploy) — how `db migrate --remote` and `deploy` ship the app.
