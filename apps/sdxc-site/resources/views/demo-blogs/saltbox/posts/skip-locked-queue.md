---
title: SKIP LOCKED makes a fine job queue
description: Postgres can hand out jobs to competing workers without a broker.
kind: notes
date: "2026-10-14"
tags: [postgres, concurrency]
---

Replaced a Redis queue with one table and one query: `select id from jobs where run_at <= now() order by run_at limit 10 for update skip locked`. Each worker locks the rows it takes, and the others skip past them instead of waiting. Inside the same transaction the worker does the job and deletes the row, so a crash simply releases the lock. At a few hundred jobs a minute, Postgres does not notice, and I have one less service to back up.
