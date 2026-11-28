---
title: Backlinks are a query, not a feature
description: Store links as rows and "linked from" comes for free.
kind: notes
date: "2026-03-03"
tags: [tools-for-thought, sqlite]
---

Added backlinks to my notes tool this weekend and it took twenty minutes, because links were already rows: `source`, `target`, `created`. "Linked from" is `SELECT source FROM links WHERE target = ?`. The expensive part was always parsing links out of text on every save, and that was already done for search. Every page on this site shows its backlinks the same way.
