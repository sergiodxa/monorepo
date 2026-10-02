# demo

Job board demo app for the Remix talk.

Production URL: Local app — it runs on a laptop and is never deployed.

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run db:local:migrate` to create the board's table
3. Run `bun run dev` to start the development server at http://localhost:3008

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

## Database

```bash
bun run db:local:migrate    # apply migrations to the local D1 copy
```

The local copy lives in `.cloudflare/state`, the same directory `bun run dev` reads, so a
fresh checkout needs the migration once before the board has a table.

## Spec

`spec/board.spec` drives the board through a real browser: it publishes a position through
the dialog, opens it, and finds the confirmation in the outbox. Its `setup` empties the
`postings` table in the local D1 copy and starts a dev server of its own on port 3008, which
the run stops when it ends, so keep that port free and run:

```bash
bun run spec
```

## Scripts

| Script                     | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `bun run dev`              | Start the development server               |
| `bun run build`            | Build for production                       |
| `bun run cf:typegen`       | Generate types for the Cloudflare bindings |
| `bun run db:local:migrate` | Apply migrations locally                   |
| `bun run spec`             | Start a dev server and run the spec suite  |

## Deployment

The board is a demo and stays local, so there is no deploy step.

## Environment Variables

See `.env.example`. Both Turnstile keys are optional: setting them moves the captcha onto
Cloudflare's challenge, and leaving them unset keeps the board on the local one.
