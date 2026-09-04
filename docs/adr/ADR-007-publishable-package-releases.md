# ADR-007: Publishable Package Releases

## Status

**Accepted** - 2026-09-03

## Background

The monorepo holds 53 shared packages under `packages/*`. Every one is `private: true`, named `@pkg/*`, and exports raw TypeScript from `src/` through its `exports` map; apps and sibling packages consume them through Bun `workspace:*` ranges and compile the source themselves. The `@pkg` scope is not available on npm; the org available for publishing is `@sdxc`.

A proposal under this number, dated 2026-06-29, described a per-package publish script with `yy.M.d-<hash>` versions, artifact hashing, and reuse of unchanged versions across days, and stayed at Proposed. Publishing is now wanted with requirements that change its core decisions: the version is the release date, the whole repository releases at most once per day, a scheduled GitHub Actions run decides what ships from the commits since the previous release, every public dependent of a changed package ships with it, and one tag plus one GitHub Release records the day. This revision replaces the June text in place; its hash-based scheme is recorded under Alternatives Considered.

## Context

### What Exists Today

| Item                                 | State                                                                                                                                                                                                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages under `packages/*`          | 53, every one `private: true` with `version: "0.0.1"`; `exports` and `bin` targets are `./src/*.ts(x)` files plus a few `.css` files                                                                                                            |
| Package names                        | `@pkg/*`; the npm org is `@sdxc`, and every `@sdxc/*` name returns `E404`                                                                                                                                                                       |
| Internal dependencies                | `workspace:*` ranges resolved by Bun                                                                                                                                                                                                            |
| Relative imports in `packages/*/src` | 2,991 extensionless specifiers across 790 files                                                                                                                                                                                                 |
| Compilation                          | Done by each consumer: Vite for the apps, Vitest for tests, Bun for scripts                                                                                                                                                                     |
| Git tags                             | The tag list is empty; the `v*` namespace is free                                                                                                                                                                                               |
| Package metadata                     | `description` is absent from every manifest, and [ADR-017](./ADR-017-readme-package-description-source-of-truth.md) makes the README's first paragraph its source; `LICENSE.md` is present in 51 packages, with `sample` and `spec` lacking one |
| `packages/oidc-provider`             | Imports SQL migrations with Vite's `?raw` suffix, which resolves under Vite alone                                                                                                                                                               |
| Root configuration                   | `devEngines.packageManager` pins `bun` 1.4.0 with `onFail: "download"`; `tsconfig.json` sets `types: ["@total-typescript/ts-reset", "bun"]` and every package extends it; `vp check` already type-checks `scripts/`                             |

### Verified Constraints

Each row was checked by running the command in question, and each shapes one decision below.

| Constraint                                                                                                                                                                                                           | Effect on the design                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm granular access tokens expire within 90 days, and tokens that bypass 2FA lose direct publishing in 2027-01                                                                                                       | Authentication is OIDC trusted publishing, with a credential minted per run                                                                                                                                                                                                            |
| A trusted publisher can be configured only for a package that already exists on npm                                                                                                                                  | The first version of every package is published by a person, from a bootstrap script                                                                                                                                                                                                   |
| Node strips types only for files outside `node_modules`, and has no `.tsx` support                                                                                                                                   | Published packages ship JavaScript and declaration files                                                                                                                                                                                                                               |
| `bun publish` uploads the manifest as written; overriding `exports` from `publishConfig` is a pnpm feature                                                                                                           | The publish manifest is generated into a staging directory                                                                                                                                                                                                                             |
| npm refuses to run inside a repository whose `devEngines.packageManager` names another package manager (`EBADDEVENGINES` for `view`, `publish`, `login` and `whoami` alike), and Bun reads the field for nothing yet | The root manifest lists npm beside the pinned Bun entry, which npm accepts and Bun ignores, so every registry command runs from the repo root; `publish` runs from the staged package because npm packs its cwd                                                                        |
| A generated `tsconfig.json` placed outside the repository fails to resolve the root `types` entries                                                                                                                  | The build calls the TypeScript compiler API on each package's own `tsconfig.json` and overrides options in memory. Checked with `--explainFiles`: workspace dependencies reached through `node_modules/@sdxc/*` resolve as external modules, stay out of the emit, and raise no TS6059 |
| npm stamps `gitHead` only when it finds `.git` above the packed directory                                                                                                                                            | The manifest sets `gitHead` to the HEAD sha explicitly                                                                                                                                                                                                                                 |
| 2,991 relative imports are extensionless                                                                                                                                                                             | Every relative specifier in `packages/*/src` gains `.js`, so plain compiler output is valid Node ESM                                                                                                                                                                                   |

