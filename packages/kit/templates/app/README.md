# App

A Remix v3 app on Cloudflare Workers, built on the `@sdxc/*` packages.

## Start

```sh
bun install
sdxc run typegen
sdxc run db migrate
bun dev
```

In a fresh clone, copy `.env.example` to `.dev.vars` first. Run `sdxc run typegen` again
whenever you change a binding in `cloudflare.config.ts`.

## Everyday commands

```sh
sdxc make controller about                 # a page, mapped in routes/web.ts
sdxc make controller api/keys --routes api # a JSON endpoint
sdxc make migration create-posts           # then: sdxc run db migrate
sdxc make model post                       # then: ctx.models.post
sdxc make job reports/daily --cron "0 8 * * *"
sdxc make email welcome
sdxc make command users/grant              # then: sdxc run users grant

sdxc run db console                        # SQL prompt over the local database
bun check                                  # format, lint and types
bun test
```

`sdxc make` writes the file where it belongs with a test beside it, and maps it so it works
right away. `sdxc` comes with the project; `npm add -g @sdxc/kit` puts it on your path.

## Where things go

| Folder                 | What lives there                                            |
| ---------------------- | ----------------------------------------------------------- |
| `routes/`              | URL contracts: `web.ts` for pages, `api.ts` for endpoints   |
| `app/http/`            | Controllers, middleware and input validators                |
| `app/models/`          | Database models, one per table                              |
| `app/jobs/`            | Background jobs                                             |
| `app/emails/`          | Emails                                                      |
| `app/commands/`        | Commands for `sdxc run`                                     |
| `app/initializers/`    | The one instance of each service: database, mailer, router… |
| `resources/`           | Layouts, components and translations (`resources/locales/`) |
| `database/migrations/` | SQL migrations                                              |
| `config/`              | Site settings, security policy, security.txt, API problems  |

## What a handler gets

Every request, job and command can read:

- `ctx.db` and `ctx.models`: the D1 database and its models.
- `ctx.email` (requests and commands): sends email, `later()` after the response or
  `await send()` before it. A command prints it instead of sending it.
- `ctx.log`, with a `trace_id` shared by a request and the jobs it starts.
- `ctx.timing`: adds entries to the `Server-Timing` header (requests only).

Pages also get `ctx.session`, `ctx.intl` for translated copy, and forms protected by a
honeypot, Turnstile and a spam filter. Before a page loads a script, style, image or font from
another origin, add that origin to `config/security-policy.ts`. API errors use the catalog in
`config/problems.ts`.

## Before the first deploy

1. Create the resources and put their ids in `cloudflare.config.ts`:
   `bunx cf d1 create <name>`, `bunx cf kv namespace create <name>`, and
   `bunx cf queues create <name>` (the `name` in `package.json`).
2. Set every secret in `.env.example` with `bunx cf workers secrets update <NAME>`.
3. Edit `config/constants.ts`: your domain, site name and description, and a `MAIL_FROM`
   address on a domain with Cloudflare Email Routing.
4. Put your contact in `config/security-txt.ts`.
5. Deploy:

```sh
bun check
bun build
sdxc run db migrate --remote
bun cf:deploy
```
