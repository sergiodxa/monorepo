---
title: Write-ahead log
description: An append-only record of every change, written and flushed before the change reaches the data files, so a crash can be replayed instead of corrupting them.
kind: glossary
date: "2026-06-17"
tags: [postgres, backups]
---

Postgres calls it the WAL. A commit is durable once its WAL record is on disk; the table pages can be written later, and after a crash the server replays the log from the last checkpoint.

The same stream powers replication and point-in-time recovery: ship WAL segments somewhere safe alongside a base backup, and you can restore to any moment between them, not just to last night's dump.
