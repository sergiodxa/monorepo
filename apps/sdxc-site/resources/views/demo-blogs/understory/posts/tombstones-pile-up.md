---
title: Tombstones pile up quietly
description: Deleted records are still records, until every replica agrees they can go.
kind: notes
date: "2026-07-09"
tags: [crdts, sync]
---

Looked at a long-lived test account today: 4,000 live notes and 61,000 [tombstones](/showcase/understory/demo/glossary/tombstone). Every delete is kept so an offline replica cannot resurrect the record, and nothing was ever collecting them. The fix is boring: the server tracks the oldest summary each replica has sent, and drops tombstones older than all of them. Replicas silent for ninety days do a full resync instead.
