# ADR-140: Commit Bodies Are Release Notes

## Status

**Accepted** - 2026-10-14

## Background

The daily release publishes each package's commits verbatim, title and body, as that package's
section of the GitHub Release (ADR-007). ADR-007 makes the body optional: "the body, when
present, explains it". `sdxc upgrade` (ADR-144) turns the same commits into the prompt an AI
agent follows to move a project between releases, so a commit without instructions leaves the
agent guessing at what to change.

Remix asks every pull request for a change file written for the person upgrading: what changed,
how to use it, and how to migrate. This repo has no change files; its commits are the notes.

## Context

- The release reads commits with `git log --format=…%b…` and drops git trailers such as
  `Co-authored-by:` from the published body (ADR-007). Nearly every commit in the repo carries a
  `Co-authored-by:` trailer, so a body that holds only trailers publishes as no body at all.
- Git's default commit cleanup (`strip`) deletes every line that starts with `#`. A fenced
  `bash` example's comments and any Markdown heading in a body vanish before any hook sees them.
- `git revert` writes the body `This reverts commit <sha>.`, which names no consumer effect.
- `scripts/pre-commit.sh` exists but is not installed, and it runs `bun test`, which
  `scripts/reject-bun-test.ts` now rejects; a hooks path that includes `scripts/` would make
  every commit fail.
- Release notes are attributed to packages by the paths each commit touches (ADR-007), so a
  commit that touches no file in a package never reaches that package's notes.
- A local hook is skipped by `git commit --no-verify` and by any environment that never ran
  `bun install`, cloud sessions included.

## Decision

Every commit carries a body, written as the public release note for its change, for a reader
outside this repository.

| Change                                                    | The body says                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| A new feature or API                                      | What it does and how to use it, with a short code example                |
| A breaking change (`type(scope)!:`)                       | Every migration step, with the code before and after                     |
| A fix                                                     | The behavior before and after, and whether a consumer has to do anything |
| A change with no effect on consumers (refactor, test, CI) | That in one sentence, so a reader of the notes knows nothing is required |
| A revert                                                  | What consumers get back, and what to undo if they adopted the change     |

- **Written for a consumer.** Names are the published ones (`sdxc/markdown`, `@sdxc/markdown`);
  no `packages/*` paths, `workspace:*` versions or anything that exists only inside the repo.
- **Code in fenced blocks.** The release notes render Markdown, and an agent reads a fenced
  example as the code to write.
- **Every workspace.** App commits follow the same rule; an app's history reads as its changelog.
- **Commits on pull-request branches too,** since rebase-and-merge publishes each one (ADR-134).

### What counts as a body

The body is the commit message after the title, with git trailers removed: the same text the
release publishes. A body that is empty once trailers are removed, or that is exactly git's
revert line, is missing.

### Keeping `#` lines

`bun install` sets `commit.cleanup` to `scissors` in the clone, so lines starting with `#` stay
in the message; in an editor, git's own instructions sit below a scissors line and are removed.
A commit written with `git commit -m` or `-F` keeps every line as written.

### Correcting a published note

A release cannot be rewritten, and history on `main` is never rewritten. A wrong note is
corrected by a commit whose `Release-Note-For: <sha>` trailer names the commit it corrects and
whose body is the full replacement note:

```text
docs(markdown): correct the migration note for the plugin rename

Rename `remarkLint` to `lint`, and import it from `sdxc/markdown/plugin/lint`:

    import { lint } from "sdxc/markdown/plugin/lint";

Release-Note-For: 3f2a91c
```

- The correction may be an empty commit (`--allow-empty`); the release attributes it to the
  packages the named commit touched, so it publishes under the same packages.
- `changelog.jsonl` (ADR-144) records the correction against the named commit, and
  `sdxc upgrade` shows the replacement body in place of the original.

### Enforcement

- **Locally.** A `commit-msg` hook in `scripts/git-hooks/` rejects a commit whose body is
  missing. The root `prepare` script sets `core.hooksPath` to `scripts/git-hooks` and
  `commit.cleanup` to `scissors`, so `bun install` enables both on every clone. The folder holds
  hooks only; `scripts/pre-commit.sh` stays where it is and is not installed.
- **In CI.** `ci.yml` runs the same check over every commit a push or pull request adds, through
  the release's own commit parser, so `--no-verify` and environments without the hook are caught
  before anything reaches a release. Commits older than this ADR are not checked.

`AGENTS.md` carries the rule.

## Consequences

### Positive

- **Release notes a consumer can act on**, for every change, without opening the diff.
- **`sdxc upgrade` prompts with real instructions**, since they are the commit bodies.
- **Breaking changes arrive with their migration**, written by the author while the change is
  fresh.
- **Code examples survive intact**, comments included.

### Negative

- **Every commit takes longer to write**, including the ones with nothing for a consumer.
- **A wrong note stays in the published release**; the correction appears in the next release
  and in `sdxc upgrade`, and the GitHub Release that carried the original keeps it.
- **The release tooling learns one trailer**, `Release-Note-For`, for attribution and for
  `changelog.jsonl`.

### Neutral

- ADR-007's release mechanics are unchanged apart from the correction trailer; the optional body
  becomes required.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-134: Conventional Commit Titles on Pull Requests](./ADR-134-conventional-commit-titles-on-pull-requests.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)
- [git-commit `--cleanup`](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt---cleanupmode)

## Current Progress

- [x] Rule in `AGENTS.md`
- [ ] `commit-msg` hook in `scripts/git-hooks/`, with `core.hooksPath` and `commit.cleanup` set
      by `prepare`
- [ ] Body check in `ci.yml` over the commits a push or pull request adds
- [ ] `Release-Note-For` attribution in the release tooling
