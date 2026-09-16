# reader

Follow any site that publishes RSS or Atom and read everything it writes in one place.

Production URL: https://reader.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3006

From the repo root: `bun check` (format, lint and type check in one pass) and `bun run test`.

## Cloudflare Services

| Service        | Binding            | Purpose                                                        |
| -------------- | ------------------ | -------------------------------------------------------------- |
| KV             | `KV`               | Sessions, the OIDC cache, each feed's head, extracted articles |
| Durable Object | `USER`             | One object per reader: settings, subscriptions and posts       |
| Durable Object | `FEED`             | One object per canonical feed: the fetching and its items      |
| D1             | `PLATFORM_DB`      | The feed catalog, and what the payment platform last said      |
| Rate limiter   | `MCP_RATE_LIMITER` | The burst budget in front of the agent endpoint                |

Each `USER` object is addressed by the reader's OIDC subject and keeps its own SQLite,
migrated at boot. Fetching belongs to the feed rather than to any one follower: each `FEED`
object polls its own document at the cadence its measured publishing rate earns and
publishes its head, and a reader opening the
app compares that against what they have and materializes what they are missing behind the
page they were served.

Plans are sold through Polar, reached with `@sdxc/billing` from `app/lib/billing.ts`. The
platform delivers to `POST /webhooks/billing`, which verifies the signature, records the
delivery, and re-reads what the customer holds rather than trusting what arrived; a cron
trigger re-reads every reader who has ever bought something, so a lost delivery is repaired
within a day. The tier each reader is on lives on their own object, which is where every
limit is compared against the count it caps.

Observability is enabled. The KV namespace id in `wrangler.jsonc` is a placeholder:
create the namespace with `bunx wrangler kv namespace create` and paste its id into both
`id` and `preview_id` before the first deploy.

## Features

- Sign-in through the OpenID Connect provider at auth.sergiodxa.com
- One list of every post across every followed feed, which continues as you scroll it
- The same list narrowed to what is read or unread, to words you searched for, or to both
- Follow a feed by its own address or by the address of a site that advertises one
- Unfollow a feed, which takes its posts with it
- The article behind a post's link, fetched when you open that post and read in place,
  with the publisher named and the original a click away — on the paid plan
- A count of what is waiting the moment you open the reader, fetched behind the page
- A refresh schedule taken from each feed's own publishing rate, from every fifteen minutes
  for a feed publishing ten times a day to weekly for one that has published nothing in a month
- A check on demand for one feed or for all of them, on top of the one its schedule gives it
- Per-feed control of how long its posts stay, from three hours to forever
- Folders: group your feeds under a name and read the whole group as one stream
- Save a post, which keeps it whatever every other rule here would do to it
- Mark one feed or the whole queue read at once
- Import and export your subscriptions as OPML, folders and all
- Free, Paid and Premium plans, each sized by how many feeds, saved posts and posts in all
  it keeps: 250,000 posts on Free, 1,500,000 on Paid and 3,000,000 on Premium
- A failed payment keeps everything for a fortnight, and nothing is ever deleted by a plan
  change: a plan you are over refuses what is new and leaves what is yours where it is
- A light or dark scheme and a serif or sans reading face, both decided before the page is
  painted and both following you to any browser you sign in on
- A podcast or video attachment played in the post's own page, by the browser's own player
- A swipe across a row on a phone marks the post read, which the mark at its head also does
- An agent surface at `POST /mcp` speaking the Model Context Protocol: read the queue,
  search it, list and read feeds, and — with a token scoped to write — mark, keep, follow
  and unfollow. Authenticated by a token you mint in Settings, on the paid plan
- Interface in English and Spanish, resolved per request

## Integrations

- **auth.sergiodxa.com** - OpenID Connect provider for sign-in and sign-out
- **Polar** - the payment platform the plans are sold and billed through

## Routes

### Public

| Route     | Description                                               |
| --------- | --------------------------------------------------------- |
| `/`       | Landing page; a signed-in visitor is sent to `/reading`   |
| `/auth`   | `GET` completes the OIDC callback, `POST` starts the flow |
| `/logout` | `GET` confirms, `POST` ends the session                   |

### Signed in

| Route                       | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `/reading`                  | Every post, narrowed by `show` and by `q`      |
| `/reading/read`             | `POST` takes every unread post out of it       |
| `/reading/:feed`            | One feed, its health and its posts             |
| `/reading/:feed/:item`      | One post, and the article behind its link      |
| `/reading/folders/:folder`  | One folder's feeds, read as one stream         |
| `/saved`                    | The posts you asked to keep                    |
| `/feeds`                    | `POST` follows a feed                          |
| `/feeds/refresh`            | `POST` checks every feed now                   |
| `/feeds.opml`               | Your subscriptions as OPML                     |
| `/feeds/import`             | `POST` follows everything in an OPML file      |
| `/feeds/:feedId`            | `DELETE` unfollows a feed                      |
| `/feeds/:feedId/refresh`    | `POST` checks that feed now                    |
| `/feeds/:feedId/read`       | `POST` marks that feed's posts read            |
| `/feeds/:feedId/velocity`   | `POST` sets how long that feed's posts stay    |
| `/feeds/:feedId/folder`     | `POST` files that feed into a folder           |
| `/folders`                  | `POST` makes a folder                          |
| `/folders/:folderId`        | `POST` renames it, `DELETE` takes it away      |
| `/items/:itemId/read`       | Marks an item read                             |
| `/items/:itemId/save`       | Keeps an item, or stops keeping it             |
| `/settings`                 | Your plan, how your pages look, OPML           |
| `/settings/appearance`      | `POST` sets the scheme and the reading face    |
| `/settings/tokens`          | `POST` mints an agent token, shown once        |
| `/settings/tokens/:tokenId` | `DELETE` stops that token answering            |
| `/mcp`                      | `GET` explains it, `POST` answers an agent     |
| `/billing/checkout/:plan`   | `POST` opens the hosted page that sells a plan |
| `/billing/portal`           | `POST` opens the hosted page that manages one  |
| `/webhooks/billing`         | `POST` where the payment platform delivers     |

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
