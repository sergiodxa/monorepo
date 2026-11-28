---
title: "Edge caching from scratch: the headers"
description: Part one. Start with an uncached origin and make it cacheable at the edge with nothing but Cache-Control, then prove it with two requests.
kind: tutorials
date: "2026-10-03"
tags: [caching, http, edge]
series: Edge caching from scratch
part: 1
---

In this series we take a small origin that caches nothing and put a CDN in front of it, one header at a time. By the end of part three it serves most requests without touching the origin, stays fresh, and can be purged on publish.

You need a server you can change the headers of and a CDN in front of it. Any will do; the headers are the same everywhere.

## Step 1: Look at what you send today

Request a page and read the response headers before changing anything.

```bash
curl -sI https://origin.example/articles/hello
```

If you see `Cache-Control: private` or no `Cache-Control` at all, the CDN is passing every request through. That is our starting point.

## Step 2: Let shared caches store the page

`s-maxage` is the lifetime for shared caches like a CDN; `max-age` is for the browser. Keep the browser short and the edge longer, so you can still change a page and have readers see it soon.

```ts {% title="server.ts" %}
response.headers.set("Cache-Control", "public, max-age=60, s-maxage=3600");
```

## Step 3: Prove it with two requests

Request the page twice and compare the CDN's status header. The first should be a miss and the second a hit.

```bash
curl -sI https://www.example/articles/hello | grep -i cache-status
curl -sI https://www.example/articles/hello | grep -i cache-status
```

> [!NOTE]
> Each CDN names this header differently: `CF-Cache-Status`, `X-Cache`, `Cache-Status`. The value you want on the second request is a hit.

In [part two](/showcase/lowtide/demo/tutorials/edge-caching-revalidation) we stop serving stale pages for an hour after every edit.
