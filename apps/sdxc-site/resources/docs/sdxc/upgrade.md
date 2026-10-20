---
title: Upgrade
description: Move every @sdxc package to a newer release, catch up the ones that lag behind, and get a prompt that tells an AI agent what changed for the code you have.
section:
    title: The sdxc command
    order: 2
order: 5
lastUpdated: 2026-10-19
outcomes:
    - "How to move every `@sdxc` package to a newer release, or catch up the ones that lag"
    - "How `upgrade` lists the breaking changes between two releases"
    - "How to hand the upgrade prompt to your AI agent"
---

Every `@sdxc` package ships on one dated release, so upgrading is moving them all together and
then changing your code for what changed between the two releases. One command does the first
and writes the instructions for the second:

```bash
sdxc upgrade
```

It moves every `@sdxc/*` package your `package.json` lists to its version at the
target release, and `remix` to the version that release declares. It installs, then prints a
prompt for an AI agent with the release notes of the packages your code imports, so the agent
edits the code for exactly the changes you crossed.
[Install and pin](/docs/getting-started/install-and-pin) covers why a release is one exact
date.

## Pick the release

```bash
sdxc upgrade               # the latest release
sdxc upgrade 2026.10.14    # a release you name
```

The project's release is the newest date among its `@sdxc` pins. Each package moves to its
newest version published on or before the target date, since a release republishes only the
packages that changed. A target older than the project's release is refused: `upgrade` only
moves forward. A `package.json` that lists no `@sdxc/*` package, or pins none to an exact
release, is refused too.

## Catch up lagging packages

The move includes packages pinned behind the release you are already on, so `sdxc upgrade`, or
`sdxc upgrade <your release>`, catches them up even when no newer release is out. It reports
"up to date" only when no pin would change:

```text
The @sdxc packages are up to date at 2026.10.14
```

[`sdxc doctor`](/docs/sdxc/check-a-project) points at the same fix when it finds a package
behind.

## Breaking changes

Before it changes `package.json`, `upgrade` lists the breaking changes between the two releases
in the packages your code imports, and asks whether to go on. A no leaves `package.json` as it
was. Without a terminal, or with no breaking change to list, it goes on without asking.

Then it writes each pin, prints every change on stderr, and installs with the project's package
manager:

```text
package.json: @sdxc/jwt 2026.9.1 -> 2026.10.14
package.json: @sdxc/result 2026.10.1 -> 2026.10.14
package.json: remix 3.0.0 -> 3.1.0
```

`--no-install` stops after `package.json` and prints the install command and the prompt command
to run next. A failed install says the same, so you can fix it and carry on.

## The prompt for your agent

Once installed, `upgrade` runs the new release of `@sdxc/kit` to write the prompt, so the notes
come from the release you installed. Progress goes to stderr and only the prompt goes to stdout,
so it pipes into your agent's command line or clipboard; `--output upgrade.md` writes it to a
file instead.

The prompt is Markdown, in this order:

- What to do: apply each breaking change's migration, adopt the features and fixes, then verify.
- `## Remix`, when `remix` moved, with a link to its release notes.
- `## Breaking changes`, `## Features` and `## Fixes`: each note in full, for the packages the
  code imports only. Notes with nothing for a consumer to do, such as docs and tests, stay in
  the GitHub Releases.
- `## Older releases`, linking the full notes of releases too old for the changelog the kit
  ships.
- `## Vendored components`: copies made with [`sdxc ui add`](/docs/sdxc/copy-ui-components)
  whose source changed since, with the `ui diff` and `ui update` commands for each.
- `## Agent instructions`, when the upgrade left `AGENTS.md` as it is: a link to the release's
  sdxc section for your agent to add, as AGENTS.md below describes.
- `## Verify`: the project's own `check`, `typecheck` and `test` scripts, as your package
  manager runs them.
- `## Documentation`: the reference page of each package the code imports.

The prompt covers each caught-up package from the version it was pinned to, and every other
package from the project's release.

### Write the prompt again

To write the prompt later, name the release you moved from. Pass `--since <package>@<old version>`
once per package that lagged behind it, and `--remix-from` when `remix` moved:

```bash
sdxc upgrade --prompt --from 2026.10.14 --since @sdxc/jwt@2026.9.1
```

`--prompt` writes the prompt of the installed `@sdxc/kit` and refreshes the `AGENTS.md`
section below, leaving `package.json` as it is. It takes `--from` and no release.

## AGENTS.md

The same step rewrites the sdxc section of `AGENTS.md`, the lines between
`<!-- sdxc:start … -->` and `<!-- sdxc:end -->`, from the new release's template, and keeps
everything outside them as you wrote it. Move a rule you added inside the section below it, so
the next upgrade keeps it. A project whose `AGENTS.md` has no section, or no `AGENTS.md` at
all, keeps its file, and the prompt links the release's section for your agent to add.

## A full upgrade

```bash
sdxc upgrade --output upgrade.md
# hand upgrade.md to your agent, let it edit and run the Verify commands
sdxc ui list
sdxc doctor
```

`ui list` shows the copies still behind, and `doctor` confirms every pin and install matches the
new release before you commit.

## Where to go next

- [Check a project](/docs/sdxc/check-a-project) — find a package behind the release or an
  install that differs from `package.json`.
- [Versioning](/docs/releases/versioning) — what a dated release number records.
