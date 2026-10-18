# ADR-161: `sdxc deploy` Builds, Migrates and Deploys in That Order

## Status

**Accepted** - 2026-10-18

## Background

Shipping an app takes three steps, and their order matters: build, apply the production
migrations, then deploy. Deploying before the migration runs new code against the old schema;
migrating before a build that fails leaves the database ahead of every Worker that can be
deployed. `AGENTS.md` states the order as rules, and a person or an agent follows it by hand,
three commands at a time, from memory.

## Context

The pieces already exist in an app made from the `app` template:

- **Build.** The `build` script (`vp build`) writes `.cloudflare/output`, the Build Output
  Specification `cf deploy --prebuilt` uploads. `.cloudflare/output/v0/workers/<worker>/worker.config.json`
  holds the resolved Worker configuration: its `name`, and every binding with its type, so each
  D1 database's `id` is readable without evaluating `cloudflare.config.ts`.
- **Migrate.** `sdxc run db migrate --remote` (ADR-155) runs `cf d1 migrations apply <id> --dir
database/migrations` against the production database. `cf` asks "About to apply N
  migration(s)… continue?" on a terminal and answers yes when not interactive, which it decides
  from the TTYs and the `CI` variable.
- **List.** `cf d1 migrations list <id> --dir <dir>` prints the unapplied migrations as JSON,
  `[{ "Name": "0002_add_posts.sql" }]`, and reads the production database unless `--local` is
  passed. It needs the same credentials `apply` does and changes nothing.
- **Who.** `cf auth whoami` prints JSON: `authenticated`, the `email`, and the `accounts` the
  credentials reach. `cf` picks the deploy account from `CLOUDFLARE_ACCOUNT_ID`, then
  `cloudflare.config.ts`, then the only account, and asks when there are several.
- **Deploy.** `cf deploy --prebuilt` uploads the build output with the user's `cf` login or
  `CLOUDFLARE_API_TOKEN`.

## Decision

`sdxc deploy` runs the three steps in order, stops at the first that fails, and asks before the
first one that touches production.

1. **Preflight.** Without a terminal and without `--yes`, it ends with a usage error before
   doing anything, so CI states its consent in the command. `cf auth whoami` must report a login;
   otherwise it ends naming `cf auth login`.
2. **Build.** `<package manager> run build`, the project's own script. A project without a
   `build` script fails here, unless `--skip-build` deploys the output already on disk.
3. **Plan.** From the build output it reads the Worker name and the D1 binding the migration
   chain applies to: `DB`, or the only D1 binding. When that binding exists and the chain
   (`make.migrations.default`, `database/migrations` by default) holds a `.sql` file, it lists
   the pending migrations with `cf d1 migrations list`. It prints the Worker, the account, and
   every pending migration by name.
4. **Confirm.** `--yes` answers it; otherwise a terminal question, which defaults to no.
5. **Migrate.** Only when migrations are pending: `sdxc run db migrate --remote`, through the
   app's own `bootstrap/cli.ts` exactly as `sdxc run` starts it, with `CI=1` so `cf` takes the
   answer `sdxc deploy` already got instead of asking a second time.
6. **Deploy.** `cf deploy --prebuilt`, with the project's `node_modules/.bin` first on `PATH`.

Every failure says what already happened and what did not: "Build failed; nothing was migrated
or deployed", "Migrations failed; the Worker was not deployed, and cf applies migrations one at
a time, so earlier ones in the list may be applied", "Deploy failed; migrations 0002_add_posts.sql
were applied, so production runs the previous Worker on the new schema".

Flags:

- `--yes` (`-y`): confirms without asking; required without a terminal.
- `--dry-run`: runs the build and the read-only queries, prints the plan, and changes nothing
  remote. The plan comes from the build output, so a dry run builds; `--skip-build` reads the
  output already there.
- `--skip-build`: deploys the existing `.cloudflare/output`; fails when there is none.
- `--skip-migrations`: deploys without listing or applying migrations, for an app whose
  migrations are applied by other means.

The placeholder database id the template ships (`00000000-0000-4000-8000-000000000000`) fails
the plan with a message pointing at `cf d1 create`, since every `cf d1` call would reject it.

## Consequences

### Positive

- The order `AGENTS.md` requires is one command, so it holds for people and agents alike.
- The confirmation names every migration about to run against production.
- A failure states the state production is left in.

### Negative

- The plan needs a build, so `--dry-run` builds unless `--skip-build` is passed.
- An app whose migrations live outside its default chain, or apply to a binding other than `DB`
  among several, passes `--skip-migrations` and migrates by hand.
- Listing and applying are two `cf` calls, so a migration added between them is applied without
  being shown; both read the same directory in the same run, which makes that a local edit
  mid-deploy.

### Neutral

- `sdxc deploy` reads `cf`'s JSON output, whose shape is `cf`'s; a change there surfaces as a
  plan that fails to parse, before anything remote changes.

## Alternatives Considered

- **Calling `cf d1 migrations apply` directly.** It duplicates the app's own `db migrate
--remote`, which already knows the database id and the chain. The app's command stays the one
  place that applies migrations.
- **Confirming before the build.** The plan would lack the Worker name and the database id the
  build resolves. The build is local, so running it first costs nothing in production.

## References

- [ADR-100: Migrate Apps from Wrangler to the cf CLI](./ADR-100-cf-cli-migration.md)
- [ADR-148: `@sdxc/kit`](./ADR-148-sdxc-kit-cli-package.md)
- [ADR-155: The App Template Runs Database Work Through Its Own Command Line](./ADR-155-app-template-db-commands.md)
