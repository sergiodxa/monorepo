---
title: Install and pin
description: How a package arrives, what it installs alongside itself, and where the record of a release is kept.
section:
    title: Getting started
    order: 1
order: 2
lastUpdated: 2026-09-21
---

Install any package by name:

```bash
npm add @sdxc/result
```

The version you get looks like a date, because it is one: a release is named for the day it was
published. Write that date into your manifest exactly rather than as a range —
[Versioning](/docs/releases/versioning) covers the scheme and what an exact pin buys you.

## What a package brings with it

When a package installs a sibling from this collection, that dependency is pinned exactly too,
at the version it was built and tested with. This is also why a release day tends to publish
more than the packages that changed: a dependent republishes so its pin can move.

The practical consequence is that mixing release dates can duplicate a shared dependency.
Installing `@sdxc/spec@2026.9.4` beside `@sdxc/jwt@2026.9.1` yields two copies of
`@sdxc/duration` when their pins differ; moving both to the same day collapses them.

## Finding out what changed

There are no changelog files. The day's release is recorded as a git tag, `v2026.9.4`, and a
GitHub Release whose notes are the commits that went into it, with a compare link to the
previous release. That is the whole record, and it is the thing to read before a pin moves.
