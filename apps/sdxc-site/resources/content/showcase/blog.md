---
title: blog
headline: One Markdown post, published as a page, three feeds, an EPUB, a search result and a fediverse post
summary: The author's site at sergiodxa.com, with articles in Markdown, full-text search, feeds in three formats, Webmentions, ActivityPub and a CMS behind sign-in.
cover: home
shots:
  - id: home
    page: "https://sergiodxa.com/"
    alt: The sergiodxa.com home page, with the navigation, the author's introduction, feed links and the Activity list.
  - id: activity
    page: "https://sergiodxa.com/"
    highlight: ".h-feed"
    alt: The home page's h-feed, the author's introduction and feed links over the Activity list, one row per post with an emoji for its kind, a title and a date.
  - id: dialog
    page: "https://sergiodxa.com/"
    click: "a[data-search-trigger]"
    highlight: "dialog#site-search"
    alt: The search dialog open over a blurred page, a large search box above links to every kind of post, from Articles to TILs and Sponsor.
  - id: tips
    page: "https://sergiodxa.com/search?q=remix"
    click: "main details > summary"
    highlight: "main details"
    alt: The Search tips disclosure open under the search box, listing each piece of the syntax beside what it finds.
  - id: results
    page: "https://sergiodxa.com/search?q=remix"
    highlight: "[aria-label='Search results']"
    alt: Search results for remix, ten to a page, each row with its kind's emoji, title, an excerpt and a date.
  - id: code
    page: "https://sergiodxa.com/tutorials/add-an-mcp-server-to-a-remix-v3-app"
    highlight: "[data-slot='code-block']"
    alt: A highlighted TypeScript code block in a tutorial, titled app/notes.ts, with a copy button.
  - id: bios
    page: "https://sergiodxa.com/press"
    highlight: "#bios-section"
    alt: The press kit's bios section, the author's bio in several lengths, each labelled with where it fits and its word count.
  - id: phone
    page: "https://sergiodxa.com/articles"
    viewport: phone
    alt: The articles topic on a phone, a list of articles newest first under the site navigation.
---

blog is the author's own site at [sergiodxa.com](https://sergiodxa.com): articles and tutorials written in Markdown, short notes and TILs, bookmarks, a glossary and a weekly post listing the packages released that week, plus about, now, uses, press and résumé pages in English and Spanish. A CMS behind sign-in writes all of it into D1, and one Cloudflare Worker serves it with KV caches, a queue for background work and R2 for backups.

It is the content pipeline of the `@sdxc/*` collection end to end. Markdown becomes a typed tree through [@sdxc/markdown](/api/markdown), code is highlighted with [@sdxc/highlight](/api/highlight), Mermaid diagrams render on the server through [@sdxc/diagram](/api/diagram), and the same post then leaves as an HTML page, RSS, Atom and JSON Feed entries, an EPUB, a search result, Webmentions and a fediverse post. Read it to see one source of content serve every format a reader, a feed reader or another server asks for.

## The brief

A personal site that takes the open web seriously has more surface than it looks. Readers subscribe in different feed formats, and some only follow on Mastodon. Other sites reply with Webmentions that need verifying and moderating. Search has to understand more than one word, because the author's own archive spans years and two languages. Code must be highlighted and copyable, diagrams must render without a client library, and long tutorials should be readable offline. Public forms attract spam. And all of it has to stay fast on a Worker that renders every page on the server.

blog takes all of that on. Posts are rows in D1 with a kind (article, tutorial, note, TIL, bookmark, glossary entry or weekly release), and `app/models/kinds.ts` is the one registry each kind's emoji, labels, search name, topic and ActivityPub type come from. The router in `app/initializers/router.tsx` maps public pages, the CMS, feeds and the federation endpoints, every route through `lazy()`, so a request loads only the controller it reaches.

## A home page that is a feed

The home page introduces the author, links the site's RSS, Atom and JSON Feed, and lists recent activity: every published post of any kind as one row, led by its kind's emoji, with a title phrased by kind ("I published", "I wrote about", "I saved") and its date. Notes and TILs show in place, with the date linking to the permalink. The list is marked up as a microformats2 `h-feed` through [@sdxc/microformats](/api/microformats), with an `h-entry` per post, so IndieWeb readers can follow the page itself.

![The Activity list](/showcase/blog/activity.webp "Every kind of post in one list, each row led by its kind's emoji.")

Each kind is also a topic. A topic is a stored, canonical search query with a title and a Markdown description; `/articles` and `/tutorials` are seeded topics, and the author can save any search as one. Every topic page has three feeds, `.rss`, `.atom` and `.json`, built with [@sdxc/rss](/api/rss), [@sdxc/atom](/api/atom) and [@sdxc/json-feed](/api/json-feed), each running the same query. The RSS feed advertises a WebSub hub in its `Link` header, and the blog pings the hub through [@sdxc/websub](/api/websub) when posts change.

## Search that understands a syntax

