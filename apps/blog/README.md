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
| KV          | `CACHE`                                               | Response, data and sponsor roster caching   |
| KV          | `AUTH`                                                | Authentication/session state                |
| KV          | `REDIRECTS`                                           | URL redirect mappings                       |
| R2          | `BACKUPS`                                             | Database backup storage                     |
| Queue       | `QUEUE` (`blog-jobs`)                                 | Background jobs (Webmentions, ActivityPub)  |
| Rate limit  | `WEBMENTION_RATE_LIMITER`                             | Webmention endpoint budget                  |
| Rate limit  | `ACTIVITYPUB_RATE_LIMITER` (namespace `1004`)         | ActivityPub inbox budget per IPv4 or /64    |
| Rate limit  | `SUPPORT_RATE_LIMITER`                                | Encore support budget per IPv4 or IPv6 /64  |
| Email       | `EMAIL` (`send_email`)                                | Delivers Encore support requests            |
| Secret      | `SUPPORT_INBOX`                                       | Inbox Encore support requests go to         |
| Secret      | `GITHUB_TOKEN`                                        | Reads the public GitHub Sponsors roster     |
| Secret      | `GITHUB_SPONSORS_WEBHOOK_SECRET`                      | Verifies GitHub's sponsorship webhook       |
| Secrets     | `CLIENT_ID`, `CLIENT_SECRET`, `COOKIE_SESSION_SECRET` | OIDC and session secrets from Secrets Store |
| Secrets     | `WAYBACK_ACCESS_KEY`, `WAYBACK_SECRET_KEY`            | archive.org keys from Secrets Store         |
| Secret      | `ACTIVITYPUB_PRIVATE_KEY`                             | ActivityPub signing key from Secrets Store  |
| Assets      | N/A                                                   | Static assets served from `build/client`    |

Smart Placement and Observability are enabled.

`COOKIE_SESSION_SECRET` signs the session cookie, so a page request arriving without it, or
with it empty, is answered with a 500.

## Features

- Server-rendered public articles, tutorials, bookmarks, feeds, and sitemap.
- CMS layout and authenticated routes for content management. Opening a CMS page without a
  session sends you to `/login?next=<path and query>`, and signing in lands back on that page,
  so a link such as `/cms/bookmarks/new?url=…` survives an expired session. `next` accepts
  only a path on this site; anything else lands on the dashboard. A first sign-in claims the
  existing account holding its email only when the identity provider has verified that
  address; an unverified one is sent back to the login screen to verify it first. CMS writes,
  like every form post on the site, are accepted only from the blog's own pages: a browser
  submitting one from another origin, a `*.sergiodxa.com` sibling included, gets a 403.
  `POST /mcp` and `POST /webmention` take any origin, since they read no cookie.
- Markdown processing through shared markdown utilities.
- Every tutorial downloads as an EPUB at `/tutorials/:slug.epub`, linked beside "View as
  Markdown". Links point back at the blog and images become links to the online copy, since
  an ebook embeds only files it carries; the permalink is the book's identifier, so a second
  download replaces the first in a reader's library.
- Request-scoped services published onto the request context by middleware.
- Microformats2 markup (`h-entry`, `h-card`, `h-feed`, `rel="me"`) on public pages.
- Webmention receiving: `POST /webmention` queues verification, verified mentions wait in
  the CMS moderation queue (`/cms/webmentions`), and approved ones render under the post.
  Deleted posts answer 410 Gone.
- Webmention sending: creating, updating or deleting an article or tutorial notifies every
  page it links to (and every page it stopped linking to); a cron every 15 minutes sends
  for posts whose scheduled publish date has arrived.
