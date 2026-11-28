---
title: "Edge caching from scratch: purging on publish"
description: Part three. Tag every response with what it shows, then purge by tag the moment an editor hits publish.
kind: tutorials
date: "2026-10-31"
tags: [caching, edge]
series: Edge caching from scratch
part: 3
---

Revalidation keeps pages fresh within minutes. Purging makes them fresh within a second, which is what an editor fixing a typo expects.

## Step 1: Tag responses with what they show

A [surrogate key](/showcase/lowtide/demo/glossary/surrogate-key) names the content a response contains. An article page shows the article and its author, so it carries both.

```ts {% title="server.ts" %}
response.headers.set("Cache-Tag", `article:${article.id} author:${article.authorId}`);
```

## Step 2: Purge by tag on publish

When the article changes, purge its tag. Every page that showed it, including the home and the author's page, is dropped at once.

```ts {% title="publish.ts" %}
await fetch(`${CDN_API}/purge`, {
	method: "POST",
	headers: { Authorization: `Bearer ${token}` },
	body: JSON.stringify({ tags: [`article:${article.id}`] }),
});
```

## Step 3: Keep revalidation as the safety net

Purges can fail: a network blip, an expired token. Leave the `stale-while-revalidate` headers from part two in place, so a missed purge costs minutes rather than a day.

That is the whole series: cacheable headers, background revalidation, and purges on publish. Together they serve almost every request from the edge while editors never wait.
