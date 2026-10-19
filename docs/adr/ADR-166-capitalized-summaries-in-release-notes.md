# ADR-166: Capitalized Summaries in Release Notes

## Status

**Accepted** - 2026-10-19 (amends [ADR-007](./ADR-007-publishable-package-releases.md))

## Background

The daily release prints every commit under the packages it touches (ADR-007), and its body
is the release note for that change (ADR-140). Each entry was headed `- type: title`, the
Conventional type copied from the subject with the summary lowercase as written. The same
titles reach `sdxc upgrade`'s prompt (ADR-144) through `changelog.jsonl`, and sdxc.dev's
`/changelog` renders the GitHub Release bodies.

The type is the author's classification for git and for the release script: it says whether a
change is a feature or a fix, and `!` says it breaks. A reader of one package's notes wants the
change itself, and a heading such as `- refactor: move the store` reads as a log line rather
than a sentence.

## Context

- Every surface reads the same parse: `scripts/release/commits.ts` splits a subject into type,
  scope, breaking flag and title, so `title` already holds the summary alone.
- `changelog.jsonl` entries already carry `title` without the prefix, beside `type` and
  `breaking`; `sdxc upgrade` groups by those fields and prints `title`.
- The GitHub Release body is rendered Markdown with the type in it, and the site renders every
  release GitHub holds, so the old shape stays on the page unless the site rewrites it.
- History is never rewritten: the commits already on `main` keep their lowercase summaries.

## Decision

**Commit titles are `type(scope): Summary`, the summary starting with a capital letter**
(`feat(jwt): Add ES512 signing keys`). A summary opening with code (`` `sdxc upgrade` reads… ``),
a digit or punctuation is fine; the rule is that it never starts with a lowercase letter.

**Release notes print the summary alone.** The type stays in git and in the fields the release
derives from it; the published text drops it.

| Surface                     | Entry                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- |
| GitHub Release body         | `- Summary`, or `- **Breaking:** Summary`; a package's breaking entries come first     |
| `changelog.jsonl` (`title`) | `Summary`, with `type` and `breaking` unchanged beside it                              |
| `sdxc upgrade` prompt       | `### @sdxc/<name>: Summary`, under the breaking/features/fixes sections it already has |
| sdxc.dev `/changelog`       | Older releases' `- type!: summary` items rewritten to the shape above when rendered    |

Every surface uppercases the first letter of the summary it prints, so a commit written before
this decision reads exactly like one written after it.

### Enforcement

- The `commit-msg` hook (`scripts/release/check-commits.ts --message-file`) rejects a
  Conventional subject whose summary starts with a lowercase letter, with the expected shape in
  the message. Autosquash subjects (`fixup! …`) pass, as they do for the body rule.
- CI's pushed-commit check applies the same rule to every commit after
  `177a9604d9228d6576bdb05a7e0b60d020093968`, the last commit before the rule; earlier commits
  are history and are never flagged.

## Consequences

### Positive

- Each release note reads as a list of changes in sentences, and breaking changes are marked in
  words a reader without Conventional Commits recognizes.
- Breaking entries lead each package's section, the order `sdxc upgrade` already uses.

### Negative

- The GitHub Release no longer shows whether a non-breaking entry is a feature or a fix; the
  commit itself, and `changelog.jsonl`'s `type`, still say.

### Neutral

- Old and new titles parse identically; only the case of the summary differs, and the printing
  absorbs it.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-140: Commit Bodies Are Release Notes](./ADR-140-commit-bodies-are-release-notes.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)
