# ADR-155: The App Template Runs Database Work Through Its Own Command Line

## Status

**Accepted** - 2026-10-16

## Background

The `app` template `sdxc create` writes has a D1 database. Its `db:local:migrate` and
`db:remote:migrate` scripts first called `cf d1 migrations apply` directly, which had three
problems:

- The database id was written three times: in `cloudflare.config.ts` and in both scripts.
- `cf d1 migrations apply --local` applies the chain and then never exits, so the script hangs.
- A developer had no way to look at the local rows short of starting the dev server.

The template already ships a command line, `bootstrap/cli.ts`, for work that belongs to the app
but to no request.

## Decision

Database work is a command group in the app's own command line, and the package scripts call
it:

```sh
bun run cli db migrate            # bun db:local:migrate
bun run cli db migrate --remote   # bun db:remote:migrate
bun run cli db console            # sql> prompt over the local copy
```

- **One id.** Every `db` command reads the database id from `cloudflare.config.ts`.
- **Local migrations run in-process.** `db migrate` opens the SQLite file Miniflare keeps for
  the `DB` binding, whose name derives from the database id, and applies every pending
  migration into the same `d1_migrations` table Wrangler and `cf` write. `cf` and `bun dev`
  then see the chain as applied.
- **Remote migrations stay with Cloudflare.** `--remote` runs `cf d1 migrations apply`, since
  only Cloudflare's API reaches the production database.
- **Commands share the app's services.** The command line publishes the local database as
  `ctx.db`, a mailer that prints instead of delivering as `ctx.email`, and the app's
  translations as `ctx.intl`, so a command reuses the models, emails and copy requests use.

## Consequences

- Adding a database task (seeding, a data fix, a report) is `sdxc make command db/<name>`,
  with the database already on its context.
- The local file's name follows Miniflare's Durable Object id derivation. When Miniflare
  changes how it names that file, `app/initializers/local-database.ts` changes with it.