Full-text search runs on an SQLite FTS5 index over each live post's title, tags and body, ranked title first, then tags, then body. The syntax is shared by `/search`, the search panel and the MCP `search_posts` tool: `"phrases"`, `-exclusions`, `OR` in capitals, `title:`, and the filters `tag:`, `kind:`, `lang:` and `order:`. `tag:"remix@3.0.0"` also finds a post tagged with a newer `remix@3` version, and `lang:es` matches `es-AR`.

`/search` explains that syntax under its form in a native `<details>` disclosure, one example per line beside what it finds, so the reader learns the filters where they type.

![The Search tips disclosure](/showcase/blog/tips.webp "The syntax is explained under the search box, one example per line.")

Results page ten at a time with `Link` and `X-Total-Count` headers, matched words highlighted and a line of the post around the first match. A bookmark result shows its saved description and links to the page it saved.

![Search results for remix](/showcase/blog/results.webp "Each result shows its kind, a highlighted excerpt and its date.")

From any page, ⌘K, Ctrl+K or `/` opens a panel near the top of the screen. The panel's body is a server-rendered frame at `/frames/search`; a small `SearchBox` island reloads that frame as the reader types, listing the top six matches; before a word is typed, it lists each kind of post as a shortcut. The trigger itself is a plain link to `/search`, so before any script loads it is an ordinary search form, and on a narrow screen it goes straight to the search page.

![The search dialog open](/showcase/blog/dialog.webp "Opened blank, the search dialog offers every kind of post; typing reloads its server-rendered frame with matches.")

## Posts that read well everywhere

A post's Markdown is rendered per request. `app/http/view-models/post.ts` runs it through [@sdxc/markdown](/api/markdown), highlights fenced code with [@sdxc/highlight](/api/highlight) and turns Mermaid fences into SVG with [@sdxc/diagram](/api/diagram), all on the server. Code blocks render as [CodeBlock](/api/ui/code-block) with the file name as the title and a copy button.

![A highlighted code block in a tutorial](/showcase/blog/code.webp "Code is highlighted on the server, titled with its file and ready to copy.")

Every article and tutorial also downloads as an EPUB through [@sdxc/epub](/api/epub), linked beside "View as Markdown". Links point back at the blog, images become links to the online copy, and the permalink is the book's identifier, so a second download replaces the first in a reader's library. The about, now, uses, press and résumé pages answer as Markdown at `.md` too, and the one-page résumé PDF is typeset from the same content with [@sdxc/pdf](/api/pdf). Each post's social card is drawn on the Worker with [@sdxc/raster](/api/raster) and cached through [@sdxc/workers-cache](/api/workers-cache).

The press kit shows the structured-content approach at its plainest: one kit per language in `resources/content/press/`, with bios in five lengths, each labelled with where it fits and its word count, and a copy button on each.

![The press kit's bios](/showcase/blog/bios.webp "Bios in five lengths, each labelled with where it fits, from one structured kit per language.")

## The IndieWeb and the fediverse

Posts send and receive Webmentions through [@sdxc/webmention](/api/webmention). Creating, editing or deleting a post notifies every page it links to and every page it stopped linking to; a received mention is verified on a queue job, waits in a moderation queue in the CMS, and renders under the post once approved. Deleted posts answer 410 Gone.

The blog is also one fediverse account, `@hello@sergiodxa.com`, found through WebFinger and served through [@sdxc/activitypub](/api/activitypub). A new article or tutorial is delivered to followers as an `Article`, a note or TIL as a `Note`; edits send `Update` and deletions `Delete`. Replies, quotes, likes and boosts are stored beside Webmentions and moderated in the same queue. A post page answers ActivityStreams JSON to a client that asks for it in `Accept`.

## Work that runs on a schedule

[@sdxc/jobs](/api/jobs) carries Webmention and ActivityPub delivery, plus scheduled work: every fifteen minutes, deliveries for posts whose scheduled publish date has arrived; every Friday, a job that reads the week's GitHub releases and publishes "What I released this week" when a package shipped; every Monday, a bookmark check that reads each saved page, flags one that moved or vanished only after a second read twelve hours later agrees, and backfills Wayback Machine captures.

The support and press forms check same-origin, a signed [@sdxc/honeypot](/api/honeypot), a per-address rate limit and [@sdxc/spam](/api/spam), with a disposable-address check and a StopForumSpam lookup, before mailing through [@sdxc/mail](/api/mail). Every topic page reads cleanly on a phone, the navigation folding above the list.

![The articles topic on a phone](/showcase/blog/phone.webp "A topic on a phone: the same list, newest first, under the navigation.")

## Where to start reading

- [`app/initializers/router.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/blog/app/initializers/router.tsx) — the middleware chain and every public, CMS, feed and federation route.
- [`app/models/kinds.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/blog/app/models/kinds.ts) — the registry each kind's emoji, labels, search name, topic and ActivityPub type come from.
- [`app/http/view-models/post.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/blog/app/http/view-models/post.ts) — a post's Markdown becoming highlighted, diagrammed output.
- [`app/services/activitypub.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/blog/app/services/activitypub.ts) — delivering posts to followers and storing their replies.
