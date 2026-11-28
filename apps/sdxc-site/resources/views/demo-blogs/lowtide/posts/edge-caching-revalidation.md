---
title: "Edge caching from scratch: revalidation"
description: Part two. Serve from the cache while it refreshes in the background, so readers get speed and editors get freshness.
kind: tutorials
date: "2026-10-17"
tags: [caching, http]
series: Edge caching from scratch
part: 2
---

Part one made pages cacheable for an hour. That is fast, but an edit takes an hour to show. This part closes that gap without giving the speed back.

## Step 1: Add an ETag

An `ETag` lets a cache ask the origin "is this still the same?" and get a tiny `304 Not Modified` instead of the whole page.

```ts {% title="server.ts" %}
let tag = `"${await digest(html)}"`;
if (request.headers.get("If-None-Match") === tag) return new Response(null, { status: 304 });
response.headers.set("ETag", tag);
```

## Step 2: Serve stale while refreshing

[Stale-while-revalidate](/showcase/lowtide/demo/glossary/stale-while-revalidate) tells the cache it may keep serving the old copy for a while after it expires, as long as it fetches a new one in the background.

```ts {% title="server.ts" %}
response.headers.set(
	"Cache-Control",
	"public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
);
```

Now the edge copy is fresh for five minutes, and for a day after that readers still get an instant answer while the edge quietly checks for a new version.

## Step 3: Watch a revalidation happen

Wait past `s-maxage`, then request twice. The first answer is stale and instant; the second is the refreshed copy.

> [!TIP]
> Keep an eye on the origin's logs during this step. You should see one request with `If-None-Match` per expiry, not one per reader.

[Part three](/showcase/lowtide/demo/tutorials/edge-caching-purging) makes publishing instant with purges.
