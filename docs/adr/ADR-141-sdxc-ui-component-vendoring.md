# ADR-141: `sdxc ui` Component Vendoring

## Status

**Accepted** - 2026-10-15

> Superseded by [ADR-183](./ADR-183-drop-sdxc-umbrella.md) for the install package: use `@sdxc/*`
> and `@sdxc/kit`. The `sdxc ui` command itself is unchanged.

## Background

An app built on `sdxc` (ADR-136) imports `@sdxc/ui` components from the package. When it needs a
component to look or behave differently, its only options today are wrapping it or forking the
whole package. shadcn popularized the alternative: copy one component's source into the app and
own it from then on. This ADR records `sdxc ui`, which vendors `@sdxc/ui` components into an app
from the installed `sdxc` release and keeps the app's imports pointed at the copies, and the
state file the CLI records those copies in.

## Context

### How `@sdxc/ui` is laid out

- `exports` has the root (every component), `./animations`, `./behaviors`, `./mixins`,
  `./styles`, `./utils` and the two stylesheets. A single component has no subpath of its own.
- Components live in `src/components/` and import each other relatively (`dialog.tsx` imports
  `./button.js` and `./heading-scope.js`). They import helpers from the sibling folders
  (`../styles/floating-surface.js`, `../utils/warn-if-no-accessible-name.js`,
  `../mixins/clear-field.js`), and every helper they import is re-exported from its folder's
  barrel except `utils/glyph-edges.js`.
- Outside the package, a component imports `remix/component`, `@sdxc/u/*` and `@sdxc/icons`.

### What a copy needs recorded

To tell an untouched copy from an edited one, and to know which release it came from, the CLI
has to record something per copied file. The configuration is the user's file and is never
written by the CLI (ADR-136), so that record needs a file of its own.

## Decision

### Configuration keys

| Key            | Default                   | Meaning                                                                                      |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `ui.directory` | `resources/components/ui` | Where `sdxc ui add` writes components                                                        |
| `ui.alias`     | inferred                  | Import prefix app files use for the copies; overrides the one inferred from tsconfig `paths` |
| `ui.tests`     | `false`                   | Whether `ui add` and `ui update` copy a component's tests beside it                          |
| `lock`         | `.config/sdxc.lock.jsonl` | Where the CLI keeps its state file                                                           |

- **`ui.tests` defaults to off** because a copied test imports `vitest`, which a project without a
  test runner cannot type check.
- **Inferred from the project:** `ui.alias`, from the tsconfig `paths` entry whose target
  contains `ui.directory`, and relative paths when none does; and the extension style of relative
  imports in copied components, from the tsconfig's module resolution: none under `bundler`,
  `.js` under `node16` and `nodenext`.

### Commands

