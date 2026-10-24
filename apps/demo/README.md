# demo

Job board demo app for the Remix talk.

Production URL: Local app — it runs on a laptop and is never deployed.

## Start

```sh
bun install
sdxc run typegen
sdxc run db migrate
bun dev
```

In a fresh clone, copy `.env.example` to `.dev.vars` first. `bun dev` serves the board at
http://localhost:3008. Run `sdxc run typegen` again whenever you change a binding in
`cloudflare.config.ts`.

## Everyday commands

```sh
sdxc make controller about                 # a page, mapped in routes/web.ts
sdxc make migration add-remote-flag        # then: sdxc run db migrate
sdxc make model company                    # then: ctx.models.company
sdxc make job postings/digest --cron "0 8 * * *"
sdxc make command postings/close           # then: sdxc run postings close

sdxc run db console                        # SQL prompt over the local database
sdxc run about                             # the versions the board is built on
sdxc run emails preview postingPublished   # print an email from its preview(); /_emails in bun dev
bun check                                  # format, lint and types, from the repo root
```

`sdxc make` writes the file where it belongs with a test beside it, and maps it so it works
right away. Where `sdxc` is not on your path, run `bun ../../packages/kit/src/bin.ts` in its
place.

Every adapter the app reaches for has an in-memory implementation, so the board runs with
no network at all: mail is captured and shown at `/outbox`, the listing cache and the job
queue live in the worker, and the captcha is a word the form prints.

## Cloudflare Services

| Service      | Binding     | Purpose                                               |
| ------------ | ----------- | ----------------------------------------------------- |
| D1 Database  | `DB`        | The board's postings                                  |
| Cron trigger | `0 3 * * *` | Enqueues the nightly sweep that closes stale postings |

## Features

- **Listing** — open positions, newest first, served from an in-memory cache
- **Component library** — every view is composed from `@sdxc/ui`, over the palette in
  `resources/css/colors.css` that the theme derives its semantic tokens from
- **Native dialogs** — the submit form opens as a `<dialog>` driven by `commandfor` and
  `command`, so reopening it after a refused submission takes no script
- **Deferred detail** — the listing carries summaries; a position's body is fetched from
  `/positions/:id` when its dialog opens, by one island the board links and nothing else
- **Markdown descriptions** — parsed in the position's own controller and rendered as UI
  nodes, so the board parses nothing per posting
- **Captcha** — Turnstile when a secret is configured, a printed word otherwise
- **Rate limit** — a per-address budget on the submit form and on the MCP endpoint
- **Background jobs** — a confirmation email per submission, and a nightly expiry sweep
- **Outbox** — every message the board sent, at `/outbox`
- **i18n** — English and Spanish, detected per request
- **MCP** — `list_jobs`, `search_jobs`, `get_job`, `publish_job` and a posting resource, mounted as an ordinary route

## Routes

| Route            | Method | Purpose                             |
| ---------------- | ------ | ----------------------------------- |
| `/`              | GET    | The open positions                  |
| `/`              | POST   | Publishes a position                |
| `/positions/:id` | GET    | One position, complete              |
| `/outbox`        | GET    | Every message the board sent        |
| `/mcp`           | POST   | The Model Context Protocol endpoint |
| `/health`        | GET    | The database's health report        |

## Database

```bash
sdxc run db migrate         # apply migrations to the local D1 copy
sdxc run db console         # query it
```

The local copy lives in `.cloudflare/state`, the same directory `bun dev` reads, so a
fresh checkout needs the migration once before the board has a table.

## Spec

`spec/board.spec` drives the board through a real browser: it publishes a position through
the dialog, opens it, and finds the confirmation in the outbox. Its `setup` empties the
`postings` table in the local D1 copy and starts a dev server of its own on port 3008, which
the run stops when it ends.

That server starts in the `spec` mode, which reads `.dev.vars.spec` in place of `.dev.vars`:
its empty Turnstile keys keep the captcha on the local word the spec types, whatever keys
your own `.dev.vars` holds. Keep port 3008 free and run:

```bash
bun run spec
```

## Scripts

| Script                | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `bun dev`             | Start the development server                   |
| `bun run build`       | Build for production                           |
| `bun run spec`        | Start a dev server and run the spec suite      |
| `bun run mcp:inspect` | Open an MCP inspector to call the `/mcp` tools |

## Deployment

The board is a demo and stays local, so there is no deploy step.

## Environment Variables

See `.env.example`. Both Turnstile keys are optional: setting them moves the captcha onto
Cloudflare's challenge, and leaving them unset keeps the board on the local one.
