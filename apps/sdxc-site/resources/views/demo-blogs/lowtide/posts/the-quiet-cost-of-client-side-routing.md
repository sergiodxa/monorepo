---
title: The quiet cost of client-side routing
description: A router in the browser makes the second page fast and the first page slow. Measured on three real sites, the trade rarely pays for content.
kind: articles
date: "2026-09-30"
tags: [performance, http]
---

Client-side routing promises that once the application has loaded, moving between pages is instant. That promise is real. What is less discussed is what it costs to get there, and who pays.

## Who pays for the first page

The router, the framework under it and the code for every route a visitor might take have to arrive before the first click works. On a fast laptop that is invisible. On a mid-range phone on a train, it is the difference between reading and waiting.

I measured three content sites before and after they moved from server-rendered pages to a single-page application. The second page view got faster on all three, by about 300 milliseconds. The first page view got slower on all three, by between 0.9 and 2.4 seconds on a throttled phone.

## Most visits are one page long

For a blog or a documentation site, most visitors arrive from search or a shared link, read one page, and leave. On the three sites, between 61 and 78 percent of sessions had exactly one page view. Those visitors paid the full price of the router and never used it.

## What I use instead

Server-rendered pages, cached at the edge, with links that prefetch on hover. The first page is as fast as the network allows, and the second is nearly as fast as a client-side transition, without shipping a router to people who will never click.

> [!NOTE]
> This is about content. An application people sit in for an hour, like an email client, earns its router back many times over.
