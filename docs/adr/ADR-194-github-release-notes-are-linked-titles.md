# ADR-194: GitHub Release Notes Are Linked Titles

## Status

**Implemented** - 2026-11-10 (amends [ADR-007](./ADR-007-publishable-package-releases.md),
[ADR-140](./ADR-140-commit-bodies-are-release-notes.md), and
[ADR-166](./ADR-166-capitalized-summaries-in-release-notes.md))

## Background

The daily release printed each commit's title and body under every package it touched
(ADR-007, ADR-140). On a busy day the body hit GitHub's 125 000-character Release limit, so the
script shortened the largest sections to titles linked to their commits. The shortened `@sdxc/ui`
section of `v2026.11.3` was easier to scan than the full bodies, and the full note was one click
away.

Separately, a dangling `Release-Note-For` trailer that named a rewritten commit aborted the
release with `fatal: bad object` until the run started treating a missing correction target as
"no paths" instead of a hard failure.

## Context

- Commit bodies remain the public release note for consumers and for `sdxc upgrade`
  (`changelog.jsonl`, ADR-140, ADR-144).
- Titles already have to stand alone as sentences (ADR-166), because shortened sections printed
  them without bodies.
- The overflow path left a mixed page: small packages kept essays, large ones got title lists
  with a "Shortened to fit…" line, and if every section was already shortened and the body was
  still over the limit the run still handed GitHub a body that returned HTTP 422.
- Correction attribution already used `correctionFiles` so a missing sha answers an empty path
  list; a `filesOf` that still failed aborted `attributeCorrections` anyway.

## Decision

**The GitHub Release lists each change as its summary linked to the commit.** Bodies are not
copied into the Release. The commit page, `changelog.jsonl`, and `sdxc upgrade` keep the full
note.

| Surface                            | Entry                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| GitHub Release body                | `- Summary ([sha](…/commit/sha))`, or `- **Breaking:** Summary ([sha](…))` |
| Commit message body                | Full release note (unchanged, ADR-140)                                     |
| `changelog.jsonl` / `sdxc upgrade` | Full note under the summary (unchanged, ADR-144)                           |

**`renderNotes` fails before `gh release create` when the body would still exceed GitHub's
limit**, naming the character count, so a pathological day stops with a clear error instead of
HTTP 422.

**`attributeCorrections` keeps a correction's own files when `filesOf` fails or answers none**,
so a dangling or unreadable `Release-Note-For` target never aborts the release. Callers still
pass `correctionFiles` so a missing sha is detected without a `git show` on a bad object.

## Consequences

### Positive

- Every package's Release section is scannable the same way, busy day or quiet.
- GitHub's body limit stops being a day-to-day concern for normal release sizes.
- A rewritten correction target no longer fails the scheduled Release job.

### Negative

- A reader who stays only on the GitHub Release page no longer sees migration steps inline; they
  open the commit, the changelog on sdxc.dev as older Releases still show, or run `sdxc upgrade`.

### Neutral

- Commit authoring rules are unchanged: bodies stay required and titles stay capitalized
  sentences.
- Older Releases that shipped full bodies stay as published; the site changelog renders them as
  GitHub holds them.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-140: Commit Bodies Are Release Notes](./ADR-140-commit-bodies-are-release-notes.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)
- [ADR-166: Capitalized Summaries in Release Notes](./ADR-166-capitalized-summaries-in-release-notes.md)
- [`v2026.11.3`](https://github.com/sergiodxa/monorepo/releases/tag/v2026.11.3)
