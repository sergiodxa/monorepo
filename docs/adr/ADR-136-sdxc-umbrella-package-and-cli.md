# ADR-136: `sdxc` Umbrella Package and CLI

## Status

**Accepted** - 2026-10-15

> Superseded for the umbrella itself by [ADR-183](./ADR-183-drop-sdxc-umbrella.md): npm refused
> the unscoped `sdxc` name permanently, so `packages/sdxc` is deleted. The command line remains
> `@sdxc/kit` ([ADR-148](./ADR-148-sdxc-kit-cli-package.md)).

## Background

The monorepo publishes 116 packages under the `@sdxc` scope (ADR-007). A consumer building an app
on them installs each one by name and keeps every pin on the same release date by hand, since the
packages depend on each other with exact pins and a mixed install duplicates them.

`remix` solves the same problem for its `@remix-run/*` packages with one package whose subpaths
re-export the others (`remix/data-schema` is `export * from '@remix-run/data-schema'`) and which
carries the `remix` CLI. The unscoped `sdxc` name is free on npm. This ADR records the decision to
publish an equivalent `sdxc` package: an auto-generated export map over every `@sdxc/*` package,
and the `sdxc` CLI with its project configuration. Each command group has its own ADR:
`sdxc ui` (ADR-141), `sdxc create` (ADR-142), `sdxc make` (ADR-143) and `sdxc upgrade` (ADR-144).

## Context

### What the packages ship

| Fact                               | Detail                                                                                                                                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export subpaths                    | 361 across 116 packages                                                                                                                                                                              |
| Third-party runtime dependencies   | `remix` (54 packages, pinned exactly to `3.0.0`), `@standard-schema/spec` (types), `@remix-run/data-schema`, `jose`, `linkedom`, `@pitlane/assets`, `@remix-run/ui`                                  |
| Existing peer dependencies         | `remix` (8 packages, exact pin, optional), `vitest` and `@cloudflare/workers-types` (optional), `typescript` (`@sdxc/jsdoc`, required), plus a few `@sdxc/*` integrations (`authz`, `flags`, `jobs`) |
| Entry points with a default export | 11, among them `i18n/middleware`, `mail/middleware`, `jobs/cloudflare`, `http/response`, `lazy-frame/ui`                                                                                             |
| Non-JavaScript export targets      | `ui/reset.css`, `ui/theme.css`, `u/theme.css`, `highlight/styles.css`                                                                                                                                |
| Wildcard subpaths                  | `@sdxc/u` exposes thirteen patterns (`./color/*`, `./layout/*`, ...)                                                                                                                                 |
| Conditional targets                | `cloudflare-mocks/sqlite` resolves `bun` and `default` to different files                                                                                                                            |
| Packages with a `bin`              | `@sdxc/spec` (`spec`)                                                                                                                                                                                |

### How releases already behave

- `scripts/release/workspace.ts` counts every `@sdxc/*` name under `dependencies` or
  `peerDependencies` as an internal dependency, and `closeOverDependents` republishes every
  dependent of a changed package so its pins move to the new date.
- `scripts/release/manifest.ts` rewrites every `workspace:` range, peers included, to the exact
  version shipping in that release.
- The release tooling and `test/public-packages.test.ts` assume a package is named
  `@sdxc/<dir>`; the published `homepage` is `https://sdxc.dev/api/<dir>`.

### How a consumer meets `remix`

A consumer's app imports `remix/*` itself (`remix/component`, `remix/fetch-router`), so it lists
`remix` in its own `package.json`. A package that lists `remix` under `dependencies` gets its own
nested copy whenever the consumer's version differs from the package's exact pin, and Remix's
context keys and `instanceof` checks then stop matching between the app and the package.

### How peers install

npm 7 and later, Bun and pnpm install a non-optional peer dependency automatically when the
consumer does not list it. An umbrella that depends on every package therefore installs every
required peer those packages declare.

## Decision

Add `packages/sdxc`, published as the unscoped `sdxc`, with two parts: a generated export map and
a handwritten CLI.

### 1. Export map

Every export subpath of every public `@sdxc/<dir>` package, apart from the excluded ones, is
exposed as `sdxc/<dir><subpath>`:

| `@sdxc/*` specifier          | `sdxc` specifier            |
| ---------------------------- | --------------------------- |
| `@sdxc/markdown`             | `sdxc/markdown`             |
| `@sdxc/markdown/plugin/lint` | `sdxc/markdown/plugin/lint` |
| `@sdxc/u/color/*`            | `sdxc/u/color/*`            |
| `@sdxc/ui/reset.css`         | `sdxc/ui/reset.css`         |

