---
title: Install and pin
description: How the packages arrive through sdxc or one at a time, and where the record of a release is kept.
section:
    title: Getting started
    order: 1
order: 2
lastUpdated: 2026-10-15
---

Install the whole collection as one package, beside the `remix` your app already uses:

```bash
npm add sdxc remix
```

Every package is then imported through its own subpath of `sdxc`, so `@sdxc/result` is
`sdxc/result` and `@sdxc/markdown/html` is `sdxc/markdown/html`. A bundle carries only the
subpaths it imports, however many packages arrived with the install.

The version you get looks like a date, because it is one: a release is named for the day it was
published. Write that date into your manifest exactly rather than as a range —
[Versioning](/docs/releases/versioning) covers the scheme and what an exact pin buys you.

## What `sdxc` brings with it

`sdxc` pins every package at the version it was built and tested with, so one date moves the
whole set and no package ever arrives twice. `remix` is a peer: your app installs it once, and
every package reads that same copy.

The `sdxc` command, installed globally from `@sdxc/kit`, starts a project from a template,
writes controllers, jobs and models where the app layout puts them, and moves a project to a
newer release with a prompt for your agent.
[The sdxc command](/docs/getting-started/the-sdxc-command) covers it.

Three packages stay outside `sdxc` because they run at build or test time:
[`@sdxc/cloudflare-mocks`](/api/cloudflare-mocks), [`@sdxc/jsdoc`](/api/jsdoc) and
[`@sdxc/spec`](/api/spec). Install them by name as dev dependencies.

## Augment a package by its own name

A `declare module` block merges into the module that declares the interface, and `sdxc/jobs`
re-exports what `@sdxc/jobs` declares. So the block names the package itself while every import
beside it goes through `sdxc`:

```typescript {% title="app/jobs/types.ts" %}
import type { JobDispatcherContext } from "sdxc/jobs";

import type { dispatcher } from "~/app/initializers/dispatcher";

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}
```

The same holds for a theme: a new color or radius name merges into `@sdxc/u`.

## One package at a time

Every package is also published on its own, under the name its [API page](/api) shows:

```bash
npm add @sdxc/result
```

Pick one way per project. A package installed both on its own and through `sdxc` is two
instances, and their context keys and `instanceof` checks stop matching between them. A
package installed on its own pins its siblings exactly too, so mixing release dates duplicates a
shared dependency: `@sdxc/spec@2026.9.4` beside `@sdxc/jwt@2026.9.1` yields two copies of
`@sdxc/duration` when their pins differ.

## Finding out what changed

There are no changelog files. The day's release is recorded as a git tag, `v2026.9.4`, and a
GitHub Release whose notes are the commits that went into it, with a compare link to the
previous release. That is the whole record, and it is the thing to read before a pin moves.
`sdxc upgrade` reads the same record for you: it moves the pin and prints the entries that touch
the packages your code imports, as a prompt for an AI agent to apply.
