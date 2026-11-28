---
title: Tombstone
description: A marker kept in place of a deleted record, so replicas that have not yet seen the delete cannot bring the record back.
kind: glossary
date: "2026-07-09"
tags: [crdts, sync]
---

Without tombstones, a replica that was offline during a delete would sync its old copy back and resurrect the record. Tombstones can only be removed once every replica has seen the delete, which takes coordination, usually by the server tracking how far each replica has synced.