- ActivityPub: the blog is one fediverse account, `@hello@sergiodxa.com` (a `Person` at
  `/activitypub/actor`, found through WebFinger), that anyone can follow; follows are
  accepted on arrival. Creating an article or tutorial delivers it to followers as an
  `Article`, editing it delivers an `Update`, and deleting it a `Delete`; a cron every 15
  minutes delivers posts whose scheduled publish date has arrived. Posts public before
  federation started are in the outbox but were never pushed. Replies, quotes, mentions,
  likes and boosts of a post are stored as Webmentions: they join the same moderation queue,
  a host allowed there is approved on arrival and a blocked one is refused outright (it can
  neither deliver nor follow), and approved ones render under the post. An `Undo` or
  `Delete` withdraws them. A post page and the home page answer ActivityStreams to a client
  that asks for it in `Accept`, and link it as `<link rel="alternate">`.
- Full-text search at `/search` and through the MCP `search_posts` tool: an FTS5 index over
  each live post's title, tags and body (a bookmark's title, its address without the
  scheme so a site's name finds it, and its description, which its result shows as the
  excerpt; a bookmark result links to the saved page), ranked title first, then tags, then body. Only posts
  published by now appear, previews and deleted posts never. Results page ten at a time with
  `Link` and `X-Total-Count` headers, and matched words are highlighted.
- Search syntax, shared by `/search`, the search panel and `search_posts`: `"phrases"`,
  `-exclusions`, `OR` in capitals, `title:` for a word in the title, and the filters
  `tag:"react router"` (a tutorial tag, any case), `kind:tutorial` (`article`, `tutorial`,
  `glossary`, `bookmark`, plural accepted, `like` for bookmarks too) and `lang:es` (also `locale:` and `language:`; `es` matches
  `es-AR`, and `spanish`/`español`/`english` work too). An article's language is its `locale`;
  tutorials and glossary entries are English. A search of filters alone lists newest first.
  `/search` explains the syntax under its form.
- Search from any page: on a screen at least 40rem wide, the navigation's "Search ⌘K" pill,
  ⌘K / Ctrl+K, or `/` (outside a field) opens a panel near the top of the screen with a large
  search box; on a narrower screen the round magnifier beside the site name goes to `/search`
  instead (the shortcuts still open the panel). As you type, the
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
- Bookmarks saved from a URL alone: the quick add on `/cms` and `/cms/bookmarks`, or
  `/cms/bookmarks/new?url=…`, reads the page while saving and fills the title (its
  `og:title`, then `<title>`, then first heading) and description (its `og:description` or
  `description`, else its opening paragraph) the form left empty; a typed value always wins.
  A URL already bookmarked opens that bookmark instead, ignoring `http`/`https`, `www.`, a
  trailing `/` and tracking parameters (`utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`,
  which are also removed from the saved URL).
