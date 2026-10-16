# App

A Remix v3 Worker on Cloudflare, built on the `@sdxc/*` packages.

## Develop

```sh
bun install
bun cf:typegen
bun dev
```

`bun cf:typegen` writes the Worker's types from `cloudflare.config.ts`; run it again after
changing a binding.

`bun dev` reads the Worker's secrets from `.dev.vars`, which `sdxc create` copies from
`.env.example`; in a fresh clone, copy it yourself. Before the first deploy, set each secret
`.env.example` lists with `cf workers secrets update <NAME>`, using production values.

## Routes

One router serves two route contracts:

- `routes/web.ts`, the pages. Each page controller declares `app/http/middleware/page.ts`, which
  parses forms, checks cross-origin posts, refuses a post without valid honeypot fields, sends
  the security headers in `config/security-policy.ts` and resolves the document's assets. A form
  renders the fields with `HoneypotFields` from `@sdxc/honeypot/ui`, and asks for Cloudflare
  Turnstile by rendering `TurnstileWidget` and declaring `captcha(turnstile)` on its action, and
  scores what a visitor wrote with `spamFilter` from `app/initializers/spam.ts`, as
  `sdxc make controller --method form` does. Name an origin in the policy's
  Content-Security-Policy before a page loads a script, style, image or font from it.
- `routes/api.ts`, the endpoints machine clients call: `GET /api/health`,
  `GET /api/openapi.json` and `POST /mcp`. Each declares `app/http/middleware/api.ts` (CORS), and
  errors answer as `application/problem+json` from the catalog in `config/problems.ts`; set
  `PROBLEMS_URL` in `config/constants.ts` to where your docs describe them.

Every request is rate limited per client address, 100 a minute, through the `RATE_LIMITER`
binding in `cloudflare.config.ts`. Document an endpoint by adding its operation to
`routes/api.ts` and to `app/initializers/openapi.ts`.

## Database

`app/initializers/database.ts` opens `remix/data-table` over the `DB` D1 binding, and the router
and the job dispatcher publish it as `ctx.db`. Write a table's migration and model with
`sdxc make`, then apply the migrations to the local copy `bun dev` reads:

```sh
sdxc make migration create-posts
sdxc make model post
bun db:local:migrate
```

Under Vitest, `DB` is an in-memory SQLite stand-in from `@sdxc/cloudflare-mocks`, so a test runs
real SQL. Before the first deploy, create the database with `bunx cf d1 create <name>` and put the
id it prints in `cloudflare.config.ts` and in the `db:local:migrate` and `db:remote:migrate`
scripts.

## Add code

`sdxc make <kind> <name>` writes a file of that kind where it belongs, with a test beside it,
and adds any `@sdxc/*` package the file imports to `package.json`. The `sdxc` command comes
from `npm add -g @sdxc/kit`:

```sh
sdxc make controller about
sdxc make controller api/keys --routes api
sdxc make job reports/daily --cron "0 8 * * *"
sdxc make mcp search-posts
```

A controller, a job and an MCP tool or resource are also declared and mapped, so they answer
as soon as the command finishes.

## Run commands

`bootstrap/cli.ts` is the app's own command line, for work that belongs to the app but to no
request. It runs on Bun, outside the Worker, through its package script:

```sh
bun run cli about
bun run cli --help
```

With `@sdxc/kit` installed globally, `sdxc run about` does the same from any folder in the
project.

`app/commands/index.ts` declares each command, and `sdxc make command users/grant` writes a
new one with its test, declared and mapped.

## Check and deploy

```sh
bun check
bun test
bun build
bun db:remote:migrate
bun cf:deploy
```

Create the job queue once before the first deploy: `bunx cf queues create <name>`, using the
`name` in `package.json`.
