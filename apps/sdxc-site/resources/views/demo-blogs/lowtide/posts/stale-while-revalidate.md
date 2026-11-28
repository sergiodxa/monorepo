---
title: Stale-while-revalidate
description: A Cache-Control directive that lets a cache serve an expired response while it fetches a fresh one in the background.
kind: glossary
date: "2026-10-16"
tags: [caching, http]
---

Written as `stale-while-revalidate=<seconds>` in `Cache-Control`. Once a response expires, a cache may keep serving it for that many seconds, as long as it starts a background request to refresh it. The visitor gets an instant answer; the next visitor gets the fresh one.

It turns most cache misses into hits that happen to be a few seconds old, which is the right trade for almost every content page.
