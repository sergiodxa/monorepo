---
title: Maintenance
description: What support a dated release carries, which is the question its number raises.
---

<hero>
<split lean="copy">
<split-copy>

# Maintenance

A version here is a date — `YYYY.M.D`, the UTC day it was published — and a date is not a
compatibility claim. So the question a version number usually answers, "how long is this
supported for", is answered here instead.

<actions cta-href="/docs/releases/changelog" cta-label="Read what shipped" alt-href="/docs/releases/versioning" alt-label="How versioning works" />

<fine-print>Last updated 21 September 2026.</fine-print>

</split-copy>
<split-media>

```text {% title="@sdxc/result on npm" %}
2026.9.4     unchanged
2026.9.17    unchanged
2026.9.21    unchanged
2026.10.30   most recent
```

</split-media>
</split>
</hero>

<section-block id="what-a-dated-release-carries" eyebrow="Releases" title="What a dated release carries">

<feature-grid columns="2">
<feature title="It keeps working as published" icon="archive">
The release you pinned keeps working exactly as it was published. npm holds it, its dependencies
are pinned to exact dates inside it, and nothing published later changes it — a real thing to
depend on, and not the same as being maintained.
</feature>

<feature title="It promises nothing about the next" icon="calendar">
Any release may change or remove an export, and the number will not tell you: a later date means
a later release and nothing more.
</feature>
</feature-grid>
</section-block>

<section-block id="there-are-no-supported-versions" eyebrow="Support" title="There are no supported versions" tone="tinted">

<feature-grid columns="2">
<feature title="One line, from main" icon="git-branch">
There is one line of releases, published from `main`. So "supported" describes exactly one
release at a time: the most recent.
</feature>

<feature title="No long-term support" icon="shield">
No long-term-support branch, and no version that is "the stable one" to stay on while the rest
moves.
</feature>

<feature title="No backports" icon="history">
A fix goes out on the next release date and is never republished onto an earlier one.
</feature>

<feature title="No deprecation window" icon="clock">
No deprecation window is guaranteed ahead of a removal, so the release notes are where a removal
is announced.
</feature>
</feature-grid>
</section-block>

<section-block id="pin-exactly-move-when-ready">
<split>
<split-copy>

## Pin exactly, move when ready

An exact pin is the whole strategy. It keeps the upgrade yours to schedule: read what shipped, take
the date when you have time to read it, and run your tests against it.

<actions cta-href="/docs/getting-started/install-and-pin" cta-label="Install and pin" size="sm" />

</split-copy>
<split-media>

```json {% title="package.json" %}
{
	"dependencies": {
		"@sdxc/result": "2026.9.21"
	}
}
```

> [!WARNING]
> A range such as `^2026.9.21` reads the date as major, minor and patch, and accepts every later
> release in the same year — asking for a promise the version was never making.

</split-media>
</split>
</section-block>

<section-block id="documentation-describes-main" tone="tinted">
<split>
<split-copy>

## Documentation describes `main`

There is no versioned documentation, for the same reason: "the docs for `2026.9.4`" would describe
a release that carries no compatibility relationship to the one before or after it.

These pages describe what is on `main`, which is what the next release will be built from. To read
a package exactly as you have it installed, read the `README.md` inside the version you pinned.

</split-copy>
<split-media>

<files title="node_modules">
<folder name="@sdxc">
<folder name="result">
<file name="README.md" />
<file name="package.json" />
</folder>
</folder>
</files>

</split-media>
</split>
</section-block>

<section-block id="related" eyebrow="Related" title="Read on">

<feature-grid columns="2">
<feature title="Versioning" icon="calendar" href="/docs/releases/versioning" link-label="How versioning works">
How the number is assigned, and why a range is the wrong tool.
</feature>

<feature title="Changelog" icon="history" href="/docs/releases/changelog" link-label="Read the changelog">
Every release, with the notes it went out with.
</feature>

<feature title="Install and pin" icon="package" href="/docs/getting-started/install-and-pin" link-label="Install your first package">
Add a package at an exact date, and move the pin when you are ready.
</feature>

<feature title="Security" icon="lock" href="/security" link-label="Read the security policy">
Which releases get fixes, and how to report something privately.
</feature>
</feature-grid>
</section-block>

<section-block id="start" title="Pin a date, and read what changed." tone="grid" align="center">

Every release ships with its notes, so moving a pin starts with reading them.

<actions cta-href="/docs/releases/changelog" cta-label="Read the changelog" alt-href="/api" alt-label="Browse the packages" />
</section-block>
