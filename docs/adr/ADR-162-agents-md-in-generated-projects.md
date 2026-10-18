# ADR-162: An `AGENTS.md` in Generated Projects, Kept Current by `sdxc upgrade`

## Status

**Accepted** - 2026-10-18

## Background

An app in this repo inherits its conventions from the repo's own `AGENTS.md`: the ADR-129
folder layout, `sdxc make` for new files, `remix/component` with `css()` mixins, `@sdxc/result`
over exceptions, `ctx.log`, the build → migrate → deploy order. A project written by
`sdxc create` (ADR-142) has the same layout and the same packages, and an AI agent working in
it starts with none of those conventions, so it writes files by hand, in folders the generators
do not know, with tools the packages replace.

The conventions also move: a release adds a `make` kind, a package, or a rule. A file written
once at `create` time falls behind the packages `sdxc upgrade` installs.

## Context

- AI coding agents read `AGENTS.md` at the project root. Claude Code reads `CLAUDE.md`, and a
  line `@AGENTS.md` in it imports the other file.
- `sdxc upgrade` bumps the pins and installs, then runs the target release's `@sdxc/kit` with
  `upgrade --prompt`, so code that runs in that step comes from the release being installed.
- The project owns its `AGENTS.md` once it exists: teams add their own rules, and a regenerated
  file would erase them.
- `sdxc upgrade` runs on any project that lists `@sdxc/*` packages, libraries included, while
  the conventions describe the app template's layout.

## Decision

### The template ships `AGENTS.md` and `CLAUDE.md`

`packages/kit/templates/app/AGENTS.md` teaches an agent the project: the commands (`sdxc make`
with every kind and `--dry-run`, `sdxc ui add`, `sdxc run`, `sdxc upgrade`, `bun check`), the
layout table, and the rules that apply to an app built on the published `@sdxc/*` packages,
with links to sdxc.dev. It names published packages only, so it reads the same in any
project. `CLAUDE.md` holds the single line `@AGENTS.md`, so Claude Code reads the same rules with
one file to maintain. `sdxc create` copies both as it copies every template file.

### A managed section between two markers

The sdxc-owned part of `AGENTS.md` sits between two HTML comments, invisible when the Markdown
renders:

```text
<!-- sdxc:start · sdxc upgrade rewrites this section from the release it installs; keep project rules outside it -->
…
<!-- sdxc:end -->
```

A start line is any line beginning `<!-- sdxc:start`, and the end line is `<!-- sdxc:end -->`,
so the wording of the start comment can change between releases. Everything outside the pair
belongs to the project; the template ends with a "This project" section after the end marker
as the place for its own rules.

### `upgrade --prompt` rewrites the section from the target release

Before building the prompt, `upgrade --prompt` reads the section from its own
`templates/app/AGENTS.md` and replaces the project's section with it, start and end lines
included, keeping the file's line endings. That step already runs from the target release, so
the section always matches the packages just installed, and running it again is a no-op. It
prints `AGENTS.md: refreshed the sdxc section` to stderr when the file changed.

### A file without one balanced section is left as it is

`upgrade` writes into `AGENTS.md` only where the project has opted in by keeping the markers:

- **No `AGENTS.md`**, or **one without the markers**: the file is left as it is, and the prompt
  gains a short section pointing at the release's `AGENTS.md` on unpkg, asking the agent to add
  it between the markers when the project follows the app layout. A library project, a project
  from a GitHub template, or one that removed the markers on purpose keeps its file.
- **Unbalanced markers** (a start without an end, an end first, or more than one pair): the file
  is left as it is, and the prompt asks the agent to restore one pair.

### Nothing goes in the lock file

The markers are the whole state: what sits between them is the release's, and what sits
outside is the project's. The section is regenerated wholesale, so there is no recorded copy to
compare against, unlike a vendored component in `.config/sdxc.lock.jsonl`.

## Consequences

### Positive

- **A new project's agent starts with the conventions.** It writes files through `sdxc make`,
  in the folders the layout gives them, with the packages the template already wires.
- **The rules follow the packages.** Each upgrade brings the section of the release it
  installs, so a new `make` kind or rule reaches existing projects with the code that needs it.
- **Project rules survive upgrades.** Everything outside the markers is the project's own.

### Negative

- **An edit inside the markers is replaced by the next upgrade.** The start comment says so;
  the project moves such a rule below the end marker.
- **Projects created before this release get no section automatically.** Their first upgrade's
  prompt asks the agent to add it.

## Implementation Plan

1. Write `templates/app/AGENTS.md` and `templates/app/CLAUDE.md`, and test that `create` writes
   both.
2. Add the section rewrite to `upgrade --prompt`, with the prompt notes for an unmarked,
   missing or unbalanced file.
3. Document the file in the kit README and the sdxc command guide.

## Alternatives Considered

### 1. Regenerate the whole `AGENTS.md` on every upgrade

**Rejected because**: it erases every rule the project added, so teams would keep theirs
elsewhere and the file agents read first would hold only the generic part.

### 2. Record a hash of the section in the lock file and skip an edited one

**Rejected because**: an edited section would then stop receiving the release's rules for good,
which is the drift the managed section exists to prevent. The project's own rules have a home
outside the markers.

### 3. Add the markers and section to any project that lacks them

**Rejected because**: `upgrade` runs on libraries and on projects from other templates, whose
agents the app layout would mislead, and removing the markers is how a project opts out.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)
- [AGENTS.md](https://agents.md)

## Current Progress

- [x] `AGENTS.md` and `CLAUDE.md` in the `app` template, written by `create`
- [x] `upgrade --prompt` rewrites the managed section and notes an unmanaged file
- [x] README and guide
