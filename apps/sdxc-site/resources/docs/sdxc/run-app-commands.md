---
title: Run your app's commands
description: Run the command line your app ships in bootstrap/cli.ts from any folder in the project, for migrations, seeding, backfills and other work no request does.
section:
    title: The sdxc command
    order: 2
order: 8
lastUpdated: 2026-10-19
outcomes:
    - "How `sdxc run` finds and runs your app's command line"
    - "Which commands a new app ships with"
    - "How to migrate and query the local database from the terminal"
---

An app created from the template has a command line of its own, in `bootstrap/cli.ts`, for
work that belongs to the app but to no request: migrations, seeding, backfills, granting a role.
`sdxc run` runs it from any folder in the project:

```bash
sdxc run about
sdxc run users grant ada@example.com --role admin
sdxc run --help
```

Every word after `run` reaches your app's command line as typed, `--help` included, and its
exit code is `sdxc run`'s, so a script or CI step can rely on it.

## How it runs

`sdxc run` finds the project root, the nearest folder with a `package.json`, and runs
`bootstrap/cli.ts` there:

- with Bun for a project on Bun, as its `packageManager` or lock file says, and with Node
  otherwise;
- with the project's `node_modules/.bin` first on `PATH`, as a package script has it, so a
  command that runs `cf` or `vp` gets the project's own version;
- with its output straight on your terminal, and only the app's own messages when it fails.

A project without `bootstrap/cli.ts` stops with a message naming where the command line goes.

## The commands a new app has

| Command                | What it does                                                            |
| ---------------------- | ----------------------------------------------------------------------- |
| `about`                | the app's name, its `@sdxc/cli` and `remix` versions, and the runtime   |
| `db migrate`           | apply the migrations in `database/migrations/` the local database lacks |
| `db migrate --remote`  | apply them to the production database with `cf d1 migrations apply`     |
| `db migrate --pending` | print the ones the database lacks, one per line, applying none          |
| `db console`           | a SQL prompt over the local database                                    |
| `deploy`               | upload the build in `.cloudflare/output` with `cf deploy --prebuilt`    |
| `deploy --dry-run`     | run `cf`'s checks on the build and upload nothing                       |
| `typegen`              | write the Worker's `env` types from `cloudflare.config.ts`              |

`db migrate` and `db console` use the same SQLite file `bun dev` serves, so a migration applied
here is the schema the dev server runs, and a row inserted at the prompt is on the next page
load. An applied migration is skipped, so `db migrate` is safe to run twice:

```bash
sdxc run db migrate
sdxc run db console --execute "SELECT count(*) FROM posts"
sdxc run db console < seed.sql
```

`--pending` works with `--remote` too, and that pair is how
[`sdxc deploy`](/docs/sdxc/deploy) lists what production lacks before it asks. Run `typegen`
after adding a binding or a secret, so `env` type checks against what the Worker receives;
[`sdxc doctor`](/docs/sdxc/check-a-project) warns when the types are older than
`cloudflare.config.ts`.

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
`list`, `show`, `create` and `delete` commands the same way.

## Where to go next

- [Your app's command line](/docs/operations-and-testing/your-apps-command-line) — write the
  commands `sdxc run` runs, with their flags and the services they read.
- [Deploy](/docs/sdxc/deploy) — how `db migrate --remote` and `deploy` ship the app.
