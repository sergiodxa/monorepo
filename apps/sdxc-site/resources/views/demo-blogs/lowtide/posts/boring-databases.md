---
title: In praise of boring databases
description: The storage under a cache should be the least interesting part of the system. SQLite and Postgres have earned that by being dull for decades.
kind: articles
date: "2025-12-02"
tags: [databases]
---

Every system I have run has had one component I never wanted to think about. The best ones were the database.

## Boring is a feature

A boring database has been used by so many people for so long that its failure modes are documented, its tooling is everywhere and its behaviour under load is a solved problem. Novelty is a cost you pay in incidents.

## Where the excitement belongs

Put the clever parts where they are cheap to change: the cache in front, the rendering, the routing. Keep the source of truth somewhere a backup restores the same way it did ten years ago.
