---
title: Versioning
description: Releases are dated rather than semantic, the number records when a release went out, and that is why a dependency is written as one exact date.
section:
    title: Releases
    order: 9
order: 1
lastUpdated: 2026-09-21
---

Releases here are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D` with the month and day as plain integers, so a release published on 4
September 2026 is `2026.9.4`. At most one release goes out per day, and every package published
that day carries the same number, so versions across the scope line up by day.

## The number says when

A version records when a release went out. Read it as a date and nothing else: a later date
means a later release, and carries no compatibility promise at all. Any release may change or
remove an export.

## Depend on one exact date

Write the version you built and tested against, exactly as it was published:

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/result": "2026.9.21"
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
