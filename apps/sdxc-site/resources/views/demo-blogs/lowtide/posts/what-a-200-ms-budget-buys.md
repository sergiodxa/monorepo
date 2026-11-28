---
title: What a 200 ms budget buys
description: If the page must start rendering within 200 milliseconds of the request, here is how I spend that budget, line by line.
kind: articles
date: "2026-07-08"
tags: [performance, edge]
---

A budget turns "make it fast" into a decision you can make. Mine for a content page is 200 milliseconds from the request leaving the browser to the first byte of HTML arriving, measured from the median visitor.

## The fixed costs

The connection is the first spend: DNS, TCP and TLS. Over a warm connection that is close to zero, but a first visit on a phone pays 60 to 120 milliseconds before a single header is sent. A CDN close to the visitor is the only real lever here.

## What is left for the origin

After the connection, a cache hit at the edge costs a few milliseconds. A miss has to travel to the origin and back, and whatever the origin does in between. If the origin is 80 milliseconds away and spends 40 rendering, a miss has already used most of the budget.

## Spending it well

That arithmetic is why I care more about [time to first byte](/showcase/lowtide/demo/glossary/ttfb) on misses than on hits. Hits are cheap everywhere. Misses are where a budget is won or lost, so they get the attention: fewer database round trips, rendering that streams the head before the body, and [stale-while-revalidate](/showcase/lowtide/demo/glossary/stale-while-revalidate) so most visitors never see a miss at all.
