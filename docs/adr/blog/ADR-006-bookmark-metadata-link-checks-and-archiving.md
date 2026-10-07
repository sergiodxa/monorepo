# ADR-006: Bookmark Metadata, Link Checks and Archiving

## Status

**Accepted** - 2026-10-07

## Background

The blog keeps 270 bookmarks (posts of type `like`), each a title typed by hand and a URL.
Saving one means opening the CMS, pasting the URL and typing a title, and nothing ever looks
at the URL again: pages move or disappear, and the only fallback a reader has is a Wayback
Machine link built from the bookmark's date, which leads nowhere when the archive never
captured the page.

This ADR covers four changes that share one fetch of the bookmarked page: filling a
bookmark's title and description from the page itself, adding a bookmark from a pasted or
shared URL with no duplicates, checking every bookmark weekly and flagging the ones that
moved or died for review, and asking the Wayback Machine to capture each page when it is
bookmarked.

## Context

### Current State

| Concern    | Today                                                                                  |
| ---------- | -------------------------------------------------------------------------------------- |
| Storage    | `posts` row of type `like`, `title` and `url` in `post_meta`                           |
| Creation   | CMS form only (`app/http/controllers/cms/bookmarks.tsx`), title typed by hand          |
| Duplicates | Unchecked; `css-tricks.com/how-to-section-your-html/` is saved twice (2020 and 2022)   |
| Search     | `post_search` holds the title and the address without its scheme                       |
| Feeds      | The item links to the page; its summary is the URL again                               |
| Wayback    | `LikePost.waybackSnapshotUrl` guesses a capture from `created_at`                      |
| Jobs       | `blog-jobs` queue, one message per invocation, one cron (`*/15 * * * *`)               |
| Email      | `send_email` binding `EMAIL`, sending from the verified `support.sergiodxa.com` domain |

### Issues Identified

| Issue                                         | Impact                                                             |
| --------------------------------------------- | ------------------------------------------------------------------ |
| A status code alone misjudges a page          | Bot walls answer 403/429; parked domains and soft 404s answer 200  |
| Every CMS write pings the WebSub hub          | Feed readers fetch a new bookmark seconds after it is saved        |
| Scraped titles carry markup whitespace        | Stored titles such as `"no\n          hello"`                      |
| CMS sign-in always lands on the dashboard     | A link into the CMS loses its destination when the session expired |
| Web Share Target is unsupported on iOS Safari | A web app cannot appear in the iOS share sheet                     |

## Decision

### Data Model

A bookmark's content stays in `post_meta`, beside `title` and `url`:

| Key           | Written by                                    | Read by                          |
| ------------- | --------------------------------------------- | -------------------------------- |
| `description` | The CMS form, or the page when left empty     | `/bookmarks`, feeds, search, MCP |
| `archived_at` | The archive job, as the capture's ISO instant | The Wayback link on `/bookmarks` |

A new `bookmarks` table holds what the system knows about each bookmark's address, one row per
live `like` post:

```sql
CREATE TABLE "bookmarks" (
  "post_id" TEXT PRIMARY KEY REFERENCES "posts" ("id") ON DELETE CASCADE,
  "address" TEXT NOT NULL UNIQUE,      -- the normalized address duplicates are judged by
  "status" TEXT,                       -- ok | moved | gone | blocked | flaky; NULL until checked
  "http_status" INTEGER,
  "final_url" TEXT,                    -- where the redirect chain ended
  "checked_at" TEXT,
  "flag" TEXT,                         -- moved | gone, while one is raised
  "flagged_at" TEXT,
  "reviewed_at" TEXT,                  -- the last CMS save
  "notified_at" TEXT,                  -- the digest that last reported the flag
  "described_at" TEXT,                 -- the last attempt to read title and description
  "archive_attempted_at" TEXT,
  "archive_job" TEXT                   -- a Save Page Now capture still being polled
);
```

`post_meta` keeps every value a post ever had, so it cannot carry a unique index; this table
can, which is what makes "no duplicates" hold under a double submit. Deleting a bookmark
tombstones its post and removes its row, so the address can be bookmarked again.

### Normalized Address

Two URLs are the same bookmark when their addresses match. The address is the URL with its
scheme, a leading `www.` and a trailing `/` removed, and its host lowercased; path, query and
fragment keep their case. A fragment counts (`#issuecomment-123` is one comment of a thread).
Tracking parameters (`utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`) are removed from the URL
before it is stored, so they never reach the address.

The migration computes the same address in SQL for the existing bookmarks, oldest first, and
tombstones every later bookmark whose address is already taken, which keeps the 2020 copy of
the one known duplicate. A test runs the migration over sample URLs and compares each address
with the TypeScript normalizer.

### Reading A Page

One function reads a bookmarked page for every caller: `follow` from `@sdxc/outbound` with
`GET`, five redirects and a deadline, so it answers the status and the final URL; then, for a
`2xx` HTML response, `distillFrom` from `@sdxc/distill` over the bounded body. Requests name
themselves `sergiodxa.com bookmarks (+https://sergiodxa.com/bookmarks)`. The weekly sweep
consults `robots.txt` through `@sdxc/robots`, and a disallowed path reads as `blocked`.

