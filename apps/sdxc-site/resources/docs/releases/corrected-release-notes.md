---
title: Corrected release notes
description: A published release note stays as it was, a later commit publishes its full replacement, and each place that shows notes presents that replacement in its own way.
section:
    title: Releases
    order: 10
order: 3
lastUpdated: 2026-11-10
outcomes:
    - "What a correction to a published release note looks like"
    - "Where to read the current text of a note: GitHub, the changelog or `sdxc upgrade`"
    - "When a correction asks you to change your code"
---

A release is published once and keeps the notes it went out with. When a note turns out to be
wrong or incomplete — a migration step missing, a feature described under an option that was
renamed before anyone could use it — a later commit publishes the full replacement, and names
the commit whose note it replaces in a `Release-Note-For` trailer.

## Recognize a correction

A correction is published like any other change: as an entry in the release of the day it went
out, under the same packages as the note it replaces. Its summary says which note it replaces,
and its body is the whole replacement, worded to stand on its own. On the GitHub Release the
entry is that summary linked to the correction commit; open the commit for the replacement text.
On the Changelog, the `@sdxc/cli` section of `2026.10.16` holds a note for a `passthrough: true`
command option, the note for `argument.rest()` that replaced it, and the correction to the first,
shown here without the section's other notes:

```text
## @sdxc/cli
- Hand a command's arguments to another program with passthrough (aaa1111)
- Take another program's arguments with argument.rest(), and expose ctx.argv (bbb2222)
- Supersede the passthrough release note (ccc3333)
```

The trailer stays out of the published text, so the summary is how you match a correction to its
note. A correction can ship in the same release as its note, as here, or in any later one.

## Read the current text of a note

Each surface that shows release notes treats a correction differently:

- **The GitHub Release that carried the original** keeps the original entry, unchanged.
- **The GitHub Release of the correction's day** lists the replacement as an entry of its own
  under the corrected packages, linked to the correction commit.
- **The [Changelog](/docs/releases/changelog)** renders the GitHub Releases as they are, newest
  first, so you meet the replacement before the note it replaces.
- **`sdxc upgrade`** shows the replacement body in place of the original, under the original's
  summary and release, so the prompt your agent reads holds one current note for the change.
  When your project already had the original's release, the prompt of the upgrade that crosses
  the correction's release lists the replacement under `## Corrected notes`.

When a note in an older release looks wrong, search the releases after it on the Changelog for
an entry in the same package whose summary names it.

## Decide whether to act

A correction states, like every note, whether you need to do anything: the cli correction above
ends "Nothing to do". The replacement is the note to follow, so compare it with what you did when
you read the original:

- **The correction says there is nothing to do**, as most do: it rewords the note, or replaces a
  note for an option that never shipped. Your code stays as it is.
- **It corrects a breaking change's migration**, with a step that was missing or showed the wrong
  code: when you migrated by the original, apply the steps it adds or changes. `sdxc upgrade`
  hands your agent the corrected steps either way, as a breaking change when you have not taken
  that release yet and under `## Corrected notes` when you have.
- **It changes what a fix or feature says it does**: check your code against the described
  behavior where you rely on it.

## Where to go next

- [Breaking changes](/docs/releases/breaking-changes) — how a migration note is laid out, and how
  to apply one.
- [Upgrade](/docs/sdxc/upgrade) — the prompt that carries each note's current text to your agent.
- [Versioning](/docs/releases/versioning) — how a release decides which packages republish.
