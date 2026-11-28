---
title: MVCC
description: Multiversion concurrency control keeps several versions of a row so readers see a consistent snapshot without blocking writers.
kind: glossary
date: "2026-10-28"
tags: [postgres]
---

In Postgres, an `UPDATE` does not change a row in place. It writes a new version and marks the old one as dead for transactions that start afterwards. Each transaction reads the versions that were committed when its snapshot was taken, so a long report never blocks the writes happening beside it.

The cost is cleanup: dead versions stay on disk until vacuum removes them. That is why a table with heavy updates and a stalled autovacuum keeps growing, a story the [vacuuming docs](/showcase/saltbox/demo/links/postgres-routine-vacuuming) tell well.
