---
title: Maintenance
description: What support a dated release carries, which is the question its number raises.
lastUpdated: 2026-09-21
---

A version here is a date — `YYYY.M.D`, the UTC day it was published — and a date is not a
compatibility claim. So the question a version number usually answers, "how long is this
supported for", is answered here instead.

## What a dated release carries

The release you pinned keeps working exactly as it was published. npm holds it, its
dependencies are pinned to exact dates inside it, and nothing published later changes it.

What it does not carry is a promise about the next one. Any release may change or remove
an export, and the number will not tell you: a later date means a later release and
nothing more.

## There are no supported versions

There is one line of releases, published from `main`.

- No long-term-support branch, and no version that is "the stable one".
- No backports. A fix goes out on the next release date and is never republished onto an
  earlier one.
- No deprecation window guaranteed ahead of a removal.

So "supported" describes exactly one release at a time: the most recent. Everything before
it is published, immutable and unchanged — which is a real thing to depend on, and not the
same as being maintained.

## Pin exactly, move when ready

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/result": "2026.9.21"
	}
}
```

An exact pin is the whole strategy. It keeps the upgrade yours to schedule: read
[what shipped](/docs/releases/changelog), take the date when you have time to read it, and
run your tests against it.

<note kind="caution">
A range such as `^2026.9.21` reads the date as major, minor and patch, and accepts every
later release in the same year — asking for a promise the version was never making.
</note>

## Documentation describes `main`

There is no versioned documentation, for the same reason: "the docs for `2026.9.4`" would
describe a release that carries no compatibility relationship to the one before or after
it. These pages describe what is on `main`, which is what the next release will be built
from. To read a package exactly as you have it installed, read the `README.md` inside the
version you pinned.

## Related

- [Versioning](/docs/releases/versioning) — how the number is assigned, and why a range is
  the wrong tool.
- [Changelog](/docs/releases/changelog) — every release, with the notes it went out with.
- [Security](/security) — which releases get fixes, and how to report something privately.
