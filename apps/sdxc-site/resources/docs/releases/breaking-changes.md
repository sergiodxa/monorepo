---
title: Breaking changes
description: How a breaking change is marked in the release notes, how its migration note is laid out, and how to find and apply every one between the release you pin and the one you take.
section:
    title: Releases
    order: 10
order: 2
lastUpdated: 2026-10-25
outcomes:
    - "Where a breaking change is marked in the GitHub Release, the changelog and `sdxc upgrade`"
    - "How to list every breaking change between your pinned release and a newer one"
    - "How to apply a migration note by hand or through the prompt `sdxc upgrade` writes"
---

Any release may change or remove an export, so moving a pin forward can mean changing your code.
Every such change is marked as breaking and carries a migration note that lists each step with the
code before and after. This page covers where the marker shows up, how to list every breaking
change between the release you have and the one you want, and how to apply them yourself or
through an AI agent.

## Spot the marker

A breaking change is a commit whose Conventional subject carries a `!` after its scope, such as
`feat(jwt)!: Sign Edwards tokens as Ed25519`. Each place that shows release notes turns that `!`
into something you read at a glance:

- **The GitHub Release** of the day lists each package under its own heading, and its breaking
  changes come first, marked `**Breaking:**` before the summary.
- **The [Changelog](/docs/releases/changelog)** shows those same notes for every release, newest
  first, each release headed by its version.
- **`sdxc upgrade`** lists the breaking changes in the packages your code imports before it
  touches `package.json`, and its prompt gathers them under `## Breaking changes`, ahead of the
  features and fixes.

A breaking change sits under the package whose API changed. A package that republished only
because one of its dependencies changed says so in one line, "Republished because `@sdxc/result`
changed.", and asks nothing of your code.

## Read the migration note

The note under a breaking change opens with what changed and who it affects, then lists the
migration as numbered steps, each with the code before and after. The steps cover every call
site the change reaches, so a note that applies only to some projects says which ones in its
migration line. In the GitHub Release of `2026.10.25`, the `@sdxc/jmap` note reads, shortened
here to its opening paragraph and its migration:

```text
## @sdxc/jmap
- **Breaking:** Expand Session URL templates with @sdxc/uri-template
	`@sdxc/jmap` now expands the Session's `uploadUrl`, `downloadUrl` and
	`eventSourceUrl` with `@sdxc/uri-template`, a full RFC 6570 level 1-4
	implementation, and no longer exports its own level 1 `expand` function.

	Migration, only if you imported `expand` from `@sdxc/jmap`:

	1. Install `@sdxc/uri-template`.

	2. Import `expand` from it. It returns a `Result` instead of a string.

	   Before:

	       import { expand } from "@sdxc/jmap";
	       let url = expand(session.downloadUrl, { accountId, blobId, name, type });

	   After:

	       import { unwrap } from "@sdxc/result";
	       import { expand } from "@sdxc/uri-template";
	       let url = unwrap(expand(session.downloadUrl, { accountId, blobId, name, type }));
```

The same text is what `sdxc upgrade` hands your agent.

> [!WARNING]
> A breaking change takes effect in the release that carries it. The old export is removed in that
> release, with no deprecated alias kept beside it, so the migration belongs to the pin move that
> crosses it. Taking a later feature means taking every breaking change released before it in that
> package.

## List every breaking change before you move

Your project's release is the newest date among its `@sdxc` pins. The breaking changes you cross
are the ones published after it, up to and including the release you take. `sdxc upgrade` lists
them for the packages your code imports, and asks before it writes anything:

```bash
sdxc upgrade 2026.10.25
```

```text
Release 2026.10.25 brings 2 breaking changes to packages this project imports:
  2026.10.25 @sdxc/jmap: Expand Session URL templates with @sdxc/uri-template
  2026.10.25 @sdxc/jwt: Sign Edwards tokens as Ed25519 and refuse unlisted algorithms by default
```

Answer no to keep `package.json` as it was, which makes the command a preview of the move. The
question needs a terminal: without one, or with no breaking change to list, the upgrade goes
ahead. To read the notes in full first, open the [Changelog](/docs/releases/changelog) and look
for `Breaking:` under the packages you import.

> [!NOTE]
> The release history `sdxc upgrade` reads keeps every breaking change, however old, and the full
> notes of the last twelve months. A move that starts further back still lists every breaking
> change, and its prompt links the GitHub Release of each older release for the rest.

## Apply the migration by hand

Move the pins first, then run your project's `typecheck` script: a removed export or a changed
signature fails the type check at each call site a note describes, so the errors are a checklist
of what is left.

```bash
sdxc upgrade 2026.10.25
npm run typecheck
```

Work through the notes oldest release first, since a later note can build on an earlier one in
the same package. For each step, find the code shaped like the before sample and rewrite it to
the after sample, and run the type check again until it passes.

## Apply the migration with your agent

Let the upgrade move the pins, install, and write the prompt to a file:

```bash
sdxc upgrade 2026.10.25 --output upgrade.md
```

The prompt carries every note in full under `## Breaking changes`, oldest release first, and
tells the agent to apply each migration, then run your project's `check`, `typecheck` and `test`
scripts.
[Upgrade](/docs/sdxc/upgrade#the-prompt-for-your-agent) covers every section the prompt holds.

## Where to go next

- [Upgrade](/docs/sdxc/upgrade) — every option of the command that moves your pins and writes
  the prompt.
- [Corrected release notes](/docs/releases/corrected-release-notes) — what it means when a later
  release replaces a migration note.
- [Versioning](/docs/releases/versioning) — why a dated version makes no compatibility promise.
