---
title: Deploy
description: Build, apply the production migrations and deploy in that order, through your app's own migrate and deploy commands, after one look at the plan.
section:
    title: The sdxc command
    order: 2
order: 9
lastUpdated: 2026-10-19
outcomes:
    - "Why `sdxc deploy` builds, migrates and deploys in that order"
    - "What production runs after each step that can fail"
    - "How to change the migrate and deploy commands it runs, and how to run it in CI"
---

Shipping an app is three steps, and their order matters: code deployed ahead of its migration
runs against a schema it does not expect. `sdxc deploy` runs them in the only safe order, build,
apply the production migrations, deploy, behind one confirmation:

```bash
sdxc deploy
```

A failed build or migration stops the run before anything is deployed, so new code never
reaches production ahead of the schema it expects.

## How it asks the app

`sdxc deploy` runs no migration tool and no deploy tool of its own. It runs your project's
`build` script with the project's package manager, then two commands on
[the app's own command line](/docs/sdxc/run-app-commands):

| Command                         | What `sdxc deploy` uses it for                                    |
| ------------------------------- | ----------------------------------------------------------------- |
| `db migrate --remote --pending` | List the migrations production lacks, one per line, applying none |
| `deploy --dry-run`              | Check the build before the plan, uploading nothing                |
| `db migrate --remote`           | Apply the production migrations                                   |
| `deploy`                        | Ship the build                                                    |

A new app's commands run `cf d1 migrations list` and `cf d1 migrations apply` against the
database in `cloudflare.config.ts`, and `cf deploy --prebuilt` on the build in
`.cloudflare/output`, signed in as your `cf` login or `CLOUDFLARE_API_TOKEN`. To migrate
differently or deploy somewhere else, edit `app/commands/db/migrate.ts` or
`app/commands/deploy.ts`, and `sdxc deploy` follows:

```ts {% title="app/commands/deploy.ts" %}
export default createCommand(commandset.deploy, async (ctx) => {
	let command = [
		"cf",
		"deploy",
		"--prebuilt",
		...(ctx.flags.dryRun ? ["--dry-run"] : []),
	];
	let deployed = await ctx.exec(command, { cwd: PROJECT_ROOT });
	return isFailure(deployed) ? deployed : success();
});
```

> [!WARNING]
> Keep the contract the table describes when you edit these commands: `--pending` prints names
> and applies nothing, and `deploy --dry-run` uploads nothing. `sdxc deploy` runs both before it
> asks, so a `--pending` that applies migrations changes production before you answer.

A `db migrate` without `--pending` still works; the plan then says `db migrate --remote` runs
without listing what it applies, which is safe because applying a migration twice skips it.

## The plan

Before it changes anything remote, `sdxc deploy` builds, lists the pending migrations, runs the
app's `deploy --dry-run`, and prints the plan:

```text
App:        my-app
Build:      built just now
Migrations: 1 pending
  0002_add_posts.sql
Deploy:     the app's deploy command
```

Then it asks `Deploy my-app to production?`, and the default answer is no. A no exits 1 and
changes nothing. Migrations run only when some are pending.

## Flags

- `-y, --yes` deploys without asking. CI has no terminal to answer the question, so a run
  there needs it, and stops with a usage error without it.
- `--dry-run` builds, lists, checks and prints the plan, then stops: nothing is migrated or
  deployed.
- `--skip <step>` leaves out `build`, `migrate` or `deploy`. Repeat it or list them:
  `--skip build,migrate`. `--skip build` deploys the output an earlier build wrote, and an app
  without a database passes `--skip migrate`. Skipping both `migrate` and `deploy` is refused,
  since it leaves nothing to run in production; with only `deploy` skipped, the question
  becomes `Apply my-app's migrations to production?`.

```bash
sdxc deploy --dry-run
sdxc deploy --yes --skip build
sdxc deploy --skip build --skip migrate
```

## When a step fails

A failed step stops the run, and the message says what production runs now:

| Step that failed | Production                                                           |
| ---------------- | -------------------------------------------------------------------- |
| build            | unchanged; nothing was migrated or deployed                          |
| listing, dry run | unchanged; nothing was migrated or deployed                          |
| migrations       | nothing deployed; the migrations before the failure may be applied   |
| deploy           | the previous version, on the new schema when migrations were applied |

> [!NOTE]
> A failed deploy after applied migrations leaves the previous version serving the new schema. The
> failure names the migrations it applied, so you know which schema that version is reading.

Fix the cause and run `sdxc deploy` again: the migrations already applied are no longer
pending, so the second run applies only the rest.

A project that cannot be deployed this way is named before anything runs: a missing
`bootstrap/cli.ts`, a `package.json` without a `build` script (add one, or pass
`--skip build`), an app command line without `db migrate` (add one, or pass `--skip migrate`),
or without a `deploy` that takes `--dry-run` (add one, or pass `--skip deploy`).

## In CI

```bash
sdxc deploy --yes
```

Put the secrets `cf` needs in the CI environment, and run
[`sdxc doctor`](/docs/sdxc/check-a-project) in an earlier step: it fails on a secret
`cloudflare.config.ts` declares that CI cannot see.

## Where to go next

- [Run your app's commands](/docs/sdxc/run-app-commands) — `sdxc run db migrate` on its own,
  locally or with `--remote`.
- [Make a migration](/docs/sdxc/make-migration) — write the migration a deploy applies.