## Decision

Publish a curated set of packages to npm under `@sdxc`, as one dated release per day. A scheduled GitHub Actions run reads the commits since the previous release, builds the packages they touched together with every public dependent, publishes them through OIDC trusted publishing, and records the day as a tag and a GitHub Release whose notes are those commits. Local development, the apps and the test suite keep running TypeScript source; the build exists for published artifacts alone. The pieces are the release script in `scripts/release/`, two repository guards under `test/`, the workflow `.github/workflows/release.yml`, and commit conventions in `AGENTS.md`.

### Namespace

Every workspace package is renamed from `@pkg/*` to `@sdxc/*`: manifests, dependency declarations, import specifiers, tool aliases, the `create-app` and `create-package` skills, guides, `AGENTS.md` and `README.md`. Internal dependencies keep their `workspace:*` ranges. Historical ADRs under `docs/adr/**` keep the name they were written with, following the convention of [ADR-032](./ADR-032-kv-cache-package-rename.md) and [ADR-045](./ADR-045-icons-package-rename.md); vendored documentation under `docs/vendor/**` is third-party text and stays as published.

### Publishable Set

Removing `private: true` from a manifest is what makes a package public. The starter set is the dependency closure of `@sdxc/spec`, eight packages:

| Package          | Internal dependencies                |
| ---------------- | ------------------------------------ |
| `@sdxc/types`    | —                                    |
| `@sdxc/result`   | `types`                              |
| `@sdxc/duration` | `result`                             |
| `@sdxc/crypto`   | `result`                             |
| `@sdxc/dates`    | `duration`, `result`                 |
| `@sdxc/jwt`      | `duration`                           |
| `@sdxc/sample`   | `crypto`, `dates`, `duration`, `jwt` |
| `@sdxc/spec`     | `duration`, `result`, `sample`       |

The other 45 packages stay private. `@sdxc/oidc-provider` stays private for as long as it imports SQL through Vite's `?raw` suffix.

A public package's transitive `dependencies` closure consists of public packages. `test/public-packages.test.ts` and the release script both walk that closure and report one line per offence, naming the package through which the private dependency is reached:

```
@sdxc/spec depends on private @sdxc/foo (via @sdxc/sample)
```

The fix is one of two edits: open `@sdxc/foo` or close `@sdxc/spec`. The guard also requires a `description`, a `README.md` and a `LICENSE.md` on every public package, and checks the root README package table: the row of a public package carries a check mark (U+2705) in an untitled third column, and the row of a private package leaves that cell empty. That column is the README's whole record of publication.

### Import Extensions

Every relative import specifier inside `packages/*/src`, tests included, ends in `.js`: `import { parse } from "./parse.js"`. TypeScript resolves the specifier to `parse.ts` or `parse.tsx` and keeps it as written on emit, so plain compiler output is valid Node ESM. `test/import-extensions.test.ts` scans `import … from`, `export … from`, `export * from`, side-effect imports, dynamic `import()` and `vi.mock()` calls over `packages/*/src/**/*.{ts,tsx}`, and fails on every relative specifier whose last path segment lacks an extension.

### Version And Cadence

The version is the UTC date at the start of the run, written `YYYY.M.D` with month and day as plain integers, the form SemVer numeric identifiers take. It is computed once per run and shared by every package published that day.

| Item                             | Value on 2026-09-04    |
| -------------------------------- | ---------------------- |
| Package version                  | `2026.9.4`             |
| Git tag                          | `v2026.9.4`            |
| GitHub Release title             | `2026.9.4`             |
| `version` in workspace manifests | `0.0.1`, a placeholder |

At most one release happens per day. The dated version exists only in the generated publish manifest, so a release leaves the repository's working tree and history exactly as they were; its writes go to npm, the tag and the Release.

### Change Detection

The previous release is the highest `v*` tag by SemVer order. The run proceeds as follows:

1. With an empty tag namespace, every public package is new.
2. When the tag points at HEAD and every public package is already on npm, the run exits 0 with `no commits since v2026.9.3`.
3. Otherwise `git log <tag>..HEAD --name-only` yields each commit with the paths it touched.

