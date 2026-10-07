# blog

Remix v3 SSR blog for `sergiodxa.com`, rendered with `remix/component/server` and
served from a Cloudflare Worker.

Production URL: https://sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development.
2. Run `bun run db:local:migrate` to prepare the local D1 database.
3. Run `bun run dev` to start the development server at http://localhost:3000.

## Cloudflare Services

| Service     | Binding                                               | Purpose                                     |
| ----------- | ----------------------------------------------------- | ------------------------------------------- |
| D1 Database | `DB`                                                  | Blog content and CMS data                   |
| KV          | `CACHE`                                               | Response and data caching                   |
| KV          | `AUTH`                                                | Authentication/session state                |
| KV          | `REDIRECTS`                                           | URL redirect mappings                       |
| R2          | `BACKUPS`                                             | Database backup storage                     |
| Queue       | `QUEUE` (`blog-jobs`)                                 | Background jobs (Webmention receive/send)   |
| Rate limit  | `WEBMENTION_RATE_LIMITER`                             | Webmention endpoint budget                  |
| Rate limit  | `SUPPORT_RATE_LIMITER`                                | Encore support budget per IPv4 or IPv6 /64  |
| Email       | `EMAIL` (`send_email`)                                | Delivers Encore support requests            |
| Secret      | `SUPPORT_INBOX`                                       | Inbox Encore support requests go to         |
| Secrets     | `CLIENT_ID`, `CLIENT_SECRET`, `COOKIE_SESSION_SECRET` | OIDC and session secrets from Secrets Store |
| Assets      | N/A                                                   | Static assets served from `build/client`    |

Smart Placement and Observability are enabled.

## Features

- Server-rendered public articles, tutorials, bookmarks, feeds, and sitemap.
- CMS layout and authenticated routes for content management.
- Markdown processing through shared markdown utilities.
- Request-scoped services published onto the request context by middleware.
- Microformats2 markup (`h-entry`, `h-card`, `h-feed`, `rel="me"`) on public pages.
- Webmention receiving: `POST /webmention` queues verification, verified mentions wait in
  the CMS moderation queue (`/cms/webmentions`), and approved ones render under the post.
  Deleted posts answer 410 Gone.
- Webmention sending: creating, updating or deleting an article or tutorial notifies every
  page it links to (and every page it stopped linking to); a cron every 15 minutes sends
  for posts whose scheduled publish date has arrived.
- Full-text search at `/search` and through the MCP `search_posts` tool: an FTS5 index over
  each live post's title, tags and body, ranked title first, then tags, then body. Only posts
  published by now appear, previews and deleted posts never. Results page ten at a time with
  `Link` and `X-Total-Count` headers, and matched words are highlighted.
- Search syntax, shared by `/search`, the search panel and `search_posts`: `"phrases"`,
  `-exclusions`, `OR` in capitals, `title:` for a word in the title, and the filters
  `tag:"react router"` (a tutorial tag, any case), `kind:tutorial` (`article`, `tutorial`,
  `glossary`, plural accepted) and `lang:es` (also `locale:` and `language:`; `es` matches
  `es-AR`, and `spanish`/`español`/`english` work too). An article's language is its `locale`;
  tutorials and glossary entries are English. A search of filters alone lists newest first.
  `/search` explains the syntax under its form.
