# ADR-140: Commit Bodies Are Release Notes

## Status

**Accepted** - 2026-10-14

## Background

The daily release publishes each package's commits verbatim, title and body, as that package's
section of the GitHub Release (ADR-007). ADR-007 makes the body optional: "the body, when
present, explains it". `sdxc upgrade` (ADR-136) now turns the same commits into the prompt an AI
agent follows to move a project between releases, so a commit without instructions leaves the
agent guessing at what to change.

Remix asks every pull request for a change file written for the person upgrading: what changed,
how to use it, and how to migrate. This repo has no change files; its commits are the notes.

## Decision

Every commit carries a body, written as the public release note for its change, for a reader
outside this repository.

| Change                                                    | The body says                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------ |
| A new feature or API                                      | What it does and how to use it, with a short code example                |
| A breaking change (`type(scope)!:`)                       | Every migration step, with the code before and after                     |
| A fix                                                     | The behavior before and after, and whether a consumer has to do anything |
| A change with no effect on consumers (refactor, test, CI) | That in one sentence, so a reader of the notes knows nothing is required |

- **Written for a consumer.** Names are the published ones (`sdxc/markdown`, `@sdxc/markdown`);
  no `packages/*` paths, `workspace:*` versions or anything that exists only inside the repo.
- **Code in fenced blocks.** The release notes render Markdown, and an agent reads a fenced
  example as the code to write.
- **Every workspace.** App commits follow the same rule; an app's history reads as its changelog.
- **Commits on pull-request branches too,** since rebase-and-merge publishes each one (ADR-134).

`AGENTS.md` carries the rule. A `commit-msg` hook in `scripts/` rejects a commit with no body; a
`prepare` script points `core.hooksPath` at it, so `bun install` enables it on every clone.

## Consequences

### Positive

- **Release notes a consumer can act on**, for every change, without opening the diff.
- **`sdxc upgrade` prompts with real instructions**, since they are the commit bodies.
- **Breaking changes arrive with their migration**, written by the author while the change is
  fresh.

### Negative

- **Every commit takes longer to write**, including the ones with nothing for a consumer.
- **A body cannot be fixed after release.** Rewriting history on `main` is not an option, so a
  wrong note is corrected by a follow-up commit whose body supersedes it.

### Neutral

- ADR-007's release mechanics are unchanged; only the optional body becomes required.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-134: Conventional Commit Titles on Pull Requests](./ADR-134-conventional-commit-titles-on-pull-requests.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)

## Current Progress

- [x] Rule in `AGENTS.md`
- [ ] `commit-msg` hook rejecting a commit without a body