| Command                                    | Effect                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdxc ui list`                             | Every component in the installed registry, marking the ones copied and whether each copy is edited or behind the installed version                                                                      |
| `sdxc ui add <component...> [--with-deps]` | Copies the components (and their tests with `ui.tests`) and points the app's imports of them at the copies; `--with-deps` also copies every component they reach through other components, transitively |
| `sdxc ui diff <component>`                 | Shows how the local copy differs from the component in the installed version                                                                                                                            |
| `sdxc ui update <component...> [--force]`  | Replaces each copied file whose hash still matches the recorded one with the installed version; an edited file is left alone and reported unless `--force`; `--all` updates every copy (see below)      |
| `sdxc ui remove <component...>`            | Deletes the copies, drops them from the lock file, and points the app's imports of them back at `sdxc/ui/<name>`                                                                                        |

- **Only components are vendored.** A component is a file under `@sdxc/ui`'s `src/components/`.
  Animations, behaviors, mixins, styles and utils are always imported from `sdxc/ui/<folder>`,
  `--with-deps` included.
- **Per-component subpaths in `@sdxc/ui` first.** `@sdxc/ui` gains
  `"./*": "./src/components/*.tsx"` and exports `utils/glyph-edges.js` from its barrel, so
  `sdxc/ui/youtube-embed` resolves and every helper a copied component reaches is importable.
  The existing exact subpaths (`./styles`, `./reset.css`, …) take precedence over the pattern.
- **Registry built at release.** The release build writes `registry/ui/<name>.json` into the
  `sdxc` tarball from `@sdxc/ui`'s components: the source with its imports already rewritten
  through `@sdxc/codemod` (`@sdxc/*` to `sdxc/*`, `./button.js` to `sdxc/ui/button`,
  `../styles/floating-surface.js` to `sdxc/ui/styles`), its test file rewritten the same way when
  it has one, the components it imports, the names it exports, and `changedIn`, the latest
  release whose commits touched the component or its test.
- **A copy is what the whole app uses.** After `add`, every TypeScript and JavaScript file in the
  project outside `node_modules` and build output, copies included, imports the component from the
  copy: `sdxc/ui/button` is replaced, and `import { Button, Dialog } from "sdxc/ui"` is split so
  the names the copy exports come from the copy and the rest stay on `sdxc/ui`. `remove` reverses
  both, folding the names back into an existing `sdxc/ui` import when one is present. `update`
  writes the new version and points its imports at the copies the lock file lists. A default or
  namespace import of `sdxc/ui` cannot be split by name; the command reports each one with its
  file and line for the user to change.

### Updating every copy

`sdxc ui update --all` updates every component the lock file lists, so moving the project's copies
to a new `@sdxc/ui` is one command after upgrading. It is built to run unattended:

- **Edited copies are skipped.** An edited file is left as it is and named in the output, without
  a prompt even on a terminal; the copy keeps its recorded release until every file is replaced.
  `--force` replaces edited files, as it does for named components.
- **Names or `--all`.** `update` needs one or the other; neither, or both, is a usage error, so a
  typo in a script never widens into an update of everything. With nothing copied, `--all`
  reports so and exits 0.
- **New dependencies.** When a copy that is behind the installed version reaches a component the
  project has not copied, the update leaves its import on `@sdxc/ui/<name>` and reports it with
  the `sdxc ui add` that copies it. `--with-deps` copies those components instead, with the same
  rules as `add --with-deps`: the updated copy imports the new copy, and so does the app.
- **`--dry-run`** prints the diff of every copy, new copy and lock line, and writes nothing.

### State

The CLI writes its state as JSON Lines at the path `lock` names, committed with the project and
never edited by hand. Each line is one entry:

```jsonl
{"kind":"ui","name":"button","release":"2026.10.14","files":{"button.tsx":"sha256-…"}}
{"kind":"ui","name":"dialog","release":"2026.10.14","files":{"dialog.tsx":"sha256-…","dialog.test.tsx":"sha256-…"}}
```

- **Fields.** `kind` names the command group that owns the entry, so later state joins the same
  file; `name` identifies it within the kind; `release` is the `sdxc` release a copy came from;
  `files` maps each file written, relative to `ui.directory`, to the hash of its content. A
  component copied with `ui.tests` on lists its test file too, and `update` replaces each
  untouched file on its own.
- **Hashed after formatting.** The hash is taken once `format` (ADR-136) has run, so a copy the
  project's formatter rewrote still counts as untouched. When `format` fails, the hash is of the
  file as written, and the command says so.
- **The import rewrite keeps copies untouched.** When `add`, `update --with-deps` or `remove`
  points an untouched copy's imports at a new copy or back at `sdxc/ui`, the copy's line records
  the rewritten file's hash, so it still reads as untouched and `diff` shows it matching. A copy
  that was already edited keeps its recorded hash and stays edited.
- **One line per change.** `ui add` inserts a line, `ui update` replaces that line, and `ui remove`
  deletes it; the only other lines that change are those of copies whose imports the rewrite
  repointed, so a diff and a review show exactly the components touched.
- **Sorted.** Lines are kept sorted by `kind` then `name`, so the file is deterministic. Two
  branches that add components next to each other in that order still conflict, as adjacent
  lines do in any merge; the conflict holds two whole entries, resolved by keeping both.
- **Reading.** The file is read and written through `@sdxc/jsonl` (ADR-139). Each non-blank line
  is parsed as JSON and validated against the entry schema, exported as `sdxc/lock.schema.json`.
  A line that does not parse or validate, and a second line for the same `kind` and `name` (left
  behind by a merge), is an error naming the line number; the CLI changes nothing until it is
  fixed. A line whose `kind` the running CLI does not know is kept verbatim, so an older CLI
  preserves state a newer one wrote.
- **Writing.** The CLI writes `\n`-terminated lines with keys in the order above, and a final
  newline.
- **Location.** `lock` is a path relative to the project root and must stay inside it; the CLI
  creates its parent folders on the first write. Changing `lock` does not move the file: when the
  configured path is missing and a lock file exists at the default path, the CLI stops and names
  both, so a project never starts a second, empty state file beside its real one.

## Consequences

### Positive

- **Owned components.** An app takes a component's source when it needs to change it, its
  imports follow the copy without hand edits, and `ui list`/`ui update` show which copies have
  fallen behind.
- **Version-matched copies.** A copy comes from the installed `sdxc`, so it matches the helpers
  and `@sdxc/u` it imports.
- **Reviewable state.** Each command changes one line per component in the lock file.

### Negative

- **The CLI edits files the user wrote.** `ui add` and `ui remove` edit import declarations
  across the project; `--dry-run` shows the diff first.
- **Two files to commit.** A project that vendors components commits the lock file, under
  `.config/` beside its configuration unless `lock` moves it.

### Neutral

- Copied components carry the original module header and the MIT license terms.

## Implementation Plan

Depends on `@sdxc/codemod` (ADR-137), `@sdxc/jsonl` (ADR-139) and the CLI configuration
(ADR-136).

1. `@sdxc/ui`: the `./*` component subpath and `glyph-edges` in the utils barrel.
2. The lock file and `lock.schema.json`.
3. Registry generation in the release build, `changedIn` included.
4. `list`, `add` with `--with-deps`, `diff`, `update`, `remove`, and the app-wide import rewrite.

## Alternatives Considered

### 1. A remotely hosted component registry

Serve registry entries from the documentation site, as shadcn does.

**Rejected because**: a copy could come from a different release than the installed `@sdxc/u`,
and `ui add` would need the network.

### 2. `sdxc ui <component>` as the only command

**Rejected because**: listing, diffing, updating and removing copies are operations on the same
noun, and a bare component argument leaves no room for them.

### 3. Vendoring helpers alongside components

Copy the styles, utils, mixins and behaviors a component imports along with it.

**Rejected because**: helpers are shared by many components, so a copied helper forks behavior
the app's other components still take from the package.

### 4. Copying only, leaving the app's imports to the user

**Rejected because**: until every import is edited by hand, the app renders the package's
component in some places and the copy in others.

### 5. Recording copies in the configuration file

**Rejected because**: writing JSONC back with `JSON.stringify` drops the user's comments and
layout, so each `ui add` would erase what the user wrote.

### 6. The lock file as one JSON document

**Rejected because**: a nested document reformats around every change and every addition edits
the same object; a line per entry keeps each change to one line.

## References

- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-139: `@sdxc/jsonl` Package](./ADR-139-jsonl-package.md)
- [shadcn CLI](https://ui.shadcn.com/docs/cli)

## Current Progress

- [x] `@sdxc/ui` component subpaths: `./*` and `glyphEdges` in `@sdxc/ui/utils`; the umbrella
      exposes `sdxc/ui/<name>`
- [x] Lock file: `packages/kit/src/lock.ts`, `@sdxc/kit/lock.schema.json` generated with the
      umbrella
- [x] Registry in the release build: `scripts/release/ui-registry.ts`, written into the staged
      `@sdxc/kit` package, `changedIn` from the earliest release tag containing the latest commit
- [x] `sdxc ui` commands and the import rewrite: `packages/kit/src/ui/`
