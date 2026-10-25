---
title: Install and pin
description: How each package installs by its own name, how to pin every package in a project at one release, and where the record of a release is kept.
section:
    title: Packages à la carte
    order: 1.5
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "How to install a package by its own name beside `remix`"
    - "How to pin every `@sdxc` package in a project at one release"
    - "Where to read what changed before a pin moves"
---

Each `@sdxc` package installs on its own, so you add only the ones your code imports and pin
each at one release. This page covers the install line, how to pin packages that carry
different dates, and where to read what changed before you move a pin.

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

## Keep every package at one release

A release republishes only the packages that changed that day, together with every package that
depends on one of them, so the packages in a project carry different dates. A package's version
_at a release_ is its newest version published on or before that release's date, and that is
the version to pin. On the `2026.10.24` release, `@sdxc/markdown` changed and `@sdxc/result` had
not changed since `2026.10.13`:

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/markdown": "2026.10.24",
		"@sdxc/result": "2026.10.13",
		"remix": "3.1.0"
	}
}
```

When a package installs a sibling from this collection, it pins that dependency exactly, at the
sibling's version at the same release. Pinning every package at one release therefore gives you
one copy of each, and `remix` at the version those packages name as their peer.

<warning>
Pins from different releases duplicate a shared dependency: an `@sdxc/spec` and an `@sdxc/jwt`
built against different versions of `@sdxc/duration` install two copies of it, and context keys
and `instanceof` checks stop matching between the copies. `sdxc upgrade <release>` moves every
pin to its version at one release, and in a project made with `sdxc create`, `sdxc doctor`
reports a package pinned behind the others.
</warning>

Three packages run at build or test time: [`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks),
[`@sdxc/jsdoc`](/api/jsdoc) and [`@sdxc/spec`](/api/spec). Install them as dev dependencies,
at the same release as the rest.

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
- [Upgrade](/docs/sdxc/upgrade) — move every pin to a newer release in one step.
