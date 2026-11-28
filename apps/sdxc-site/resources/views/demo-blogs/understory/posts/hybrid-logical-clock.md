---
title: Hybrid logical clock
description: A timestamp made of wall time plus a counter, which stays close to real time yet orders events consistently across machines whose clocks disagree.
kind: glossary
date: "2026-08-26"
tags: [sync]
---

Each reading is the larger of the local wall time and the newest time seen from a peer, with a counter that breaks ties within the same millisecond. Encoded as padded text, readings sort correctly as strings, which makes them convenient keys in a change log. The [Sync from scratch](/showcase/understory/demo/tutorials/sync-from-scratch-hybrid-clocks) series builds one in thirty lines.
