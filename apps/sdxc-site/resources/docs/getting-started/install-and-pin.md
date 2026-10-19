---
title: Install and pin
description: How each package installs by its own name, why every package in a project shares one release date, and where the record of a release is kept.
section:
    title: Packages à la carte
    order: 1.5
order: 1
lastUpdated: 2026-10-15
outcomes:
    - "How to install a package by its own name beside `remix`"
    - "Why every `@sdxc` package in a project shares one release date"
    - "Where to read what changed before a pin moves"
---

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

So pin every `@sdxc` package in a project to the same date and move them together. Mixed dates
duplicate a shared dependency: `@sdxc/spec@2026.9.4` beside `@sdxc/jwt@2026.9.1` yields two
copies of `@sdxc/duration` when their pins differ, and their context keys and `instanceof`
checks stop matching between the copies. Moving both to the same day collapses them.

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/markdown": "2026.9.21",
		"@sdxc/result": "2026.9.21",
		"remix": "3.0.0"
	}
}
```

Three packages run at build or test time: [`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks),
[`@sdxc/jsdoc`](/api/jsdoc) and [`@sdxc/spec`](/api/spec). Install them as dev dependencies,
on the same date as the rest.

The `sdxc` command, installed globally from `@sdxc/kit`, starts a project from a template and
writes controllers, jobs and models where the app layout puts them.
[The sdxc command](/docs/getting-started/the-sdxc-command) covers it.

## Finding out what changed

There are no changelog files. The day's release is recorded as a git tag, `v2026.9.4`, and a
GitHub Release whose notes are the commits that went into it, with a compare link to the
previous release. That is the whole record, and it is the thing to read before a pin moves.
