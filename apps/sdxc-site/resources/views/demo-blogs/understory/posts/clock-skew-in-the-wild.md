---
title: A phone that thought it was 2031
description: Real clock skew is weirder than the textbook kind.
kind: notes
date: "2025-12-12"
tags: [sync]
---

A user's phone had its date set to 2031 to cheat at a game. Every edit it made won every conflict for five years. This is why our [hybrid clocks](/showcase/understory/demo/glossary/hybrid-logical-clock) refuse a remote reading more than five minutes ahead of the server's own time: the change is accepted, but stamped with the server's clock, and the phone is told to fix its date.