- **Dependencies.** `sdxc` lists every exposed package under `dependencies` as `workspace:*`, so
  the release pins each one to the version shipping that day. A consumer's `bun add sdxc` installs
  them all; a bundle carries only the subpaths it imports.
- **Generated sources.** A generator writes one module per subpath under `src/`, headed as
  auto-generated: `export * from "@sdxc/<dir><subpath>"`, plus `export { default } from …` when
  the target has a default export. A stylesheet becomes a CSS file whose only rule is
  `@import "@sdxc/<dir>/<file>"`.
- **Wildcards become files.** An `exports` target must point inside its own package, so a
  wildcard subpath cannot forward to another package's pattern. The generator expands each
  wildcard against the files the target package matches, writes one module per match, and maps
  the pattern onto them (`"./u/color/*": "./src/u/color/*.ts"`).
- **Conditions are kept.** A conditional target generates one module per condition, mapped
  under the same conditions.
- **Committed, with a drift test.** The generated files and the `exports` map are committed, so
  the workspace resolves `sdxc/*` without a build. A root test regenerates into memory and fails
  when the committed copy differs, including when a wildcard target gains or loses a file. The
  regeneration is its own commit, `feat(sdxc): expose sdxc/<dir>` or
  `feat(sdxc): expose sdxc/u/color/<name>`, which keeps commits inside one workspace and gives the
  `sdxc` release notes a line per addition.
- **Excluded packages.** The generator reads an exclusion list; a package on it is neither
  exposed nor a dependency of `sdxc`. A package joins it when it is used only in a test or build
  step, or when it declares a required peer that would install a toolchain into every consumer.
  The list starts with:
  - `@sdxc/cloudflare-mocks`, test doubles for Cloudflare bindings;
  - `@sdxc/spec`, a test runner with its own `bin`;
  - `@sdxc/jsdoc`, whose required `typescript` peer would install TypeScript for every consumer;
    it leaves the list once that peer is optional.

Releases need no new step: `sdxc` depends on every exposed package, so `closeOverDependents`
republishes it whenever one ships, and `sdxc@2026.10.14` always pins the `2026.10.14` set.

### 2. `remix` is a peer everywhere

Every package that imports `remix` lists it under `peerDependencies` with the exact pin it lists
today, and under `devDependencies` for its own tests; `sdxc` lists the same peer. The consumer's
own `remix` is then the only copy: an install with a different version fails with a peer conflict
instead of nesting a second copy. `sdxc create` (ADR-142) pins `remix` beside `sdxc`, and
`sdxc upgrade` (ADR-144) moves both together. Bumping `remix` across the packages is a
`chore(deps)` sweep, the accepted exception to one-workspace commits.

### 3. CLI

`sdxc` declares `"bin": { "sdxc": "./src/sdxc.ts" }`, built to `dist/` like `@sdxc/spec`'s. It
runs on Node and Bun.

- **Offline and version-matched.** What a command writes (components, templates, stubs) ships in
  the `sdxc` tarball, so it matches the `@sdxc/*` versions installed beside it. Only
  `create --template org/repo` and `upgrade` use the network.
- **Project root.** Every command works from the nearest directory at or above the current one
  that holds a `package.json`; `.config/` and every configured path are relative to it, and a
  configured path must stay inside it.
- **Edits through `@sdxc/codemod`.** Every command that edits existing files rewrites them through
  `@sdxc/codemod` (ADR-137) and accepts `--dry-run`, which prints the diff instead and runs
  nothing else.
- **Commands.** `sdxc init` (below), `sdxc ui` (ADR-141), `sdxc create` (ADR-142), `sdxc make`
  (ADR-143) and `sdxc upgrade` (ADR-144). Adding a command group is its own ADR; adding a flag or
  a subcommand to one is a routine change.

#### Configuration

The configuration is written by the user and only read by the CLI, so comments and layout always
survive. Anything the CLI records goes in a separate state file (ADR-141).

- **One format, JSONC,** read through `@sdxc/jsonc` (ADR-138): comments for the user, `$schema`
  for the editor, and the format `tsconfig.json` and `wrangler.jsonc` already use.
- **Location.** The CLI reads `.config/sdxc.jsonc`, else `sdxc.jsonc` at the project root. When
  both exist, it stops and names them.
- **Every key is optional.** A project with no configuration file works with the defaults, and
  `sdxc init` writes them out.
- **Keys belong to commands.** This ADR defines `format`; `ui.*` and `lock` are defined in
  ADR-141, `make.*` in ADR-143. Every key lives in the one schema below.

| Key      | Default | Meaning                                                                                   |
| -------- | ------- | ----------------------------------------------------------------------------------------- |
| `format` | none    | Command run once on every file a command wrote or edited, the paths appended as arguments |

