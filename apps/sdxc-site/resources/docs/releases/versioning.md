---
title: Versioning
description: Releases are dated rather than semantic, the number records when a release went out, and that is why a dependency is written as one exact date.
section:
    title: Releases
    order: 10
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "What a dated version like `2026.9.4` tells you"
    - "Why a dependency is written as one exact date"
    - "Where to read what changed in a release"
---

Releases here are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D` with the month and day as plain integers, so a release published on 4
September 2026 is `2026.9.4`. At most one release goes out per day, and it publishes only the
packages that changed since the previous one, together with their dependents, all carrying that
day's number.

## The number says when

A version records when a release went out. Read it as a date and nothing else: a later date
means a later release, and carries no compatibility promise at all. Any release may change or
remove an export.

## Depend on one exact date

Write the version you built and tested against, exactly as it was published, such as
`"@sdxc/markdown": "2026.10.24"`. An exact pin keeps the upgrade yours to schedule: move it when you are ready to read what
changed and take it. [Install and pin](/docs/getting-started/install-and-pin) covers keeping
every package at one release.

## Why a range is the wrong tool

A caret or tilde range reads the date as major, minor and patch, so `^2026.10.24` accepts
`2026.12.31` and every other later release that year, breaking changes included. The date you
pin is the one you trust.

## Read what changed

Each day's release is published as one set of notes, grouped by package, and the
[Changelog](/docs/releases/changelog) shows every release. An entry is one change: a sentence
that says what changed for you, then a note on how to use it, whether you need to act, or, for a
breaking change marked **Breaking:**, every migration step. [`sdxc upgrade`](/docs/sdxc/upgrade)
reads the same notes when it moves your pins and hands them to an AI agent.

## Where to go next

- [Install and pin](/docs/getting-started/install-and-pin) — keep every `@sdxc` package in a
  project at one release.
- [Upgrade](/docs/sdxc/upgrade) — move your pins to a newer date with a prompt that lists what
  changed.
- [Breaking changes](/docs/releases/breaking-changes) — find and apply every migration between
  the release you pin and the one you take.
