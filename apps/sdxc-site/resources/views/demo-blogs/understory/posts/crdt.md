---
title: CRDT
description: A conflict-free replicated data type, a data structure whose replicas can be changed independently and always converge to the same value once they have seen the same changes.
kind: glossary
date: "2025-10-15"
updated: "2026-06-18"
tags: [crdts, sync]
---

The guarantee comes from the merge: it is commutative, associative and idempotent, so the order and repetition of changes does not matter. Last-writer-wins registers, grow-only counters, observed-remove sets and sequence types for collaborative text are all CRDTs.

A CRDT decides _how_ replicas agree, not _what_ a person meant. Which type each field uses is still a design choice, which I argue in [Conflicts are a product decision](/showcase/understory/demo/articles/conflicts-are-a-product-decision).
