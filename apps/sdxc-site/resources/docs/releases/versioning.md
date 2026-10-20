---
title: Versioning
description: Releases are dated rather than semantic, the number records when a release went out, and that is why a dependency is written as one exact date.
section:
    title: Releases
    order: 10
order: 1
lastUpdated: 2026-10-19
outcomes:
    - "What a dated version like `2026.9.4` tells you"
    - "Why a dependency is written as one exact date"
    - "Where to read what changed in a release"
---

Releases here are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D` with the month and day as plain integers, so a release published on 4
September 2026 is `2026.9.4`. At most one release goes out per day, and every package published
that day carries the same number, so versions across the scope line up by day. This page covers
what that number tells you, how to write it into a manifest, and where to read what changed
before you move to a newer date.

## The number says when

A version records when a release went out. Read it as a date and nothing else: a later date
means a later release, and carries no compatibility promise at all. Any release may change or
remove an export.

## Depend on one exact date

Write the version you built and tested against, exactly as it was published:

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/markdown": "2026.9.21",
		"@sdxc/result": "2026.9.21",
		"remix": "3.0.0"
	}
}
```

An exact pin keeps the upgrade yours to schedule: move it when you are ready to read what
changed and take it.

## Why a range is the wrong tool

A caret or tilde range reads the date as major, minor and patch. `^2026.9.21` therefore accepts
`2026.12.31` — every later release in the same year — over a scheme where the number carries no
compatibility meaning for that acceptance to rest on. A range is asking for a promise the
version was never making; the date you pin is the one you trust.

## Read what changed

Each day's release is published as one set of notes, grouped by package, and the Changelog
page beside this one shows every release. An entry is one change, headed by a
sentence that says what changed for you, such as "Add ES512 signing keys", and followed by its
release note: a new feature says how to use it with a short example, a fix states the behavior
before and after and whether you need to act, and a breaking change lists every migration step
with the code before and after. Breaking changes lead each package's section, marked
**Breaking:**.

The same notes are what [`sdxc upgrade`](/docs/sdxc/upgrade) reads when it moves your pins to a
newer date, so the prompt it hands an AI agent carries every change between the release you
have and the one you take.

## Where to go next

- [Install and pin](/docs/getting-started/install-and-pin) — keep every `@sdxc` package in a
  project on one date.
- [Upgrade](/docs/sdxc/upgrade) — move your pins to a newer date with a prompt that lists what
  changed.
- [Check a project](/docs/sdxc/check-a-project) — catch packages that drifted onto different
  dates.