`@sdxc/distill` gains `excerpt` on its article: the page's `og:description`, `description` or
`twitter:description`, else the opening of the article's text, whitespace-collapsed and cut
at a word boundary. Its title already prefers `og:title`, then `<title>`, then the first
`<h1>`, collapsed the same way.

### Creating A Bookmark

The create action takes a URL alone (quick add) or the full form, and reads the page before it
saves, so the bookmark is complete when the WebSub ping goes out:

1. Clean the URL and compute its address. An existing bookmark with that address redirects to
   its edit page, which shows when it was saved.
2. Read the page within five seconds. A title or description the form left empty is filled
   from it; a value typed in the form always wins.
3. Save the post, then insert its `bookmarks` row with the check result already in hand. A
   conflict on the address (a concurrent submit) tombstones the post just created and
   redirects to the bookmark that won.
4. Enqueue `bookmarks.archive`, plus `bookmarks.inspect` when the read failed, so a page that
   was briefly unreachable still gets its title and description.

A bookmark saved without a title shows its address wherever a title would appear, until one is
read or typed.

Quick add is a URL field on `/cms` and `/cms/bookmarks`. `/cms/bookmarks/new?url=…` opens the
form with the URL filled in, which is what an iOS Shortcut bound to the share sheet opens
(three actions: receive URLs, build the address, open it; the recipe lives in the app README).
CMS sign-in returns to the page that sent the visitor to it, so the shortcut still lands on the
form after the session expired.

### Link Checks

`bookmarks.sweep` runs weekly and enqueues one `bookmarks.inspect` per bookmark with an
absolute URL, so one slow origin delays nobody else. Each inspection classifies what it read:

| Outcome   | When                                                                               | Flagged |
| --------- | ---------------------------------------------------------------------------------- | ------- |
| `ok`      | `2xx`, including a redirect that only changes scheme, `www.` or a trailing `/`     | No      |
| `moved`   | `2xx` after a redirect to another host, or to `/` from a deeper path               | Yes     |
| `gone`    | `404`, `410`, a redirect loop, or a host that no longer resolves                   | Yes     |
| `blocked` | `401`, `403`, `429`, `451`, another `4xx`, a Cloudflare challenge, or `robots.txt` | No      |
| `flaky`   | `5xx`, a timeout or a dropped connection                                           | No      |

A `moved` or `gone` that differs from the bookmark's raised flag is confirmed first: the job
retries itself after twelve hours and records the flag only when the second read agrees. `ok`
clears the flag; `blocked` and `flaky` leave it as it was, so an origin that times out between
two dead readings does not raise the same flag twice.

A flag is open while `reviewed_at` is older than `flagged_at`. The CMS list marks open flags,
and the edit page shows the outcome, the status and when it was read; for `moved` it links to
the form with the new URL filled in. Saving the form sets `reviewed_at`, and a changed URL
resets the row and enqueues an inspection and an archive. A dead bookmark kept after review
stays quiet until its outcome changes.

When the response is a healthy page and the bookmark still lacks a title or description, the
same inspection fills them and stamps `described_at`; a page that yields nothing is tried
again only after thirty days.

### Digest

`bookmarks.digest` runs daily and emails `hello@sergiodxa.com`, from
`bookmarks@support.sergiodxa.com`, every open flag whose `notified_at` is older than its
`flagged_at`: title, URL, outcome, status and a link to its CMS edit page. It stamps
`notified_at` on what it sent and sends nothing when nothing is new, so mail follows the weekly
sweep. The mail transport reaches the job through middleware, so a test installs its own.

### Archiving

`bookmarks.archive` asks the Wayback Machine for a capture through Save Page Now 2,
authenticated with the `BLOG_WAYBACK_ACCESS_KEY` and `BLOG_WAYBACK_SECRET_KEY` secrets, and
stores the capture's instant as `archived_at`. Between polls the job stores the capture job's
id in `archive_job` and retries itself after a minute; a `429` retries after five. The Wayback
link uses `archived_at` when it is set and falls back to `created_at`.

A bookmark created more than a week ago is first looked up in the Availability API at its own
date, and the closest existing capture is recorded without asking for a new one. The weekly
sweep enqueues an archive for every bookmark without `archived_at` whose last attempt is more
than thirty days old, which backfills the existing bookmarks on its first run.

### Display

| Surface              | Change                                                           |
| -------------------- | ---------------------------------------------------------------- |
| `/bookmarks`         | Description under the title                                      |
| RSS, Atom, JSON Feed | Summary is the description, then the URL on its own line         |
| Search               | Description indexed beside the address, and shown as the excerpt |
| MCP `list_bookmarks` | Carries the description                                          |
| `/`                  | Unchanged                                                        |

### Jobs And Schedules

