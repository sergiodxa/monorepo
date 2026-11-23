---
title: reader
headline: A feed reader where each feed is fetched once for everyone and each reader keeps their library in their own database
summary: A feed reader that follows RSS, Atom and JSON Feed, polls each feed at its own pace, takes WebSub pushes and keeps every reader's library in a Durable Object.
tagline: A feed reader with WebSub pushes
cover: home
shots:
  - id: home
    page: "https://reader.sergiodxa.com/"
    alt: The reader landing page, with the headline beside a drawing of the reading queue.
  - id: queue
    page: "https://reader.sergiodxa.com/"
    highlight: "[aria-label^='The reading queue: eight posts']"
    alt: A drawn reading queue with eight posts from six feeds, five unread, one flagged by a filter and one saved.
  - id: fan-out
    page: "https://reader.sergiodxa.com/"
    highlight: "[data-slot='fan-out-diagram']"
    alt: A diagram of one conditional GET of Harbor Daily's feed fanning out to five readers' queues, each gaining three posts.
  - id: cadence
    page: "https://reader.sergiodxa.com/features/freshness"
    highlight: "[data-slot='drawn-chart']"
    alt: A bar chart of how often a feed is fetched by how often it posts, from every 15 minutes to once a day, with quiet feeds waiting 7 days.
  - id: feed-page
    page: "https://reader.sergiodxa.com/features/freshness"
    highlight: "[aria-label^='Harbor Daily']"
    alt: A drawn feed page for Harbor Daily, checked six minutes ago, with the span its posts stay for and a suggestion to shorten it.
  - id: article
    page: "https://reader.sergiodxa.com/features/articles"
    highlight: "[aria-label^='A Field Notes essay']"
    alt: A drawn article read in place in a serif face, with its byline and a link to the original.
  - id: agents
    page: "https://reader.sergiodxa.com/features/agents"
    highlight: "[data-slot='code-stage']"
    alt: An mcp.json that points an MCP client at reader.sergiodxa.com/mcp with a bearer token.
  - id: phone
    page: "https://reader.sergiodxa.com/docs"
    viewport: phone
    alt: The reader help hub on a phone, with search and the places to start.
---

reader follows any site that publishes a feed and puts everything those sites write in one list, with folders, saved posts, labels, search, filter rules, push notifications and the full article behind a post's link. It runs in production at [reader.sergiodxa.com](https://reader.sergiodxa.com) as one Cloudflare Worker, signs in through the author's OpenID Connect provider and sells Free, Paid and Premium plans through Polar.

It reads every feed format in the `@sdxc/*` collection in one app: RSS, Atom and JSON Feed through [@sdxc/feed](/api/feed), subscription lists through [@sdxc/opml](/api/opml), push delivery through [@sdxc/websub](/api/websub) and articles through [@sdxc/distill](/api/distill). The reason to read its source is the storage split underneath. Fetching belongs to a feed, reading belongs to a reader, and each is its own kind of Durable Object with its own SQLite database.

The screenshots come from the public site. The signed-in app sits behind sign-in, so its screens appear as the product drawings the marketing pages show.

## The brief

A feed reader looks simple and is not. Thousands of readers follow the same popular feeds, so fetching per reader multiplies requests to publishers for nothing. Feeds publish at wildly different rates, so one polling interval is either wasteful or stale. Publishers rewrite, truncate and delete items, and some feeds list only their latest ten posts. A reader's library grows without bound, and plans have to cap it without ever deleting what someone kept. Article extraction fetches arbitrary pages from the open web, which is slow and sometimes refused. And the whole thing has to answer the moment someone opens it.

reader takes these on with two kinds of Durable Object and a small D1 database. A `FeedDO` exists per canonical feed and owns fetching; a `UserDO` exists per reader, addressed by their OIDC subject, and owns settings, subscriptions, posts, tags, saved searches and filter rules. D1 holds only the shared feed catalog and what the payment platform last said. Each object migrates its own SQLite when it boots, from `database/feed-migrations` and `database/migrations`.

## One fetch for every follower

Each `FeedDO` fetches its document with a conditional request, parses it with [@sdxc/feed](/api/feed) whatever the format, stores its items and publishes its head: what the newest item is. Readers pull from that head. A reader opening the app compares each followed feed's head against what their own object holds, and materializes the missing posts behind the page they were already served. One fetch of a busy feed reaches everyone who follows it.

