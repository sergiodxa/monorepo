# reader

Follow any site that publishes RSS or Atom and read everything it writes in one place.

Production URL: https://reader.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3006

From the repo root: `bun check` (format, lint and type check in one pass) and `bun run test`.

## Cloudflare Services

| Service        | Binding | Purpose                                           |
| -------------- | ------- | ------------------------------------------------- |
| KV             | `KV`    | Session storage and the OIDC discovery/JWKS cache |
| Durable Object | `USER`  | One object per reader: settings, feeds and posts  |

Each `USER` object is addressed by the reader's OIDC subject and keeps its own SQLite,
migrated at boot. It schedules its own refresh through an alarm, so how often a reader's
feeds are checked is a preference rather than a deployment setting.

Observability is enabled. The KV namespace id in `wrangler.jsonc` is a placeholder:
create the namespace with `bunx wrangler kv namespace create` and paste its id into both
`id` and `preview_id` before the first deploy.

## Features

- Sign-in through the OpenID Connect provider at auth.sergiodxa.com
- A reading queue of the unread items across every followed feed, paged by a cursor
- Follow a feed by its own address or by the address of a site that advertises one
- Unfollow a feed, which takes its posts with it
- A refresh schedule of your own choosing, from hourly to daily, or a check on demand
- Search across the posts of every feed you follow
- Mark one feed or the whole queue read at once
- Import and export your subscriptions as OPML
- Interface in English and Spanish, resolved per request

## Integrations

- **auth.sergiodxa.com** - OpenID Connect provider for sign-in and sign-out

## Routes

### Public

| Route     | Description                                               |
| --------- | --------------------------------------------------------- |
| `/`       | Landing page; a signed-in visitor is sent to `/reading`   |
| `/auth`   | `GET` completes the OIDC callback, `POST` starts the flow |
| `/logout` | `GET` confirms, `POST` ends the session                   |

### Signed in

| Route                    | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `/reading`               | The unread queue across every feed              |
| `/reading/read`          | `POST` takes every unread post out of it        |
| `/search`                | Posts matching what you typed, across all feeds |
| `/feeds`                 | `GET` lists feeds, `POST` follows one           |
| `/feeds/refresh`         | `POST` checks every feed now                    |
| `/feeds.opml`            | Your subscriptions as OPML                      |
| `/feeds/import`          | `POST` follows everything in an OPML file       |
| `/feeds/:feedId`         | `GET` shows a feed, `DELETE` unfollows          |
| `/feeds/:feedId/refresh` | `POST` checks that feed now                     |
| `/feeds/:feedId/read`    | `POST` marks that feed's posts read             |
| `/items/:itemId/read`    | Marks an item read                              |
| `/settings`              | Reading preferences, and carrying subscriptions |

## Scripts

| Script       | Description                           |
| ------------ | ------------------------------------- |
| `dev`        | Start development server              |
| `build`      | Build for production                  |
| `start`      | Preview the production build          |
| `cf:deploy`  | Deploy to Cloudflare                  |
| `cf:typegen` | Generate the Cloudflare binding types |
| `typecheck`  | Type check with `tsc`                 |

## Deployment

```bash
bun run build
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required environment variables.