A commit touches a package when one of its paths is a shipped input of that package:

| Shipped input                     | Paths                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Source                            | `packages/<dir>/src/**`, excluding `*.test.ts` and `*.test.tsx`                |
| Manifest and build config         | `packages/<dir>/package.json`, `packages/<dir>/tsconfig.json`                  |
| Documentation                     | `packages/<dir>/README.md`, `packages/<dir>/LICENSE.md`                        |
| Export targets outside TypeScript | Every `exports` target other than a `./src/*.ts(x)` file, such as `styles.css` |
| Root TypeScript config            | `tsconfig.json`, which touches every public package                            |

Touched paths are the ground truth for attribution. With the one-workspace-per-commit convention they agree with the commit scope, and they also catch `chore(deps)` sweeps that edit many manifests at once.

A package is new when its latest version on npm is absent or is a `0.0.0-pre.*` bootstrap version. The lookup is `npm view <name> --json` with `cwd` in the temp dir: `E404` means absent, and every other error aborts the run. `--force` marks every public package as touched, which also carries the run past the tag-at-HEAD exit.

### Cascade

The release set is the touched and new packages, closed over their transitive dependents through `dependencies` and restricted to public packages. The closure follows `dependencies` alone; `devDependencies` stay a workspace concern. The set is ordered topologically, dependencies first; a cycle is an error.

Internal dependencies are pinned exactly in the publish manifest: today's version for members of the set, otherwise the dependency's latest version on npm. This is why dependents republish: their pin has to move to the new version. When `@sdxc/sample` changes on 2026-09-04, `@sdxc/spec` republishes with `"@sdxc/sample": "2026.9.4"` beside `"@sdxc/result": "2026.9.1"`, the latest `@sdxc/result` on npm.

### Same-Day Rules