- **`format` runs without a shell.** It is an argument list, run once per command after every
  write, with the written and edited paths appended. A non-zero exit is reported and leaves the
  files as written; `--dry-run` never runs it, so its diff shows the CLI's own output. Anything a
  command records about a file it wrote is computed after `format` runs.
- **Inferred from the project, not configured:** the package manager, from the lockfile or
  `package.json`'s `packageManager`, for the next steps and installs the CLI runs or prints.
- **Schema.** The configuration is defined once with `@sdxc/json-schema`, each key with its
  default and a description: the CLI validates the parsed file with it, reports each failing key
  with its path, and fills in the defaults; `sdxc init` renders it; and the build emits it as
  JSON Schema 2020-12 to `config.schema.json`, exported as `sdxc/config.schema.json`. The file
  is committed with the generated export map and covered by the same drift test.

#### `sdxc init`

Writes `.config/sdxc.jsonc` with every default spelled out, so a project gets the file, the
editor completion its `$schema` brings, and a place to change a default without looking any of it
up.

```jsonc
// .config/sdxc.jsonc
{
	"$schema": "../node_modules/sdxc/config.schema.json",
	"ui": {
		// Where `sdxc ui add` writes components
		"directory": "resources/components/ui",
		// Import prefix for the copies; inferred from tsconfig `paths` when omitted
		// "alias": "~/components/ui",
		// Copy a component's tests beside it
		"tests": false,
	},
	"make": {
		// Route contract `sdxc make controller` adds to, a module in routes/
		"routes": "web",
		// Migration chains by name; `--chain <name>` picks one
		"migrations": { "default": "database/migrations" },
		// Write a test beside every generated file except migrations and factories
		"tests": true,
		// Stubs here replace the built-in ones; `sdxc make stubs` copies them out
		"stubs": ".config/sdxc/stubs",
	},
	// Command run on every file the CLI writes or edits, paths appended
	// "format": ["bunx", "vp", "fmt"],
	// Where the CLI keeps its state; commit it with the project
	"lock": ".config/sdxc.lock.jsonl",
}
```

- **Rendered from the schema.** Each key's value is its default and its comment is its
  description, taken from the same definition the CLI validates with; a key with no default, such
  as `ui.alias` and `format`, is written commented out with an example. A key added to the schema
  appears in `init`'s output with no change to `init`.
- **Never overwrites.** When either configuration location already holds a file, `init` names it
  and writes nothing.
- **Configuration only.** The lock file is created by the first command that records state.
- **The same file `create` ships.** The built-in templates' `.config/sdxc.jsonc` is `init`'s
  output with `format` set to `["bunx", "vp", "fmt"]`, since every built-in template checks with
  Vite+ and `@sdxc/codemod` leaves inserted code for the project's formatter (ADR-137); a test
  renders it and compares, so a new key reaches new projects without editing a template, and
  another runs the template's own format check after `make` edits an initializer.

### 4. Imports in this repo and in documentation

- **A project that depends on `sdxc` imports only `sdxc/*`** for these packages and lists no
  `@sdxc/*` package of its own, beside `remix`, which it lists itself. Every package arrives
  through `sdxc` at the versions that release pins, so a project never holds two copies of one
  package, and upgrading is one version to move.
- Apps in this repo keep importing `@sdxc/*`, so each app's `package.json` lists what it uses.
  The documentation site switches to `sdxc/*` and is the in-repo consumer the package is
  verified against.
- Packages never import `sdxc`; it depends on all of them.
- READMEs, the documentation site and blog posts show `sdxc/*` first and mention `@sdxc/*` as the
  per-package install.

### 5. One workspace per name

`apps/sdxc` becomes `apps/sdxc-site`, its package `@apps/sdxc-site`, matching its ADR folder
`docs/adr/sdxc-site/`. The commit scope `sdxc` then names only the package, so release notes,
`changelog.jsonl` and a reader of `git log` never have to tell the two apart.

## Consequences

### Positive

- **One install, one version.** `bun add sdxc remix` brings a matched set; upgrading is one bump
  of each.
- **One copy of `remix`.** A version mismatch fails at install instead of splitting context keys
  at runtime.
- **No release work.** Pinning and republishing come from the existing dependency closure.
- **One configuration format,** with comments, editor validation and completion.

### Negative

- **Install size.** Every exposed package, `linkedom` and `jose` included, lands in
  `node_modules` for a consumer who uses three of them. Bundles are unaffected.
- **Mixing is unsupported.** A project that adds an `@sdxc/*` package beside `sdxc` can get two
  instances of it, and context keys and `instanceof` checks stop matching between them. The
  documentation says so, and `sdxc upgrade` reports any `@sdxc/*` dependency it finds.
- **Consumers of a single `@sdxc/*` package install `remix` themselves,** as a peer, where today
  it arrives as a dependency.
