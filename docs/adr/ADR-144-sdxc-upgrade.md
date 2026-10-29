# ADR-144: `sdxc upgrade`

## Status

**Accepted** - 2026-10-15

> Superseded by [ADR-183](./ADR-183-drop-sdxc-umbrella.md) for the install package: changelog and
> registry ship in `@sdxc/kit`. The `sdxc upgrade` command itself is unchanged.

## Background

`sdxc` (ADR-136) publishes a dated release whenever any package ships, so a project falls behind
quickly, and moving several releases at once means reading every package's notes for the changes
that touch it. Commit bodies are written as release notes with migration steps (ADR-140). This
ADR records `sdxc upgrade`, which moves a project to another release and writes the prompt an AI
agent needs to bring the code along.

## Context

- The release already parses every commit since the previous release, attributes it to packages
  by path, and publishes title and body in the GitHub Release (ADR-007).
- A project imports `remix` itself, as a peer every package pins exactly (ADR-136), so moving
  `sdxc` can require moving `remix` with it.
- `sdxc` releases almost daily, so a changelog covering every release grows with every one.

## Decision

`sdxc upgrade [version] [--no-install] [--output <file>]`.

1. **Resolve.** The current version is the installed `sdxc`; the target is `version`, or the
   latest release on npm when omitted. A target older than the current version is refused. A
   target equal to the current version still goes on to step 2, and the project is reported as up
   to date only when step 2 would change no pin.
2. **Bump.** `sdxc` in `package.json` becomes the exact target version, and `remix` becomes the
   version the target `sdxc` declares as its peer when it differs. Every `@sdxc/*` dependency the
   file lists moves to its version at the target release, so a package pinned behind the current
   release (a lagging pin) is caught up even when the target is the current release; nothing
   else in the file changes.
3. **Install** with the project's package manager. `--no-install` stops here and prints the
   install command and the prompt command to run after it.
4. **Prompt.** The CLI runs the newly installed `sdxc` as `sdxc upgrade --prompt --from <current>`,
   plus `--since <package>@<pin>` for each lagging package, so its notes start at its own pin
   while every other package's start at the current release. The prompt is written by the target
   release's code from the target release's data.
   `--prompt --from <version>` also regenerates it later without bumping anything.

### Changelog in the tarball

The release build writes `changelog.jsonl` into the `sdxc` package through `@sdxc/jsonl`
(ADR-139): one line per commit, per package, per release, with the release, the package, the
Conventional Commits type, whether it is breaking (`!`), the title and the body. It comes from
the same commit parsing as the GitHub Release notes, so `upgrade` reads it offline.

- **Corrections replace the original.** A commit with a `Release-Note-For: <sha>` trailer
  (ADR-140) is written as the corrected body of the commit it names, in that commit's line, so
  the prompt carries only the corrected note. The line also records `correctedIn`, the release
  that shipped the correction, and the prompt lists under `## Corrected notes` every corrected
  note from a release the project already had whose correction ships in a release it moves
  across. An entry whose correction falls inside the twelve-month window stays in the file.
- **Bounded size.** The file holds every entry from releases in the twelve months before the
  release that builds it, and only the breaking entries from older releases. An upgrade from a
  version older than that window says which releases it summarizes by breaking changes only and
  links their GitHub Releases.

### What the prompt holds

For the releases after the current version up to the target:

- the packages the project imports, found with `findModuleReferences` from `@sdxc/codemod`
  (ADR-137) over every `sdxc/*` specifier, and only their entries;
- the `remix` version change, when step 2 made one, with a link to Remix's release notes;
- breaking changes first, each with its full body, then features and fixes with theirs;
- vendored components whose source changed after the release their lock entry records, read from
  each registry entry's `changedIn` (ADR-141), with `sdxc ui diff` and `sdxc ui update` as the
  way to take the change;
- the project's own verification commands, from its `package.json` scripts (`check`, `typecheck`,
  `test`), to run after editing;
- links to each package's documentation page.

The prompt goes to stdout, so it pipes into a clipboard or an agent's command line; `--output`
writes it to a file.

## Consequences

### Positive

- **Upgrades come with their instructions.** `sdxc upgrade` moves one version and hands an agent
  the changes that matter to this project, with the steps each one needs.
- **`remix` moves with `sdxc`,** so the peer pin never leaves an install unresolvable.
- **Offline and version-matched.** The prompt is built from the target release's own data.

### Negative

- **The tarball grows** with a year of commit bodies, bounded by the window.
- **The prompt is only as good as the commit bodies**, which is why ADR-140 makes them required.

## Implementation Plan

1. `changelog.jsonl` in the release build, with corrections applied and the twelve-month window.
2. Resolve, bump (`sdxc` and `remix`), install, and the prompt, with a test that renders the
   prompt for a fixture project between two fixture releases.

## Alternatives Considered

### 1. Reading the changelog from GitHub Releases at upgrade time

**Rejected because**: it needs the network and a rate-limited API, and the notes are Markdown
written for people; the tarball's `changelog.jsonl` is structured, offline, and ships with the
release it describes.

### 2. `sdxc upgrade` applying changes itself

**Rejected because**: a breaking change rarely reduces to a mechanical rewrite of the app's code;
the CLI moves the version and gathers the instructions, and the agent, with the project in front
of it, makes the edits.

### 3. Every entry since the first release

**Rejected because**: with a release most days, the file grows without bound in every install,
while upgrades across more than a year are rare and need mainly the breaking changes.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-139: `@sdxc/jsonl` Package](./ADR-139-jsonl-package.md)
- [ADR-140: Commit Bodies Are Release Notes](./ADR-140-commit-bodies-are-release-notes.md)
- [ADR-141: `sdxc ui` Component Vendoring](./ADR-141-sdxc-ui-component-vendoring.md)

## Current Progress

- [x] `changelog.jsonl` in the release build (`scripts/release/changelog.ts`, written into the
      staged `sdxc` package after it builds)
- [x] `sdxc upgrade` and the prompt (`packages/kit/src/upgrade/`); vendored components are
      read from the lock file's `ui` lines and each registry entry's `changedIn` as ADR-141
      specifies them, and are listed once the registry ships in the tarball
