# ADR-142: `sdxc create` Templates

## Status

**Accepted** - 2026-10-15

> Superseded by [ADR-183](./ADR-183-drop-sdxc-umbrella.md) for the install package: templates ship
> in `@sdxc/kit` and pin `@sdxc/*`. The `sdxc create` command itself is unchanged.

## Background

A project built on `sdxc` (ADR-136) starts from the same pieces every app in this repo has: a
Remix v3 Worker in the ADR-129 layout, `cloudflare.config.ts`, a Vite+ configuration, and the
CLI's own configuration. Assembling them by hand means reading the repo. This ADR records
`sdxc create`, which writes a new project from a template shipped in the `sdxc` tarball or from
any GitHub repository.

## Context

- GitHub serves any repository, folder and ref as a gzipped tarball through
  `https://api.github.com/repos/<org>/<repo>/tarball/<ref>`, rate limited without a token.
- `remix/tar-parser` parses a tar stream and, by default, rejects absolute and `..` entry names.
- A tarball's entries sit under a top-level `<org>-<repo>-<sha>/` folder.

## Decision

`sdxc create [directory] [--template <template>] [--git | --no-git]`.

- **Target.** `directory` defaults to the current directory. The target must be missing or empty
  apart from a `.git` folder, so `git init && sdxc create` works; anything else is refused. The
  project is named after the target's last path segment, written to `package.json`'s `name`.
- **Built-in templates.** A `--template` without a slash names a template shipped in the tarball,
  from `packages/kit/templates/<name>/`; it defaults to `app`, a Remix v3 Worker in the ADR-129
  layout with `cloudflare.config.ts`, a Vite+ configuration, `.config/sdxc.jsonc`, and `sdxc` and
  `remix` pinned to the versions that release ships with. Its one router maps a page contract,
  `routes/web.ts`, and an API contract, `routes/api.ts`, each with its own middleware chain
  (ADR-153). A test materializes each built-in
  template into a temporary directory and type checks it, so one that stops compiling fails CI.
- **Remote templates.** `--template org/repo[/path][#ref]` names a GitHub repository, optionally a
  folder inside it and a branch, tag or commit. Any repository is a template; nothing in it has
  to declare itself as one. A `host:` prefix (`gitlab:org/repo`) is reserved and refused until a
  second host is supported.
- **Download.** The CLI fetches the tarball for `ref`, the default branch when omitted, sending
  `GITHUB_TOKEN` or `GH_TOKEN` as a bearer token when either is set so private repositories and
  the rate limit work.
- **Extraction.** The body streams through `DecompressionStream("gzip")` into `parseTar` from
  `remix/tar-parser`. The CLI drops the archive's top-level folder, keeps only entries under
  `path` when one is given, writes regular files and directories, skips symbolic and hard links,
  and checks every resolved path stays inside the target. It sets the parser's size and entry
  limits explicitly and names the exceeded limit when a template is larger.
- **Nothing from a template runs.** `create` installs no dependencies and runs no scripts; it
  prints the next steps with the project's package manager (`bun install`, `bun dev`), and for a
  remote template the repository and commit it extracted.
- **Git.** When `create` made the target directory, it asks whether to initialize a repository
  there and runs `git init` on yes; it makes no commit, so the first one is the user's. It does
  not ask when the target is the current directory or already holds `.git`, nor when `git` is
  not on the `PATH`, which it notes. `--git` and `--no-git` answer in advance; without a terminal
  to ask on, the answer is no unless `--git` is passed.

## Consequences

### Positive

- **The layout is reachable outside this repo.** A consumer gets the ADR-129 structure without
  reading the ADR.
- **Any repository is a starting point.** A team keeps its own template on GitHub and passes
  `--template org/repo`, with no registration or manifest.

### Negative

- **Templates are code outside any app.** They need the materialize-and-typecheck test to stay
  valid as packages change.
- **Remote templates are unreviewed code.** `create` never runs them, but the user installs and
  runs what they downloaded.

## Implementation Plan

1. Target resolution and the `app` built-in template, with the materialize-and-typecheck test.
2. GitHub templates: download, extraction through `remix/tar-parser`, `path` and `ref`.

## Alternatives Considered

### 1. `git clone --depth 1` for remote templates

**Rejected because**: it requires git on the machine and brings the repository's history folder,
which the CLI would then delete; the tarball plus `remix/tar-parser` needs neither.

## Deferred

- Template hosts other than GitHub, behind the reserved `host:` prefix.

## References

- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [GitHub REST API: download a repository archive (tar)](https://docs.github.com/en/rest/repos/contents#download-a-repository-archive-tar)

## Current Progress

- [x] Built-in `app` template and the materialize-and-typecheck test
- [x] GitHub templates
