---
title: Deploy your app
description: Create the Cloudflare resources a new app binds, set its secrets, keep .env.example, .dev.vars and cloudflare.config.ts in step, and deploy from your machine or from CI.
section:
    title: Getting started
    order: 1
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "Which Cloudflare resources a new app needs before its first deploy, and where each id goes"
    - "How a secret moves from `cloudflare.config.ts` to `.env.example`, `.dev.vars` and production"
    - "How to deploy with `sdxc deploy` from your machine and from CI"
---

A project from `sdxc create` runs locally with nothing set up: `bun dev` simulates its database,
sessions and queue, and reads its secrets from `.dev.vars`. Production needs each of those to
exist in your Cloudflare account first. You do this once per app; after that, every deploy is
`sdxc deploy`.

The commands below use [`cf`](https://github.com/cloudflare/cf#readme), the Cloudflare command
line the project installs, run through `bunx` so you get the project's version.

## Sign in

```bash
bunx cf auth login
```

On your machine, `cf` uses that login. In CI, it reads `CLOUDFLARE_API_TOKEN` instead, which
[In CI](#in-ci) sets up.

## Create the resources the app binds

Every binding the Worker reads is declared in `cloudflare.config.ts`. Three of them need a
resource in your account, and two of those need its id written back into the file.

The database, which `sdxc run db migrate --remote` and `sdxc deploy` migrate:

```bash
bunx cf d1 create --name links
```

Put the id it prints in the `DB` binding:

```ts {% title="cloudflare.config.ts" %}
DB: bindings.d1({ name: manifest.name, id: "<the id cf printed>" }),
```

> [!NOTE]
> The local database file is named after this id, so `bun dev` opens a new, empty one once you
> write it. Run `sdxc run db migrate` again to create your tables there.

The KV namespace that holds visitors' sessions:

```bash
bunx cf kv namespaces create --title links-sessions
```

```ts {% title="cloudflare.config.ts" %}
SESSIONS: bindings.kv({ id: "<the id cf printed>" }),
```

The queue the job dispatcher sends to and the Worker consumes, named like the Worker:

```bash
bunx cf queues create --queue-name links
```

Run `sdxc run typegen` after editing the file, so `env` type checks against what the Worker
receives.

## Set the site's own settings

Two values in `config/constants.ts` name the outside world, and both ship as placeholders:

- `SITE_URL` is the address the sitemap, `robots.txt` and canonical links are built from. Set
  it to the domain the app answers on.
- `MAIL_FROM` is the address the app's email comes from. Cloudflare sends only from a domain
  with [Email Routing](https://developers.cloudflare.com/email-routing/) enabled, so use an
  address on one.

## Secrets

A secret is a value the Worker reads from `env` that never goes into the repository: a signing
key, an API key. Four places name each one, and each has its own job:

| Where                   | What it holds                        | Committed |
| ----------------------- | ------------------------------------ | --------- |
| `cloudflare.config.ts`  | `bindings.secret()`, the declaration | yes       |
| `.env.example`          | the name, with a development value   | yes       |
| `.dev.vars`             | the values `bun dev` reads           | no        |
| your Cloudflare account | the production value                 | —         |

`cloudflare.config.ts` is the source of truth: `sdxc run typegen` types `env` from it. A fresh
clone and CI copy `.env.example` to `.dev.vars`, so it holds working development values.

> [!WARNING]
> A deploy fails when a secret the file declares is missing in production, and removes any
> production secret the file no longer declares. Set a new secret remotely before the first deploy
> that declares it.

A new app declares four. Set each one for production, with a long random value for the two
signing secrets, such as one from `openssl rand -base64 32`:

```bash
bunx cf workers secrets update SESSION_SECRET
bunx cf workers secrets update HONEYPOT_SECRET
bunx cf workers secrets update TURNSTILE_SITE_KEY
bunx cf workers secrets update TURNSTILE_SECRET_KEY
```

The two `TURNSTILE_*` values in `.env.example` are Cloudflare's test keys, which always pass.
[Create a Turnstile widget](https://developers.cloudflare.com/turnstile/get-started/) for the
production pair.

### Add a secret

When your code needs a new secret, such as an API key:

1. Declare it in `cloudflare.config.ts`: `STRIPE_KEY: bindings.secret(),`.
2. Add it to `.env.example` with a development value, and to your own `.dev.vars`.
3. Run `sdxc run typegen`, so `env.STRIPE_KEY` type checks.
4. Set the production value with `bunx cf workers secrets update STRIPE_KEY`.

`sdxc doctor` fails when step 2 is missing, since CI builds `.dev.vars` from `.env.example`.

## Deploy

```bash
sdxc deploy --dry-run
sdxc deploy
```

The dry run builds, lists the migrations production lacks and checks the build with `cf`,
changing nothing. `sdxc deploy` does the same, asks, then applies the migrations and uploads the
build. The first deploy answers on a `workers.dev` address; a custom domain is a
[route in `cloudflare.config.ts`](https://developers.cloudflare.com/workers/configuration/routing/).
[Deploy](/docs/sdxc/deploy) covers the plan and what each failing step leaves in production.

## In CI

A deploy from CI runs the same commands, with an API token in place of your login and `--yes`
in place of the question. [Create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
that can deploy Workers and edit D1 databases and queues, and store it as the repository secret
`CLOUDFLARE_API_TOKEN`.

```yaml {% title=".github/workflows/deploy.yml" %}
name: Deploy

on:
    push:
        branches: [main]

jobs:
    deploy:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: oven-sh/setup-bun@v2
            - run: bun install --frozen-lockfile
            - run: cp .env.example .dev.vars
            - run: bunx sdxc run typegen
            - run: bun check
            - run: bun run test
            - run: bunx sdxc doctor
            - run: bunx sdxc deploy --yes
              env:
                  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

`bunx sdxc` runs the release the project pins in its `devDependencies`, and `sdxc doctor` stops
the run before production changes when a secret or migration is out of step.

## Where to go next

- [Deploy](/docs/sdxc/deploy) — the plan, the flags, and what each failing step leaves behind.
- [Check a project](/docs/sdxc/check-a-project) — every check `sdxc doctor` runs in that
  workflow.
- [Configure the sdxc command](/docs/sdxc/configuration) — every key in `.config/sdxc.jsonc`.
