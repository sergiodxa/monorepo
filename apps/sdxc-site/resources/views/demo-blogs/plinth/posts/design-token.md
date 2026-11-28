---
title: Design token
description: A named design decision, such as a colour, size or duration, stored once in a format both design tools and code read, so every product uses the same value by the same name.
kind: glossary
date: "2026-08-05"
tags: [tokens]
---

A token separates the name of a decision from its value. Code asks for `--text-muted` and gets whatever the system currently means by muted text, in the current theme. When the value changes, nothing that reads the name has to.

Tokens usually come in tiers: primitives that hold raw values, semantic tokens that name a job, and occasionally component tokens for one component's knobs. Why that split matters is the subject of [Tokens are an API, not a palette](/showcase/plinth/demo/articles/tokens-are-an-api).