| Job                 | Trigger                                  | Work                                     |
| ------------------- | ---------------------------------------- | ---------------------------------------- |
| `bookmarks.inspect` | Sweep, failed read on create, URL change | Classify, fill missing title/description |
| `bookmarks.archive` | Create, URL change, sweep backfill       | Save Page Now, or Availability lookup    |
| `bookmarks.sweep`   | `0 6 * * 1` (Mondays 06:00 UTC)          | Enqueue inspections and due archives     |
| `bookmarks.digest`  | `0 14 * * *` (daily 14:00 UTC)           | Email new flags                          |

## Consequences

### Positive

- **Paste and go** - a URL alone, from the CMS or the iOS share sheet, becomes a complete
  bookmark, and the edit page shows what was read before anything else is needed
- **No duplicates** - enforced by the database, so a double submit cannot create two
- **Dead links surface** - a moved or dead bookmark reaches the inbox and the CMS within a
  week, confirmed by a second read so a passing outage stays quiet
- **Durable fallback** - every new bookmark has a capture taken the day it was saved
- **Better search and feeds** - descriptions give search more to match and feed readers
  something to read before they click

### Negative

- **A slower create** - the create action waits on the bookmarked page, up to five seconds
- **Blind spots** - sites that block automated requests read as `blocked` and are never
  flagged, and a parked domain or a soft 404 answering `200` reads as `ok`
- **Two new secrets** - archiving needs archive.org keys in the secrets store before deploy
- **A large first digest** - the first sweep checks bookmarks saved as far back as 2020

### Neutral

- **Third-party text on the site** - descriptions are the publisher's own summary or the
  opening of their article, shown with a link back
- **About 270 requests a week** - plus one Save Page Now capture per new bookmark

## Implementation Plan

### Phase 1: `@sdxc/distill` excerpt

**Priority:** High

1. Add `excerpt` to `Distill.Article`, read in `distillFrom`
2. Tests over meta descriptions, the paragraph fallback and the word-boundary cut

### Phase 2: Titles, descriptions and quick add

**Priority:** High

1. Migration: `bookmarks` table, addresses for existing bookmarks, duplicates tombstoned
2. Page reader service, URL cleaning and the address normalizer
3. Create, update and `new?url=` in the CMS; quick add on `/cms` and `/cms/bookmarks`
4. CMS sign-in returning to the requested page
5. Description on `/bookmarks`, the feeds, search and MCP
6. Share-sheet shortcut recipe in the app README

### Phase 3: Link checks and digest

**Priority:** High

1. `bookmarks.inspect`, `bookmarks.sweep` and `bookmarks.digest` with their crons
2. Flag and review state in the CMS list and edit page
3. Mail transport middleware for jobs, and the digest email

### Phase 4: Wayback archiving

**Priority:** Medium

1. `bookmarks.archive` over Save Page Now 2 and the Availability API
2. Secrets in `wrangler.jsonc`, and the Wayback link reading `archived_at`

## Alternatives Considered

### 1. Filling The Title And Description In A Job After Create

**Rejected because**: the WebSub ping goes out with the create, so feed readers would store an
item with no title, and the edit page the create redirects to would show empty fields whose
save overwrites what the job found.

### 2. Indexing The Full Text Of Bookmarked Pages

**Rejected because**: search would answer with other people's articles for every topic the
blog's own posts cover, and show snippets of their text on the site's search page.

### 3. A Daily Sweep Over A Seventh Of The Bookmarks

**Rejected because**: weekly is frequent enough for bookmarks, and the twelve-hour
confirmation gives a failure its second read without a daily schedule.

### 4. A Web Share Target Or A Micropub Endpoint For Sharing

A PWA declaring `share_target` would join the share sheet, and a Micropub endpoint with a
token would let a shortcut save in the background.

**Rejected because**: iOS Safari does not support Web Share Target, and a token-authenticated
write endpoint is more surface than opening the CMS form needs today. Micropub remains the
follow-up if opening Safari becomes the bottleneck.

### 5. Checking Links With `HEAD`

**Rejected because**: servers answer `HEAD` inconsistently (`405`, or a different status than
`GET`), and the inspection needs the body to fill a missing description anyway.

## References

- [Save Page Now 2 Public API Docs](https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA/mobilebasic)
- [Wayback Availability API](https://archive.org/help/wayback_api.php)
- [WebKit bug 194593: Web Share Target](https://bugs.webkit.org/show_bug.cgi?id=194593)
- [ADR-004: Full-Text Search](./ADR-004-full-text-search.md)

## Current Progress

- [ ] Phase 1: `@sdxc/distill` excerpt
- [ ] Phase 2: Titles, descriptions and quick add
- [ ] Phase 3: Link checks and digest
- [ ] Phase 4: Wayback archiving

## Notes

- archive.org keys come from an account's S3 key page (`archive.org/account/s3.php`) and are
  stored with `bunx wrangler secrets-store secret create <store-id> --name <NAME> --scopes workers --remote`
- Save Page Now allows 12 concurrent captures per authenticated account; the archive job
  retries a `429`, so the backfill drains at the pace the archive accepts
