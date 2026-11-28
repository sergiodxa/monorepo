---
title: Automerge
description: A CRDT library for JSON-like documents, with sync and storage built in. The fastest way to feel what a CRDT does.
kind: links
date: "2026-04-14"
tags: [crdts, sync]
url: https://automerge.org
---

When I want to show someone a merge that "just works", I reach for this. You change a plain object on two replicas, exchange sync messages and both end up with the same document, text edits interleaved. I still roll my own for apps whose data is mostly rows, but this is where I learned what the result should feel like.