| Situation                                                                                                 | Behaviour                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Tag `v<today>` exists                                                                                     | Exit 0; today's release is done and later commits ship tomorrow                                                 |
| A package is already at today's version and `git diff --quiet <gitHead> HEAD -- <shipped paths>` is clean | Skip it as published, the state a rerun after a partial failure finds                                           |
| A package is already at today's version and the diff reports changes                                      | Fail before any publish with `@sdxc/<name> changed after today's publish; rerun tomorrow`                       |
| `GITHUB_ACTIONS` is set and a package is absent from npm                                                  | Fail before any publish with `run bun run release:bootstrap @sdxc/<name>, then configure its trusted publisher` |

Every check in this table runs before the first `npm publish`.

### Build

Each package is compiled with the TypeScript compiler API from its own `tsconfig.json`, with four options overridden in memory:

```ts
let parsed = ts.getParsedCommandLineOfConfigFile(
	join(pkg.dir, "tsconfig.json"),
	{
		noEmit: false,
		declaration: true,
		outDir: join(staging, "dist"),
		rootDir: join(pkg.dir, "src"),
	},
	host,
);
let program = ts.createProgram(parsed.fileNames.filter(isShippedSource), parsed.options);
let { diagnostics } = program.emit();
```

Test files are dropped from `fileNames` before the program is created, and any diagnostic from the config, the program or the emit fails the build. The emit mirrors `src/` under `dist/`: `src/data/en.ts` becomes `dist/data/en.js` and `dist/data/en.d.ts`. Workspace dependencies are reached through `node_modules/@sdxc/*`, which the compiler treats as external modules: they type-check and stay out of the emit. A post-build assertion reads every emitted `.js` and `.d.ts` file and rejects any specifier containing `/src/` or `../../`, so each published file imports either a bare package name or a path inside its own `dist/`.

### Publish Manifest

The workspace manifest stays as written; a publish manifest is generated into staging from it.

| Field                                                                 | Rule                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private`, `scripts`, `devDependencies`                               | Dropped                                                                                                                                                                                                                                                               |
| `exports` and `bin` targets of the form `./src/X.ts` or `./src/X.tsx` | Rewritten to `./dist/X.js`, recursing into condition objects and `*` patterns; every other TypeScript-looking target is an error                                                                                                                                      |
| Other targets (`.css`, `.json`, …)                                    | Copied unchanged, and the file is staged at the same relative path                                                                                                                                                                                                    |
| `dependencies` on `workspace:*`                                       | Replaced by the exact pin from the Cascade section                                                                                                                                                                                                                    |
| Injected fields                                                       | `version` (today's), `gitHead` (the HEAD sha), `publishConfig.access` (`"public"`), and `repository` as `{ "type": "git", "url": "git+https://github.com/sergiodxa/monorepo.git", "directory": "packages/<dir>" }`, which the registry checks against the OIDC claims |
| Everything else                                                       | Copied as-is                                                                                                                                                                                                                                                          |

A composite workspace manifest with a bin, conditional and wildcard exports, one stylesheet and one internal dependency:

```json
{
	"name": "@sdxc/example",
	"version": "0.0.1",
	"private": true,
	"type": "module",
	"bin": {
		"example": "./src/cli.ts"
	},
	"exports": {
		".": "./src/index.ts",
		"./workers": {
			"workerd": "./src/workers.ts",
			"default": "./src/index.ts"
		},
		"./data/*": "./src/data/*.ts",
		"./styles.css": "./styles.css"
	},
	"scripts": {
		"typecheck": "tsc --noEmit"
	},
	"dependencies": {
		"@sdxc/result": "workspace:*",
		"jose": "^6.2.10"
	},
	"devDependencies": {
		"msw": "^2.15.0"
	}
}
```

Its publish manifest on 2026-09-04, with `@sdxc/result` outside the set and last published as `2026.9.1`:

```json
{
	"name": "@sdxc/example",
	"version": "2026.9.4",
	"type": "module",
	"bin": {
		"example": "./dist/cli.js"
	},
	"exports": {
		".": "./dist/index.js",
		"./workers": {
			"workerd": "./dist/workers.js",
			"default": "./dist/index.js"
		},
		"./data/*": "./dist/data/*.js",
		"./styles.css": "./styles.css"
	},
	"dependencies": {
		"@sdxc/result": "2026.9.1",
		"jose": "^6.2.10"
	},
	"gitHead": "<sha of HEAD>",
	"publishConfig": {
		"access": "public"
	},
	"repository": {
		"type": "git",
		"url": "git+https://github.com/sergiodxa/monorepo.git",
		"directory": "packages/example"
	}
}
```

TypeScript finds `./dist/index.d.ts` beside `./dist/index.js` through its standard `.js` to `.d.ts` substitution, so a plain string target serves both runtime and types. Staging holds this manifest, `README.md`, `LICENSE.md`, every non-TypeScript export target at its relative path (`styles.css` here), and `dist/`. Validation asserts that every rewritten target exists in staging and that the finished manifest is free of `workspace:` ranges and of `private`.

### Publishing

Every member of the set is built before the first publish, so a compile error stops the run ahead of any upload. Publishing then follows the topological order with `npm publish` and `cwd` set to the package's staging directory; dry-run mode appends `--dry-run` and takes the same code path. Under OIDC the registry attaches provenance to each version on its own.

An `E401` or `E404` at publish time is reported with the package name and the trusted-publisher fields to check on npmjs.com: provider GitHub Actions, organization `sergiodxa`, repository `monorepo`, workflow `release.yml`. Packages published before such a failure are at today's version with a clean `gitHead`, so the next run skips them and continues from the failure.

### Release Notes

Notes come from the same commit range. Packages appear in alphabetical order, commits oldest first:

```
## @sdxc/jwt
- feat: add ES512 signing keys
	Body paragraphs of the commit, indented with a tab.
- fix: reject tokens whose `exp` already passed

## @sdxc/spec
Republished because `@sdxc/sample` changed.

## @sdxc/xml
First release.
```

| Input                                       | Rendering                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `type(scope): title`, `type(scope)!: title` | `- type: title`, `- type!: title`                                                                                 |
| Commit body                                 | Paragraphs indented with a tab under the entry; git trailers such as `Co-Authored-By:` are dropped                |
| A commit touching several packages          | Listed under each of them                                                                                         |
| A member reached through the cascade alone  | `Republished because \`@sdxc/<dependency>\` changed.`                                                             |
| A touched member with no commit in range    | `Republished.`, the case `--force` produces                                                                       |
| A new package with no commit in range       | `First release.`; a new package with commits lists them like any other                                            |
| Footer                                      | A compare link, `https://github.com/sergiodxa/monorepo/compare/v2026.9.3...v2026.9.4`, once a previous tag exists |

`gh release create v<version> --target <sha> --title <version> --notes-file <file>` creates the tag and the Release in one call, after every publish succeeded. A rerun that publishes nothing but finds no tag for today still creates the Release, so a failed `gh` call heals on the next run.

### Bootstrap Script

`bun run release:bootstrap [@sdxc/name …]` publishes a package's first version from an operator's machine. Called bare, it takes every public package absent from npm, in dependency order. For each package it:

1. Checks `npm whoami` for an operator session; `npm login` is run beforehand.
2. Refuses when any dated version exists, and skips when `0.0.0-pre.1` exists.
3. Builds and stages the package exactly as a release would, with `version: "0.0.0-pre.1"`. Internal pins take the dependency's latest npm version, which has to exist: dependencies bootstrap first, and a missing one is an error naming it.
4. Runs `npm publish --tag latest` from staging with the operator's session. npm requires an explicit tag for a prerelease version, and `latest` is the accurate one: the placeholder is the package's only version until the dated release replaces it.
5. Prints the trusted-publisher settings to enter under the package's settings on npmjs.com: provider GitHub Actions, organization `sergiodxa`, repository `monorepo`, workflow file `release.yml`, allowed action publish.

The next daily run sees the `0.0.0-pre.*` version, treats the package as new, and publishes the dated version, which becomes `latest`.

### Command Line

| Command                                    | Effect                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `bun run release`                          | Dry run: prints the plan, builds and stages every member, runs `npm publish --dry-run` for each, and previews the notes |
| `bun run release --publish`                | Publishes, then creates the tag and the GitHub Release                                                                  |
| `bun run release --force [--publish]`      | Marks every public package as touched before planning                                                                   |
| `bun run release:bootstrap [@sdxc/name …]` | Publishes `0.0.0-pre.1` from an operator session                                                                        |

The root manifest maps `release` to `bun scripts/release/main.ts` and `release:bootstrap` to `bun scripts/release/bootstrap.ts`. The script behaves identically on a developer machine and in CI.

### Workflow

`.github/workflows/release.yml` runs the same command on a schedule and on demand:

```yaml
name: Release

permissions:
  contents: write
  id-token: write

env:
  BUN_VERSION: 1.4.0

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:
    inputs:
      publish:
        description: "Publish to npm and create the release (unchecked = dry run)"
        type: boolean
        default: false
      force:
        description: "Treat every public package as changed"
        type: boolean
        default: false

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: bun install --frozen-lockfile
      - env:
          GH_TOKEN: ${{ github.token }}
        run: |
          flags=()
          if [[ "${{ github.event_name }}" == "schedule" || "${{ inputs.publish }}" == "true" ]]; then
            flags+=(--publish)
          fi
          if [[ "${{ inputs.force }}" == "true" ]]; then
            flags+=(--force)
          fi
          bun run release "${flags[@]}"
```

- `contents: write` creates the tag and the Release; `id-token: write` lets npm exchange the GitHub OIDC token for a publish credential; `fetch-depth: 0` gives the script every tag and the full commit range.
- `setup-node` is configured with `node-version` alone. Node 24 ships the npm the OIDC exchange requires (11.5.1 or later), and with `registry-url` absent the OIDC exchange is the single credential path.
- The `release` concurrency group queues a manual dispatch behind a scheduled run, and both complete. GitHub may start a scheduled run some minutes after 00:00 UTC; the version is computed at run start, on the same UTC day.
- The trusted-publisher entries name `release.yml`, so the workflow keeps its filename.

### Commit Conventions

These rules go into `AGENTS.md`, because commits are both the change detector and the release notes:

- A commit touches exactly one package or app; root and docs files may ride along.
- The scope is that workspace's directory name: `feat(jwt): …`, `fix(uptime): …`.
- The title says what changed for a consumer, and the body, when present, explains it. Both are published verbatim.
- Dependency sweeps (`chore(deps)`) are the accepted exception and appear under every package they touch.

## Consequences

### Positive

- **Versions read as dates** - `2026.9.4` says when a package shipped, versions across `@sdxc/*` line up by day, and the tag and Release carry the same number.
- **Every publish traces to commits** - a package publishes when the commit range touched it or a dependency, and its release notes list exactly those commits.
- **Credentials are minted per run** - the workflow authenticates with a GitHub OIDC token that npm verifies against the trusted-publisher entry, and provenance comes with it.
- **The build is confined to publishing** - apps, tests and scripts keep running TypeScript source; `dist/` exists in a temp directory for the length of a run.
- **Reruns are safe** - the tag check, the `gitHead` diff and the tag-less Release creation make a rerun after any failure pick up where the last one stopped.
- **Guards run in CI** - the import-extension and public-package tests fail a pull request long before a release run could.
- **Dependents stay coherent** - exact pins mean an installed dependent resolves the dependency version it was built against.

### Negative

- **Exact pins duplicate a dependency when a consumer mixes release dates** - installing `@sdxc/spec@2026.9.4` beside `@sdxc/jwt@2026.9.1` yields two copies of `@sdxc/duration` when their pins differ; upgrading both to the same day collapses them.
- **A new package needs a human** - its first version comes from an operator's session, followed by a trusted-publisher entry on npmjs.com, before the workflow can publish it.
- **Published packages pin `remix@3.0.0-rc.1` exactly** - workspace manifests pin that build and the publish manifest copies external ranges as written, so opening a Remix-dependent package publishes the exact pin and consumers on another build get a second copy.
- **A cross-workspace commit appears under every package it touched** - a `chore(deps)` sweep repeats its title in each section.
- **Changes to the root `tsconfig.json` republish every public package** - the file is a shipped input of all of them.
- **A day's release is closed once tagged** - a fix landing after the tag ships the next day.
- **The version says when, never what broke** - the `!` marker in the notes is the only breaking-change signal, so consumers read the notes before upgrading.
- **More tooling to own** - `scripts/release/` and its tests are first-party code with a registry, a compiler and two CLIs behind them.

### Neutral

- **Two manifests per package by design** - the workspace manifest keeps `./src/*.ts` targets and `workspace:*` ranges; the publish manifest is derived and validated on every run.
- **Repository version fields are placeholders** - `0.0.1` stays; the record of what shipped is on npm and in the `v*` tags.
- **Historical ADRs keep `@pkg/*`** - they record what was decided at the time; this ADR is the pointer from the old name to the new one.

## Implementation Plan

### Phase 1: Rewrite ADR-007

**Priority:** High

Record the decisions above in this document, and flip its status to Implemented when Phase 8 completes. Files: `docs/adr/ADR-007-publishable-package-releases.md`.

### Phase 2: Namespace Rename

**Priority:** High

Rename `@pkg/*` to `@sdxc/*` with a scripted replace over every file containing `@pkg/`, skipping `docs/adr/**`, `docs/vendor/**`, `node_modules` and `bun.lock`; then remove stale `node_modules/@pkg` symlinks, run `bun install` to regenerate the lockfile, and grep for any bare `@pkg` left. Commit: `refactor: rename the @pkg namespace to @sdxc`. Files: about 1,500 across `apps/`, `packages/`, `docs/guides/`, `.agents/skills/`, `AGENTS.md`, `README.md`, `vite.config.ts`, the root `package.json` and `bun.lock`.

### Phase 3: Import Extensions

**Priority:** High

Write the guard first: `test/import-extensions.ts` (a pure scanner) and `test/import-extensions.test.ts` (unit tests for the scanner, then a scan of `packages/*/src/**/*.{ts,tsx}`). Then a one-off codemod, kept out of the repository, rewrites each relative specifier by resolving `X.ts` or `X.tsx` to `X.js` and `X/index.ts(x)` to `X/index.js`, reporting anything it fails to resolve. Commit: `refactor(packages): give every relative import a .js extension`. Files: `test/import-extensions.ts`, `test/import-extensions.test.ts`, about 1,400 files under `packages/*/src`.

### Phase 4: Public-Package Guard, Manifests, README Column

**Priority:** High

Write `test/public-packages.ts` (the transitive private-dependency walk producing `{ package, private, via }` rows, plus the README-row check) and `test/public-packages.test.ts`. Remove `private: true` from the eight starter packages, add a `description` taken from each README's first paragraph, add `LICENSE.md` to `sample` and `spec`, and add the check-mark column to the root README package table. Commit: `feat(packages): open the spec dependency chain for publishing`. Files: `test/public-packages.ts`, `test/public-packages.test.ts`, eight `packages/*/package.json`, `packages/sample/LICENSE.md`, `packages/spec/LICENSE.md`, `README.md`.

### Phase 5: Release Tooling

**Priority:** High

Build `scripts/release/` test-first: pure modules for the workspace graph (`workspace.ts`: `readPackages`, `privateDependencies` shared with the guard, `closeOverDependents`, `topologicalOrder`), commit parsing and attribution (`commits.ts`), planning (`plan.ts`: `releaseVersion`, `isNew`, `planRelease` with reasons `new`, `changed`, `dependency` and the same-day conflicts), manifest generation (`manifest.ts`) and notes (`notes.ts`); thin wrappers for the compiler (`build.ts`), npm (`npm.ts`), git (`git.ts`) and GitHub (`github.ts`); and the two entry points `main.ts` and `bootstrap.ts`. Tests cover version formatting, commit parsing, attribution, `isNew`, planning (touched, new, cascade, private exclusion, conflict, force, empty, tag-at-HEAD), the private-dependency walk, topological order and cycles, manifest rewriting (string, conditional, wildcard, bin, `.css` untouched, dropped fields, pins, injected fields, leftovers), npm error parsing, notes rendering, and one integration test that builds `packages/types` and `packages/result` into a temp directory and imports the emitted `dist/index.js` under Node. Commit: `feat(release): build and publish changed packages as one dated release`. Files: `scripts/release/*.ts` and `scripts/release/*.test.ts`, the root `package.json` (`release`, `release:bootstrap`), `vite.config.ts` (the root project's `include` gains `scripts/**/*.test.ts`).

### Phase 6: Workflow

**Priority:** High

Add the workflow from the Decision; `ci.yml` stays as it is. Commit: `ci: release changed packages to npm daily`. Files: `.github/workflows/release.yml`.

### Phase 7: Living Docs And Rules

**Priority:** Medium

Update `AGENTS.md` with the commit conventions, the `.js`-extension rule for `packages/*`, the rule that `version` fields stay placeholders because releases are daily and automated, the steps that take a package public (remove `private: true`, add `description` and `LICENSE.md`, add the check mark, run `bun run release:bootstrap`, configure the trusted publisher), the rule that Vite-only packages stay private, and the rule that npm runs from outside the repository. Update the `create-package` skill rules to describe the publish model (exports keep pointing at `src`; the release script builds), and the `create-app` rules for names. Files: `AGENTS.md`, `.agents/skills/create-package/rules/minimum-package-files.md`, `.agents/skills/create-package/rules/exports-map-and-src-layout.md`, `.agents/skills/create-app/rules/*.md`.

### Phase 8: Bootstrap

**Priority:** High

With everything green and pushed, the `sdxc` org in place and `gh auth status` passing: `bun run release` lists eight new packages and dry-runs their publish; from a directory outside the repository, `npm login`, then `bun run release:bootstrap` publishes the eight packages at `0.0.0-pre.1`, dependencies first; on npmjs.com each package gets its trusted publisher (GitHub Actions, organization `sergiodxa`, repository `monorepo`, workflow `release.yml`, allowed action publish); a `workflow_dispatch` with `publish` unchecked proves the runner path, and the first dated release comes from the next 00:00 UTC run or from a dispatch with `publish` checked, making its versions `latest`. Files: the status line of this ADR, once the first dated release lands.

## Alternatives Considered

### 1. Date Plus Artifact Hash Versions

The 2026-06-29 draft of this ADR proposed `yy.M.d-<hash>` versions, where the hash covered the generated artifact, was stored as `sdxc.releaseHash`, and let an unchanged package keep an older version across days.

**Rejected because**: the hash made every version a SemVer prerelease that reads as noise, and reuse required comparing artifacts against npm for every package on every run. One release per day removes the need for intra-day uniqueness, and commit-range detection leaves unchanged packages unpublished with a version that reads as a date.

### 2. Changesets, semantic-release Or release-please

Each derives versions from changeset files or commit types and writes the resulting bumps back into the repository as commits or pull requests.

**Rejected because**: the version here is a date and the repository's version fields stay placeholders, so the bump-and-commit model these tools are built around is the part this design has no use for. Path-based selection with a dependency cascade over Bun workspaces is a few hundred lines of first-party code.

### 3. `vp pack` Or tsdown

Bundle each package with the toolchain already in the repository.

**Rejected because**: bundling flattens the file structure that wildcard exports such as `./data/*` and subpath exports rely on. Compiler emit mirrors `src/` under `dist/` with the package's existing `tsconfig.json` and nothing else.

### 4. Publishing Raw TypeScript

**Rejected because**: Node strips types only outside `node_modules` and has no `.tsx` support, so every Node consumer would fail at import time; Bun consumers alone would work.

### 5. JavaScript With JSDoc And Hand-Written `.d.ts`

**Rejected because**: it rewrites 790 files, drops the type-level features the packages use, and maintains two sources of truth for every type.

### 6. Caret Ranges For Internal Dependencies

**Rejected because**: with date versions a caret spans the rest of the year (`^2026.9.1` accepts `2026.12.31`), so an installed dependent could resolve a dependency built against a different API. Exact pins keep the pair that was built and tested together, and republishing dependents is how the pins move.

### 7. npm Token Authentication

**Rejected because**: granular tokens expire within 90 days and bypass-2FA tokens lose direct publishing in 2027-01, so a stored secret needs rotation on a calendar. Trusted publishing is configured once per package and mints a credential per run.

### 8. Per-Package `gitHead` Detection Against npm

Compare each public package's shipped paths against the `gitHead` of its latest npm version to decide what changed.

**Rejected because**: it costs one `npm view` and one diff per public package per run and yields no release notes. The commit range answers the same question once for the whole repository and is the notes; `gitHead` remains the same-day rerun check.

### 9. Publishing All 53 Packages On Day One

**Rejected because**: several packages rely on Vite-only imports, Cloudflare bindings or release-candidate pins, most lack a `description`, and each needs a bootstrap publish and a trusted-publisher entry. The starter set proves the pipeline on a chain with a `bin`, subpath exports and four levels of internal dependencies.

### 10. Notes From Commit Scopes Alone

Attribute each commit to the package its scope names.

**Rejected because**: touched paths are what decides what publishes, and using them for the notes keeps both in agreement. A `chore(deps)` sweep or a commit that strays across workspaces lands under every package it changed instead of under one scope or none.

## Current Progress

- [x] Phase 1: Rewrite ADR-007
- [x] Phase 2: Namespace Rename
- [x] Phase 3: Import Extensions
- [x] Phase 4: Public-Package Guard, Manifests, README Column
- [x] Phase 5: Release Tooling
- [x] Phase 6: Workflow
- [x] Phase 7: Living Docs And Rules
- [ ] Phase 8: Bootstrap

## Notes

Operator runbook.

**Taking a package public, end to end**

1. Remove `private: true` from its manifest; add a `description` (the README's first paragraph), a `README.md` and a `LICENSE.md`; add the check mark to its row in the root README table. `bun run test` runs the public-package guard, which also reports any private package in its dependency closure.
2. Commit and push. `bun run release` (dry run) lists the package as new.
3. `npm login`, then `bun run release:bootstrap @sdxc/<name>` publishes `0.0.0-pre.1` and prints the trusted-publisher settings.
4. On npmjs.com, open the package's settings and add a trusted publisher: GitHub Actions, organization `sergiodxa`, repository `monorepo`, workflow file `release.yml`, allowed action publish. The next scheduled run publishes the dated version, which becomes `latest`; a `workflow_dispatch` with `publish` checked does the same right away.

**What a failed run leaves behind**

- A compile or validation failure leaves npm untouched: every member builds before the first publish.
- A publish failure part-way leaves the earlier members at today's version and the tag uncreated. The next run finds them at today's version with a clean `gitHead`, skips them, publishes the rest, and creates the tag and Release.
- A failed `gh release create` leaves every package published and the tag uncreated. The next run publishes nothing and creates the Release from the same commit range.
- A commit that lands between a partial run and its rerun makes the affected package fail with `changed after today's publish; rerun tomorrow`: the version is taken, and the next day's run ships the change.

**When to use `--force`**

- After a change to the build or manifest rules in `scripts/release/`, to republish every public package with the new output. Those files sit outside every package's shipped inputs, so the commit range alone leaves the packages untouched.
- Combined with `--publish` to ship; alone it widens the dry run. The tag-for-today rule still applies: a forced run on a day that already has a tag exits 0.

**Gotchas**

- Renaming `.github/workflows/release.yml` invalidates every trusted-publisher entry on npmjs.com; each public package then needs its entry updated before the next publish succeeds.
- The `npm` entry in the root manifest's `devEngines.packageManager` is what lets `npm view`, `npm login` and `npm whoami` run inside the repository; removing it brings back `EBADDEVENGINES` for every npm command, the release script's registry reads included.