- Weekly bookmark check: Mondays at 06:00 UTC every bookmark's page is read once, as
  `sergiodxa.com bookmarks`, honoring `robots.txt`. A page that moved to another host (or to
  its site's front page) or is gone (404, 410, a redirect loop, a host that no longer resolves)
  is read again twelve hours later and flagged only when the second read agrees; a refusal,
  a bot challenge, a server error or a timeout never flags. Flagged bookmarks are marked in
  `/cms/bookmarks`, the edit page says what the check found (offering a moved page's new
  address), and saving the bookmark reviews it. A daily digest at 14:00 UTC mails new flags
  to hello@sergiodxa.com from `bookmarks@support.sergiodxa.com`. The same read fills a title
  or description the bookmark is missing.
- Bookmark archiving: saving a bookmark (or changing its URL) asks the Wayback Machine's Save
  Page Now for a capture, and the 🏛️ link on `/bookmarks` opens that capture. A bookmark saved
  more than a week ago takes the closest capture the archive already holds, else asks for
  one; the weekly check backfills every bookmark without one, retrying a refused capture after
  thirty days. Captures run under the archive.org keys (from `archive.org/account/s3.php`)
  stored as `BLOG_WAYBACK_ACCESS_KEY` and `BLOG_WAYBACK_SECRET_KEY` in the Secrets Store.
- Sponsors page (`/sponsors`): why sponsoring helps, GitHub Sponsors, one-off PayPal ($5,
  $10, $20) and Ko-fi tips, then current sponsors named with large avatars and past ones as
  a wall of small avatars. The `sponsors.refresh` job stores GitHub's public roster in
  `CACHE` with `GITHUB_TOKEN` (no scopes needed); GitHub's sponsorship webhook at
  `POST /webhooks/sponsors`, signed with `GITHUB_SPONSORS_WEBHOOK_SECRET`, queues it on
  every sponsorship change, and a Monday cron queues it to catch a missed delivery. Each
  list draws only when it names someone. The
  short `/sponsor` link and the card under every post lead here.

## Routes

| Route                    | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `/`                      | Homepage                                              |
| `/articles`              | Articles listing                                      |
| `/articles/:slug`        | Article detail page                                   |
| `/tutorials`             | Tutorials listing                                     |
| `/tutorials/:slug`       | Tutorial detail page                                  |
| `/tutorials/:slug.epub`  | Tutorial as an EPUB ebook                             |
| `/bookmarks`             | Saved bookmarks                                       |
| `/search`                | Full-text search over published posts                 |
| `/frames/search`         | Search dialog body and top matches for `q`            |
| `/rss`                   | Main RSS feed                                         |
| `/atom.xml`              | Main feed as Atom                                     |
| `/feed.json`             | Main feed as JSON Feed                                |
| `/articles.rss`          | Articles RSS feed                                     |
| `/tutorials.rss`         | Tutorials RSS feed                                    |
| `/bookmarks.rss`         | Bookmarks RSS feed                                    |
| `/articles.atom`         | Articles Atom feed                                    |
| `/tutorials.atom`        | Tutorials Atom feed                                   |
| `/bookmarks.atom`        | Bookmarks Atom feed                                   |
| `/articles.json`         | Articles JSON Feed                                    |
| `/tutorials.json`        | Tutorials JSON Feed                                   |
| `/bookmarks.json`        | Bookmarks JSON Feed                                   |
| `/sitemap.xml`           | Sitemap for search engines                            |
| `/webmention`            | Webmention endpoint (POST)                            |
| `/activitypub/actor`     | ActivityPub actor (`@hello@sergiodxa.com`)            |
| `/activitypub/inbox`     | ActivityPub inbox, personal and shared (POST, signed) |
| `/activitypub/outbox`    | Published posts as `Create`s, `?page=true` pages      |
| `/activitypub/followers` | Follower count and pages                              |
| `/activitypub/following` | Empty collection                                      |
| `/.well-known/webfinger` | WebFinger; `self` is the ActivityPub actor            |
| `/.well-known/nodeinfo`  | Links the NodeInfo 2.1 document                       |
| `/nodeinfo/2.1`          | NodeInfo: software, one user, post count              |
| `/apps/encore/support`   | Encore support page and form                          |
| `/apps/encore/privacy`   | Encore privacy policy (`.md` for Markdown)            |

## Client Islands

Pages are server-rendered documents. The document shell loads `bootstrap/browser.ts`, which
hydrates only the components marked with `clientEntry()` and keeps every link and form a full
document navigation. An island lives in `resources/components/`, one per file, declaring its
own module path (`/resources/components/<file>.tsx#<Export>`):

| Island      | Does                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SearchBox` | The dialog's box, reloading its frame as you type; also the trigger clicks on wide screens, ⌘K / Ctrl+K, `/`, Escape and backdrop clicks (`search-keys.ts`) |

The search trigger itself is a static link to `/search` (`SearchTrigger`, a `NavPill` like the
navigation's), so it works before any script loads.

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

### Bookmarks

A bookmark is a `like` post whose title, URL and description live in `post_meta`. The
`bookmarks` table holds one row per live bookmark, written by the system: the address that
judges duplicates (unique, so a double submit cannot save a URL twice), the latest read of
the page, and the review and archive state. Deleting a bookmark removes its row, so its URL
can be bookmarked again. See
[ADR-006](../../docs/adr/blog/ADR-006-bookmark-metadata-link-checks-and-archiving.md).

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

## Bookmarking From The iOS Share Sheet

A Shortcut opens the CMS form with the shared URL filled in; no app is involved.

1. In Shortcuts, create a shortcut named "Bookmark", open its details and turn on
   **Show in Share Sheet**, accepting **URLs**.
2. Add **URL Encode** on the **Shortcut Input**.
3. Add **Text** with `https://sergiodxa.com/cms/bookmarks/new?url=` followed by the
   **URL Encoded Text** variable.
4. Add **Open URLs** with that **Text**.

Sharing a page to "Bookmark" opens the form in Safari; **Create Bookmark** saves it with the
page's title and description. A URL already bookmarked opens that bookmark instead, and an
expired session signs in first and comes back to the form.

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

## Jobs

| Job                     | Trigger                    | Work                                                             |
| ----------------------- | -------------------------- | ---------------------------------------------------------------- |
| `activityPub.process`   | Queued by the federation   | One inbox activity, one fan-out, or one signed delivery          |
| `activityPub.publish`   | CMS create, update, delete | Picks `Create`, `Update` or `Delete` for a post and publishes it |
| `activityPub.scheduled` | `*/15 * * * *`             | Publishes posts whose scheduled date arrived and never federated |

`activityPub.process` retries what the next attempt can change (a server error, a timeout,
a `429`, a failing store) on the federation's backoff, about 21 hours over the queue's five
retries, and acknowledges the rest. `posts.federated_at` records the first `Create`, which is
what makes later changes an `Update` and a deletion a `Delete`.

## Deployment

```bash
bun run build
bun run db:remote:migrate
bun run cf:deploy
```

### Deploying Federation

The actor's id and key are what every follower caches, so both are fixed before the first
deploy that serves them.

1. Generate the actor's key once, from `apps/blog`:

   ```bash
   bun -e 'import { ActorKeys } from "@sdxc/activitypub"; import { unwrap } from "@sdxc/result"; process.stdout.write(unwrap(await ActorKeys.generate()).privateKeyPem)' > activitypub-key.pem
   ```

2. Store it in the Secrets Store as `BLOG_ACTIVITYPUB_PRIVATE_KEY`, then delete the file:

   ```bash
   bunx wrangler secrets-store secret create e8d9e39c4db6485bbd65a9658e8f9a71 \
     --name BLOG_ACTIVITYPUB_PRIVATE_KEY --scopes workers --remote \
     --value "$(cat activitypub-key.pem)"
   rm activitypub-key.pem
   ```

3. Build, apply migrations `0010_ActivityPubFollowers` and `0011_PostFederatedAt` (which
   marks every post already public as federated), and deploy. The deploy creates the
   `ACTIVITYPUB_RATE_LIMITER` binding (namespace `1004`) from `wrangler.jsonc`.

   ```bash
   bun run build
   bun run db:remote:migrate
   bun run cf:deploy
   ```

4. Check the actor carries its key, then follow `@hello@sergiodxa.com` from a Mastodon
   account and reply to, like and boost a post:

   ```bash
   curl -s -H 'Accept: application/activity+json' https://sergiodxa.com/activitypub/actor | jq .publicKey
   ```

A post page and the home page are edge-cached as HTML for a minute. Only that variant is
stored (ActivityStreams and negotiated Markdown answer `private`), so a browser never
receives JSON. Workers Cache serves a hit without running the Worker and documents no `Vary`
handling for it, so check after deploying: view a post in a browser, then request it with
`Accept: application/activity+json` and read `cf-cache-status`. A `HIT` with an HTML body
means a server asking for ActivityStreams within that minute gets the page; the fix is a
Cache Rule that varies on `Accept`, or edge caching off for post pages.

## Environment Variables

See `.env.example` for required local variables and production secrets.
