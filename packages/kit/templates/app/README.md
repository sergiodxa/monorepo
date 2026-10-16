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
  parses forms, checks cross-origin posts, loads the visitor's session as `ctx.session` (a signed
  cookie naming a record in the `SESSIONS` KV store, saved after the controller runs) and the
  visitor's language as `ctx.intl`, refuses
  a post without valid honeypot fields, sends
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
binding in `cloudflare.config.ts`. Every request, job and command continues the caller's W3C
`traceparent` or starts a trace, and its log record carries the `trace_id`, so one query finds a
request and every job it enqueued. Every response carries a `Server-Timing` header with
the request's duration, and a handler adds its own entries through
`ctx.timing.measure("db", "listPosts", () => listPosts())`, which browser devtools show. Document an endpoint by adding its operation to
`routes/api.ts` and to `app/initializers/openapi.ts`.

## Search engines and security.txt

Set `SITE_URL`, `SITE_NAME` and `SITE_DESCRIPTION` in `config/constants.ts` to your domain and
copy. Every page's head then carries its title, description, canonical link on `SITE_URL` and
Open Graph tags, from the `title`, `description` and `url` it passes `DocumentLayout`.
`/robots.txt` lets every crawler in and names `/sitemap.xml`, which lists the home page; add a
page to `app/http/controllers/sitemap.ts` when it should be indexed. A path ending in `/`
redirects to the same path without it, and a `www.` host to the apex domain, the forms
canonical links use.

`/.well-known/security.txt` tells a researcher where to report a vulnerability. Replace the
contact in `config/security-txt.ts` with yours, and review the file before its `expires`
date: a test fails a month ahead.

## Languages

Page copy lives in `resources/locales/`, one MessageFormat 2 bundle per language, and a page
reads it through `ctx.intl.t("home.title")`, or `Trans` from `@sdxc/i18n/ui` for copy with
markup. The page middleware picks the language from `?lng=`, the session's `lng` value and
`Accept-Language`, falling back to English. Add a language by saving its bundle beside
`en.json` and listing it in `app/initializers/i18n.ts`, whose `translate(language)` serves a
job or an email the same copy.

## Email

`sdxc make email welcome` writes an email as a `remix/component` class in `app/emails/`. A
controller sends it through `ctx.email`, which every request carries: `ctx.email.later(email)`
sends after the response, and `await ctx.email.send(email)` when the response depends on it. A
job builds a mailer over the same transport, `new Mailer({ transport, from: MAIL_FROM })` from
`app/initializers/mail.ts` and `config/constants.ts`, and awaits `send()`.

Mail leaves through the `EMAIL` `send_email` binding, which `bun dev` simulates. Cloudflare
delivers only from a domain with Email Routing enabled, so set `MAIL_FROM` to an address on
yours before deploying.

## Database

`app/initializers/database.ts` opens `remix/data-table` over the `DB` D1 binding, and the router
and the job dispatcher publish it as `ctx.db`. `sdxc make model post` writes a model and
registers it in `app/models/index.ts`, so every request, job and command reaches it bound to its
database as `ctx.models.post`, and a new row gets a UUIDv7 id and its timestamps. Write a table's
migration and model with `sdxc make`, then apply the migrations to the local copy `bun dev` reads:

```sh
sdxc make migration create-posts
sdxc make model post
bun db:local:migrate
```

`bun db:local:migrate` runs `sdxc run db migrate`, which applies every migration the local
copy lacks and records it in the `d1_migrations` table D1 uses; `bun db:remote:migrate` adds
`--remote` and applies them to the production database through `cf d1 migrations apply`.
`sdxc run db console` opens a `sql>` prompt over the local copy, and
`sdxc run db console --execute "SELECT …"` runs one statement.

Under Vitest, `DB` is an in-memory SQLite stand-in from `@sdxc/cloudflare-mocks`, so a test runs
real SQL. Before the first deploy, create the database with `bunx cf d1 create <name>` and put the
id it prints in `cloudflare.config.ts`; the `db` commands read it from there. Do the same for sessions with `bunx cf kv namespace create <name>`, whose id goes in
the `SESSIONS` binding.

## Add code

`sdxc make <kind> <name>` writes a file of that kind where it belongs, with a test beside it,
and adds any `@sdxc/*` package the file imports to `package.json`. The project lists
`@sdxc/kit` as a dev dependency, so its package scripts and `bunx sdxc` reach the `sdxc`
command; `npm add -g @sdxc/kit` puts it on your path everywhere:

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
request. It runs on Bun, outside the Worker, through `sdxc run`, from any folder in the
project:

```sh
sdxc run about
sdxc run --help
```

`app/commands/index.ts` declares each command, and `sdxc make command users/grant` writes a
new one with its test, declared and mapped. A command reads the local database as `ctx.db`, sends
email through `ctx.email`, which prints each message to stderr instead of delivering it, and
writes its own output in the language `LANG` names through `ctx.intl`; `ctx.translate(language)`
writes to someone else in theirs.

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