- **A second commit per new package or wildcard file**, to expose it through `sdxc`.
- **A daily `sdxc` release** whenever any exposed package ships, so its version history is long.
- **Release tooling assumes the scope.** `test/public-packages.test.ts`, the docs `homepage` and
  `release:bootstrap` need to accept a package whose name is not `@sdxc/<dir>`.
- **Renaming `apps/sdxc`** touches its deploy workflow, Worker configuration and docs.

### Neutral

- Excluded packages stay published on their own and installable as `@sdxc/*`.

## Implementation Plan

### Phase 1: Package and export map

1. Rename `apps/sdxc` to `apps/sdxc-site`.
2. Move `remix` to `peerDependencies` (and `devDependencies`) in every package that imports it.
3. Teach the release tooling and `test/public-packages.test.ts` about the unscoped package.
4. Write the generator, with wildcard expansion, conditions and the exclusion list, and the drift
   test; generate `packages/sdxc`.
5. Add README, `LICENSE.md`, root README row and docs-site group; bootstrap `sdxc` on npm and
   configure its trusted publisher.
6. Move the documentation site to `sdxc/*`.

### Phase 2: CLI and configuration

1. `bin`, project root, configuration lookup and validation, `config.schema.json`, `format`.
2. `sdxc init`.

## Alternatives Considered

### 1. Every package as an optional peer dependency

Bun, npm and pnpm skip optional peers on install, so `import "sdxc/markdown"` fails until the
consumer also installs `@sdxc/markdown`, which makes `sdxc` a second name for a package the user
already installs. The release pins peers exactly, so with a version per day the consumer's own
`@sdxc/*` installs would warn or conflict on nearly every upgrade; a looser range lets the
installed code drift from the types `sdxc` was built against.

**Rejected because**: the consumer installs everything twice over and still manages versions.

### 2. Re-exporting `remix` through `sdxc`

Expose `sdxc/remix/component` and the rest, and let `sdxc` own the only `remix` dependency.

**Rejected because**: every Remix guide, the blog's tutorials and Remix's own documentation import
`remix/*`, so a consumer would hold two spellings of every Remix import, and an app that also
lists `remix` itself would still get two copies.

### 3. Generating the export map only at release time

**Rejected because**: `sdxc/*` would not resolve inside the workspace, so nothing in the repo
could import it before publishing.

### 4. JSON and YAML configuration beside JSONC

**Rejected because**: `create` and the documentation write JSONC only, so the other formats would
exist for users who choose them, at the cost of a YAML parser in the CLI, two more lookup names
per location, an ambiguity error and three `init` renderers.

## Deferred

- `sdxc doctor`, reporting installed `@sdxc/*` packages from different release dates. Decided in
  [ADR-160: `sdxc doctor`](./ADR-160-sdxc-doctor.md).

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-017: README Package Description Source of Truth](./ADR-017-readme-package-description-source-of-truth.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-138: `@sdxc/jsonc` Package](./ADR-138-jsonc-package.md)
- [ADR-141: `sdxc ui` Component Vendoring](./ADR-141-sdxc-ui-component-vendoring.md)
- [ADR-142: `sdxc create` Templates](./ADR-142-sdxc-create-templates.md)
- [ADR-143: `sdxc make` Generators](./ADR-143-sdxc-make-generators.md)
- [ADR-144: `sdxc upgrade`](./ADR-144-sdxc-upgrade.md)
- [`remix` on npm](https://www.npmjs.com/package/remix)
- [Node.js package exports: subpath patterns](https://nodejs.org/api/packages.html#subpath-patterns)

## Current Progress

- [x] Phase 1: Package and export map
  - [x] Rename `apps/sdxc` to `apps/sdxc-site`
  - [x] `remix` as a peer dependency of every package that imports it
  - [x] Release tooling and `test/public-packages.test.ts` accept the unscoped `sdxc`
  - [x] Generator (`bun run sdxc:generate`) with wildcard expansion, conditions, stylesheets
        and the exclusion list; drift test in `test/sdxc-umbrella.test.ts`; `packages/sdxc`
        generated
  - [x] README, `LICENSE.md`, root README row and docs-site group; npm refused the unscoped
        name, so the umbrella is private and the command line ships as `@sdxc/kit` (ADR-148)
  - [x] Documentation site on `sdxc/*`: the site's code, examples, catalogue snippets and
        guides import `sdxc/*`, guides install `sdxc remix`, a package page keeps its
        standalone `@sdxc/<name>` install and names its `sdxc/<name>` subpath, and
        `declare module` blocks keep naming `@sdxc/<name>`
- [x] Phase 2: CLI and configuration
  - [x] `bin`, project root, configuration lookup and validation, `config.schema.json`, `format`
  - [x] `sdxc init`
