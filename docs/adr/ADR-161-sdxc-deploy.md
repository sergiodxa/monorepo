# ADR-161: `sdxc deploy` Builds, Then Runs the App's Own Migrate and Deploy Commands

## Status

**Accepted** - 2026-10-18

## Background

Shipping an app takes three steps, and their order matters: build, apply the production
migrations, then deploy. Deploying before the migration runs new code against the old schema;
migrating before a build that fails leaves the database ahead of every Worker that can be
deployed. `AGENTS.md` states the order as rules, and a person or an agent follows it by hand,
three commands at a time, from memory.

How an app is migrated and where it ships belong to the app. One app keeps its migrations in a
second chain, another applies them to a tenant database, a third deploys somewhere other than a
single Worker. A deploy command that hard-codes `cf d1 migrations apply` and `cf deploy` serves
only the apps shaped like the template.

## Context

An app made from the `app` template already has the pieces:

- **Build.** The `build` script (`vp build`) writes `.cloudflare/output`, the Build Output
  Specification `cf deploy --prebuilt` uploads.
- **Command line.** `bootstrap/cli.ts` runs the app's own commands (ADR-155), and
  `sdxc run <command>` starts it with the project's runtime and `node_modules/.bin` first on
  `PATH`. Its parser ends an unknown command or flag with exit code 2 and
  `Unknown command "…"` or `Unknown flag --…` on stderr.
- **Migrate.** `db migrate --remote` runs `cf d1 migrations apply` against the production
  database. `cf` asks before applying on a terminal and answers yes when `CI` is set.
- **Deploy.** `cf deploy --prebuilt` uploads the build output; `--dry-run` checks it and
  uploads nothing.

## Decision

The app owns migrating and deploying, as two commands on its command line; `sdxc deploy` owns
the order, the plan, the confirmation and the report of where production stands.

The template ships both commands:

- **`db migrate --remote`** applies the chain with `cf d1 migrations apply`. With `--pending` it
  prints the migrations the database lacks, one name per line, and applies nothing (from
  `cf d1 migrations list` remotely, from the journal locally). An up-to-date database prints
  nothing.
- **`deploy`** runs `cf deploy --prebuilt`; `deploy --dry-run` runs `cf deploy --prebuilt
--dry-run`. The template has no `cf:deploy` script, so the command line is the one place a
  deploy is defined.

An app migrates or ships differently by editing those two files.

`sdxc deploy` runs, in order, and stops at the first step that fails:

1. **Preflight.** Without a terminal and without `--yes`, it ends with a usage error before
   doing anything, so CI states its consent in the command. `--skip migrate --skip deploy` is a
   usage error, since nothing would reach production. A project without `bootstrap/cli.ts`
   fails, naming it.
2. **Build.** `<package manager> run build`, the project's own script. A project without a
   `build` script fails, naming `--skip build`.
3. **Plan.** `sdxc run db migrate --remote --pending` lists the pending migrations; then
   `sdxc run deploy --dry-run` runs with its output on the terminal, so the app shows what it
   would ship and checks it. It prints the app, the build, every pending migration by name, and
   the deploy step.
4. **Confirm.** `--yes` answers it; otherwise a terminal question, which defaults to no.
5. **Migrate.** `sdxc run db migrate --remote`, with `CI=1` so `cf` takes the answer
   `sdxc deploy` already got. It runs when migrations are pending, or when the app's
   `db migrate` has no `--pending` to list them, since applying is safe to repeat.
6. **Deploy.** `sdxc run deploy`.

An app's command line answers for itself: an `Unknown flag --pending` makes the plan say the
migrations cannot be listed and the migrate step runs anyway; an unknown `db migrate` or
`deploy` command fails before anything remote, naming the command to add or the `--skip` that
leaves it out.

Every failure says what already happened and what did not: "Build failed; nothing was migrated
or deployed", "Migrations failed, so nothing was deployed; the ones before the failure may be
applied", "Deploy failed; migrations 0002_add_posts.sql were applied, so production runs the
previous version on the new schema".

Flags:

- `--yes` (`-y`): confirms without asking; required without a terminal.
- `--dry-run`: runs the build and the plan, prints it, and changes nothing remote.
- `--skip <step>`: leaves out `build`, `migrate` or `deploy`; repeated (`--skip build --skip
migrate`) or as a list (`--skip build,migrate`). `--skip build` deploys the output already on
  disk; `--skip migrate` deploys an app whose migrations are applied by other means; `--skip
deploy` applies the migrations ahead of a later deploy.

## Consequences

### Positive

- The order `AGENTS.md` requires is one command, for people and agents alike, whatever the app
  migrates or deploys to.
- The confirmation names every migration about to run against production.
- A failure states the state production is left in.

### Negative

- The plan runs the app's command line twice before confirming, each start costing a runtime
  launch.
- The plan needs the app's `deploy --dry-run`, which needs a build, so `--dry-run` builds unless
  `--skip build` is passed.
- Listing and applying are two runs, so a migration added between them is applied without being
  shown; both read the same directory in the same run, which makes that a local edit mid-deploy.

### Neutral

- `sdxc deploy` recognizes a missing command by the usage error `@sdxc/cli` prints; a command
  line built on another parser reads as a failed plan, before anything remote changes.

## Alternatives Considered

- **Running `cf d1 migrations apply` and `cf deploy` from `sdxc deploy`.** Every app shaped
  differently from the template would pass `--skip` flags and migrate or deploy by hand. The
  app's commands are where it already says how it reaches its database.
- **Falling back to `cf deploy --prebuilt` for an app without a `deploy` command.** The deploy
  would then live in two places, and an app on another platform would get a `cf` error. A
  missing command fails with the fix instead.
- **Confirming before the build.** The plan would lack the app's own dry run, which reads the
  build. The build is local, so running it first costs nothing in production.

## References

- [ADR-100: Migrate Apps from Wrangler to the cf CLI](./ADR-100-cf-cli-migration.md)
- [ADR-148: `@sdxc/kit`](./ADR-148-sdxc-kit-cli-package.md)
- [ADR-155: The App Template Runs Database Work Through Its Own Command Line](./ADR-155-app-template-db-commands.md)
