---
title: Install and pin
description: How each package installs by its own name, why every package in a project shares one release date, and where the record of a release is kept.
section:
    title: Packages à la carte
    order: 1.5
order: 1
lastUpdated: 2026-10-19
outcomes:
    - "How to install a package by its own name beside `remix`"
    - "Why every `@sdxc` package in a project shares one release date"
    - "Where to read what changed before a pin moves"
---

Each `@sdxc` package installs on its own, so you add only the ones your code imports and pin
them to one release date. This page covers the install line, why every package in a project
shares one date, and where to read what changed before you move it.

Install the packages your code imports, each by the name its [API page](/api) shows, beside the
`remix` your app already uses:

```bash
npm add @sdxc/markdown @sdxc/result remix
```

Every guide opens with the install line for the packages its code imports. A package that runs
inside a Remix app lists `remix` as a peer: your app installs it once, and every package reads
that same copy. A bundle carries only the subpaths it imports, such as `@sdxc/markdown/html`.

The version you get looks like a date, because it is one: a release is named for the day it was
published. Write that date into your manifest exactly rather than as a range —
[Versioning](/docs/releases/versioning) covers the scheme and what an exact pin buys you.

## Keep every package on one date

When a package installs a sibling from this collection, that dependency is pinned exactly too,
at the version it was built and tested with. This is also why a release day tends to publish
more than the packages that changed: a dependent republishes so its pin can move.

So pin every `@sdxc` package in a project to the same date and move them together:

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/markdown": "2026.9.21",
		"@sdxc/result": "2026.9.21",
		"remix": "3.0.0"
	}
}
```

<warning>
Mixed dates duplicate a shared dependency: `@sdxc/spec@2026.9.4` beside `@sdxc/jwt@2026.9.1`
yields two copies of `@sdxc/duration` when their pins differ, and context keys and `instanceof`
checks stop matching between the copies. Moving both to the same day collapses them. In a
project made with `sdxc create`, `sdxc doctor` reports packages that sit on more than one date.
</warning>

Three packages run at build or test time: [`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks),
[`@sdxc/jsdoc`](/api/jsdoc) and [`@sdxc/spec`](/api/spec). Install them as dev dependencies,
on the same date as the rest.

The `sdxc` command, installed globally from `@sdxc/kit`, starts a project from a template and
writes controllers, jobs and models where the app layout puts them.
[The sdxc command](/docs/getting-started/the-sdxc-command) covers it.

## Read what changed before a pin moves

There are no changelog files. The day's release is recorded as a git tag, `v2026.9.4`, and a
GitHub Release whose notes are the commits that went into it, with a compare link to the
previous release. That is the whole record, and it is the thing to read before a pin moves.

## Where to go next

- [Versioning](/docs/releases/versioning) — what a dated version promises, and why a range is
  the wrong tool for it.
- [Your first handler](/docs/getting-started/your-first-handler) — put the packages you just
  installed to work.
- [Upgrade](/docs/sdxc/upgrade) — move every pin to a newer date in one step.
