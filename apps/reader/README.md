# reader

Follow any site that publishes RSS or Atom and read everything it writes in one place.

Production URL: https://reader.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3006

From the repo root: `bun check` (format, lint and type check in one pass) and `bun run test`.

## Cloudflare Services

| Service        | Binding       | Purpose                                                       |
| -------------- | ------------- | ------------------------------------------------------------- |
| KV             | `KV`          | Sessions, the OIDC discovery/JWKS cache, and each feed's head |
| Durable Object | `USER`        | One object per reader: settings, subscriptions and posts      |
| Durable Object | `FEED`        | One object per canonical feed: the fetching and its items     |
| D1             | `PLATFORM_DB` | The feed catalog, mapping a feed's URL to its object          |

Each `USER` object is addressed by the reader's OIDC subject and keeps its own SQLite,
migrated at boot. Fetching belongs to the feed rather than to any one follower: each `FEED`
object polls its own document once a day and publishes its head, and a reader opening the
app compares that against what they have and materializes what they are missing behind the
page they were served.

Observability is enabled. The KV namespace id in `wrangler.jsonc` is a placeholder:
create the namespace with `bunx wrangler kv namespace create` and paste its id into both
`id` and `preview_id` before the first deploy.

## Features

- Sign-in through the OpenID Connect provider at auth.sergiodxa.com
- One list of every post across every followed feed, which continues as you scroll it
- The same list narrowed to what is read or unread, to words you searched for, or to both
- Follow a feed by its own address or by the address of a site that advertises one
- Unfollow a feed, which takes its posts with it
- A count of what is waiting the moment you open the reader, fetched behind the page
- A check on demand for one feed or for all of them, on top of the daily one every feed gets
- Per-feed control of how long its posts stay, from three hours to forever
- Save a post, which keeps it whatever every other rule here would do to it
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

| Route                     | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `/reading`                | Every post, narrowed by `show` and by `q`      |
| `/reading/read`           | `POST` takes every unread post out of it       |
| `/reading/:feed`          | One feed, its health and its posts             |
| `/saved`                  | The posts you asked to keep                    |
| `/feeds`                  | `POST` follows a feed                          |
| `/feeds/refresh`          | `POST` checks every feed now                   |
| `/feeds.opml`             | Your subscriptions as OPML                     |
| `/feeds/import`           | `POST` follows everything in an OPML file      |
| `/feeds/:feedId`          | `DELETE` unfollows a feed                      |
| `/feeds/:feedId/refresh`  | `POST` checks that feed now                    |
| `/feeds/:feedId/read`     | `POST` marks that feed's posts read            |
| `/feeds/:feedId/velocity` | `POST` sets how long that feed's posts stay    |
| `/items/:itemId/read`     | Marks an item read                             |
| `/items/:itemId/save`     | Keeps an item, or stops keeping it             |
| `/settings`               | How your feeds are checked, and OPML transfers |

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
