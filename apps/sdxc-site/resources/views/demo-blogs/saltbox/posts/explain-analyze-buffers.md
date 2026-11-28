---
title: EXPLAIN with BUFFERS, every time
description: Timing tells you a query is slow; buffers tell you why.
kind: notes
date: "2026-02-18"
tags: [postgres, observability]
---

My psql habit is now `explain (analyze, buffers)` and never plain `explain analyze`. The buffer counts show how many pages each node read from shared memory (`hit`) versus from disk or the OS cache (`read`). A query that is fast on the second run and slow on the first is cold cache, not a bad plan, and only the buffers line says so. Since Postgres 18 `analyze` includes buffers by default, but I still type it out for older servers.