- Search from any page: the navigation's search pill, ⌘K / Ctrl+K, or `/` (outside a
  field) opens a panel near the top of the screen with a large search box; as you type, the
  top six matches appear under it, each with its matched words highlighted and a line of the
  post around the first match, plus a link to every result on `/search`. Enter goes to
  `/search` (or straight to the result when there is only one), ArrowDown/ArrowUp choose a
  result while typing stays in the box, Escape or a click outside closes it, and it reopens
  blank (on `/search`, on that page's query). Without JavaScript the panel is a plain search
  form.
- Encore support page (`/apps/encore/support`), the Support URL of the Encore App Store
  listings: a public form that mails each request to `SUPPORT_INBOX` from
  `encore@support.sergiodxa.com` with the visitor as Reply-To, behind same-origin checks,
  signed honeypot fields, a per-address rate limit, and a spam filter (local rules, a
  disposable-email check, and StopForumSpam's free lookup). A request scored as spam is
  discarded as if sent; an uncertain one arrives tagged `[Possible spam]` with its signals.
  An unset inbox makes the form report a failure.

## Routes

| Route                  | Description                                |
| ---------------------- | ------------------------------------------ |
| `/`                    | Homepage                                   |
| `/articles`            | Articles listing                           |
| `/articles/:slug`      | Article detail page                        |
| `/tutorials`           | Tutorials listing                          |
| `/tutorials/:slug`     | Tutorial detail page                       |
| `/bookmarks`           | Saved bookmarks                            |
| `/search`              | Full-text search over published posts      |
| `/frames/search`       | Search dialog body and top matches for `q` |
| `/rss`                 | Main RSS feed                              |
| `/atom.xml`            | Main feed as Atom                          |
| `/feed.json`           | Main feed as JSON Feed                     |
| `/articles.rss`        | Articles RSS feed                          |
| `/tutorials.rss`       | Tutorials RSS feed                         |
| `/bookmarks.rss`       | Bookmarks RSS feed                         |
| `/articles.atom`       | Articles Atom feed                         |
| `/tutorials.atom`      | Tutorials Atom feed                        |
| `/bookmarks.atom`      | Bookmarks Atom feed                        |
| `/articles.json`       | Articles JSON Feed                         |
| `/tutorials.json`      | Tutorials JSON Feed                        |
| `/bookmarks.json`      | Bookmarks JSON Feed                        |
| `/sitemap.xml`         | Sitemap for search engines                 |
| `/webmention`          | Webmention endpoint (POST)                 |
| `/apps/encore/support` | Encore support page and form               |
| `/apps/encore/privacy` | Encore privacy policy (`.md` for Markdown) |

## Client Islands

Pages are server-rendered documents. The document shell loads `bootstrap/browser.ts`, which
hydrates only the components marked with `clientEntry()` and keeps every link and form a full
document navigation. An island lives in `resources/components/`, one per file, declaring its
own module path (`/resources/components/<file>.tsx#<Export>`):

| Island          | Does                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| `SearchTrigger` | The navigation's search pill, and ⌘K / Ctrl+K, `/`, Escape and backdrop clicks          |
| `SearchBox`     | The dialog's box, reloading its frame as you type, with a busy state while results load |

Server components shared across pages sit beside them: `ActivityRow` draws a post as a row
(emoji per kind, title link, optional description, date) on the home page, `/search` and the
search dialog alike.

A page's `<Frame>` is rendered by the server through the app's own router, so frame content is
in the HTML a reader first receives. See
[ADR-005](../../docs/adr/blog/ADR-005-search-dialog-and-client-islands.md).

## Database

Migrations live in `database/migrations/`.

```bash
bun run db:local:migrate  # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
```

### Search index

`post_search` is a search-only projection of each live article, tutorial and glossary entry
(title, tags as a JSON array, and body or definition), written by the `Post` repository on
every create, update and delete. `post_search_fts` is its FTS5 index, kept in step by three
triggers. Publish state, kind and everything a result shows are read from `posts` and
`post_meta`. See [ADR-004](../../docs/adr/blog/ADR-004-full-text-search.md).

### Exporting the database

`wrangler d1 export` refuses a database holding a virtual table, so an export drops the index
first and rebuilds it after:

1. Drop the triggers, then the index, in this order, since a trigger left behind fails every
   write to `post_search`:

   ```sql
   DROP TRIGGER "post_search_fts_insert";
   DROP TRIGGER "post_search_fts_update";
   DROP TRIGGER "post_search_fts_delete";
   DROP TABLE "post_search_fts";
   ```

2. Export with `bunx wrangler d1 export DB --remote --output <file>`.
3. Recreate the index and the three triggers by running their statements from
   `database/migrations/0006_PostSearch.sql` with `bunx wrangler d1 execute DB --remote`.
4. Refill the index from `post_search`, which the drop left untouched:

   ```sql
   INSERT INTO "post_search_fts" ("rowid", "title", "tags", "content")
   SELECT "id", "title", "tags", "content" FROM "post_search";
   ```

Searches return nothing between steps 1 and 4, and post writes keep `post_search` current
throughout.

## Scripts

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `dev`               | Start the development server      |
| `build`             | Build for production              |
| `start`             | Preview the production build      |
| `cf:deploy`         | Deploy to Cloudflare Workers      |
| `cf:typegen`        | Generate Cloudflare binding types |
| `db:local:migrate`  | Apply local migrations            |
| `db:remote:migrate` | Apply remote migrations           |
| `typecheck`         | Type-check                        |

## Deployment

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required local variables and production secrets.
