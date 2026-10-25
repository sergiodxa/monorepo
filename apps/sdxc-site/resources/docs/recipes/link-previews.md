---
title: Show link previews
description: Turn a URL someone pastes into a card with its title, description and image, fetched safely in a job and cached per URL.
section:
    title: Recipes
    order: 1.7
order: 15
lastUpdated: 2026-10-25
outcomes:
    - "What guides build link previews, and in what order to follow them"
    - "How to cache a preview card per URL so each page is fetched once"
    - "When a pasted URL is refused before it is stored"
---

By the end of this recipe a URL pasted into a comment shows a card with the page's title,
description and image. The URL is refused before it is stored when it points into a private
network, the page is read in a job under a deadline and a byte cap, and each URL's card is
cached, so a link a hundred people paste is fetched once.

## Refuse the URL where it arrives

A URL a stranger chose can point at your own network, so check it in the endpoint that accepts
the comment and store it only when it passes. Follow
[Refuse the URL at the endpoint](/docs/identity-and-security/fetch-untrusted-urls#refuse-the-url-at-the-endpoint),
passing `checkUrl` the `literals: "refuse"` the card's fetch uses, and enqueue a job for the card
as that endpoint does.

## Read the card in a job

The job fetches the page and reads its head. Build `previewOf` from
[Build a preview card from the head](/docs/content-and-feeds/read-web-pages#build-a-preview-card-from-the-head);
it re-checks every redirect and answers `null` for any page without a card.

## Cache the card per URL

Build `requestCache()` as
[Open a cache for each request](/docs/data-and-background-work/cache-on-workers#open-a-cache-for-each-request)
shows, and read the card through it in the job with
``cache.fetch(`preview:${url}`, () => previewOf(url), { ttl: "1 day" })``, so only the first
paste of a URL sends a request. A page without a card is cached as `null` too, so it is not
fetched again for a day. Store the card on the comment.

## Test it

Test each stage as its guide does:
[Test the extraction](/docs/content-and-feeds/read-web-pages#test-the-extraction) reads a page
fixture without the network, and
[Test both layers without a platform](/docs/data-and-background-work/cache-on-workers#test-both-layers-without-a-platform)
stands `MemoryCache` in for KV.

## Where to go next

- [Read other people's pages](/docs/content-and-feeds/read-web-pages) — keep the whole
  article and an excerpt, beyond the card.
- [Retry on a growing delay](/docs/data-and-background-work/retry-with-backoff) — retry a
  page that timed out without hammering it.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — limit where the
  card's image may load from.
