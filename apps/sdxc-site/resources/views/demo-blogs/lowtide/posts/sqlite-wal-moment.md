---
title: The WAL moment
description: One pragma, and readers stopped waiting for writers.
kind: notes
date: "2026-03-11"
tags: [databases, performance]
---

Turned on `PRAGMA journal_mode = WAL` on a small SQLite-backed service. Readers no longer block on the writer, and p99 latency on the read path dropped from 140 ms to 9 ms. I keep relearning that the boring fix is usually one line in the docs I skimmed.