![One fetch fanning out to three readers' queues](/showcase/reader/fan-out.webp "One conditional GET every fifteen minutes serves every reader who follows the feed, however many there are.")

The reading queue the landing page draws is that materialized list: every post across every followed feed, which continues as the reader scrolls, narrowed to read or unread, to a search, or to both. A row can be marked read, saved or labelled, and on a phone a swipe across a row marks the post read. Read and saved marks use [OptimisticToggle](/api/ui/optimistic-toggle), so the row changes at once and the form posts behind it.

![A drawn reading queue](/showcase/reader/queue.webp "The queue: posts from every feed, with unread, filtered and saved posts marked.")

Following a feed walks its RFC 5005 archive or paged documents on a queue job, up to ten documents and 500 posts, so a new subscription arrives with history. When a feed declares itself complete, a post it stops listing leaves the reader's list too, unless they saved it.

## A schedule each feed earns

A feed's polling cadence comes from its measured publishing rate. A feed posting ten or more times a day is checked every fifteen minutes, one posting a couple of times a day hourly, and so on down to daily; a feed that has published nothing in a month waits a week. The freshness page draws that ladder as a [DrawnChart](/api/ui/drawn-chart).

![Fetch frequency by publishing rate](/showcase/reader/cadence.webp "A feed's publishing rate decides how often it is fetched, from every 15 minutes to weekly.")

Publishers that run a WebSub hub can push between polls. The callback at `/websub/:feedId/:token` echoes a challenge only for a subscription the app is waiting on, and checks each delivery's signature against the secret it shares with the hub before trusting it. A reader can also ask for a check on demand, for one feed or all of them.

Each feed has its own page in the app: when it was last checked, buttons to check it now or mark it read, and how long its posts stay, chosen from named spans (Breaking at three hours, News at eighteen, Articles at three days, Essays at two weeks, Evergreen forever). For a feed that publishes about fourteen posts a day, the page suggests a shorter span so the feed never becomes a backlog.

![A drawn feed page](/showcase/reader/feed-page.webp "A feed's page shows when it was checked and how long its posts stay, and suggests a shorter span for a busy feed.")

## Reading that renders before the network

A post's page in `app/http/controllers/post.tsx` is complete from the reader's own row: title, author, date, excerpt and the link render before anything external is asked for. On the paid plan, the article behind the link arrives through [@sdxc/lazy-frame](/api/lazy-frame). `app/services/article.ts` asks a shared KV cache first and fetches the page only on a miss, and whatever comes back (an article, a refusal, a timeout or nothing) is one of five outcomes the page has copy for. The article is set in the reader's chosen face, serif or sans, with the publisher named and the original a click away.

![A drawn article read in place](/showcase/reader/article.webp "The article reads in place in the reader's chosen face, with the original one click away.")

The scheme and reading face are decided before the page paints and follow the reader to any browser they sign in on. A podcast or video attachment plays in the post's own page with the browser's player. Push notifications go through [@sdxc/web-push](/api/web-push), with a minimum gap and a quiet window decided inside the reader's object.

## Limits enforced where the data lives

Search runs inside the reader's object through [@sdxc/search](/api/search): every word must appear in a post's title, summary or author, quoted phrases match as written, `OR` finds either word, and a leading `-` or `NOT` excludes one. A search can be kept and reopened.

The plan a reader is on is stored on their own object, which is where every limit meets the count it caps: feeds, saved posts and posts in all, from 25,000 posts on Free to 3,000,000 on Premium. [@sdxc/authz](/api/authz) policies in `app/policies/` decide what the tier, the operational flags and an agent token's scope allow. A plan the reader is over refuses what is new and leaves what is theirs in place, and a failed payment keeps everything for a fortnight. Polar delivers to `POST /webhooks/billing`, which verifies the signature, records the delivery and then re-reads what the customer holds from Polar itself; a daily cron re-reads every customer, so a lost delivery is repaired within a day.

## An agent surface, and your data back

`POST /mcp` answers the Model Context Protocol through [@sdxc/mcp](/api/mcp). An agent can read the queue, search it, list and read feeds, and with a token scoped to write, mark, keep, follow and unfollow. Tokens are minted in Settings, shown once, and run behind their own rate limit.

![Connecting an MCP client](/showcase/reader/agents.webp "An agent connects with a token minted in Settings, scoped to read or write.")

Subscriptions import and export as OPML, folders included, and the full export is one ZIP built with [@sdxc/zip](/api/zip): subscriptions as OPML, kept posts with their labels as CSV, and both as JSON. The interface is in English and Spanish, resolved per request, and the help docs are built on the same docs kit as sdxc.dev.

![The help hub on a phone](/showcase/reader/phone.webp "The help docs, with search first, on a phone.")

## Where to start reading

- [`app/models/feed-store.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/reader/app/models/feed-store.ts) — the canonical feed object: polling, WebSub and the head it publishes.
- [`app/models/user-store.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/reader/app/models/user-store.ts) — the reader's object, where search, limits and policies run.
- [`app/http/controllers/post.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/reader/app/http/controllers/post.tsx) — a post page complete before the article frame loads.
- [`app/services/article.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/reader/app/services/article.ts) — the article cache and its five outcomes.
