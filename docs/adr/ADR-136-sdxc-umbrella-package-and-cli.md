# ADR-136: `sdxc` Umbrella Package and CLI

## Status

**Proposed** - 2026-10-14

## Background

The monorepo publishes 116 packages under the `@sdxc` scope (ADR-007). A consumer building an app
on them installs each one by name and keeps every pin on the same release date by hand, since the
packages depend on each other with exact pins and a mixed install duplicates them.

`remix` solves the same problem for its `@remix-run/*` packages with one package whose subpaths
re-export the others (`remix/data-schema` is `export * from '@remix-run/data-schema'`) and which
carries the `remix` CLI. The unscoped `sdxc` name is free on npm. This ADR records the decision to
publish an equivalent `sdxc` package: an auto-generated export map over every `@sdxc/*` package,
and a CLI that vendors `@sdxc/ui` components, creates projects from templates, and generates the
files of an app laid out per ADR-129.

## Context

### What the packages ship

| Fact                               | Detail                                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Export subpaths                    | 361 across 116 packages                                                                                                                      |
| Third-party runtime dependencies   | `remix` (54 packages), `@standard-schema/spec` (types), `@remix-run/data-schema`, `jose`, `linkedom`, `@pitlane/assets`, `@remix-run/ui`     |
| Existing peer dependencies         | Test tooling (`vitest`, `typescript`, `@cloudflare/workers-types`) and `remix`, plus a few `@sdxc/*` integrations (`authz`, `flags`, `jobs`) |
| Entry points with a default export | 11, among them `i18n/middleware`, `mail/middleware`, `jobs/cloudflare`, `http/response`, `lazy-frame/ui`                                     |
| Non-JavaScript export targets      | `ui/reset.css`, `ui/theme.css`, `u/theme.css`, `highlight/styles.css`                                                                        |
| Wildcard subpaths                  | `@sdxc/u` exposes thirteen patterns (`./color/*`, `./layout/*`, ...)                                                                         |
| Conditional targets                | `cloudflare-mocks/sqlite` resolves `bun` and `default` to different files                                                                    |
| Packages with a `bin`              | `@sdxc/spec` (`spec`)                                                                                                                        |

### How releases already behave

- `scripts/release/workspace.ts` counts every `@sdxc/*` name under `dependencies` or
  `peerDependencies` as an internal dependency, and `closeOverDependents` republishes every
  dependent of a changed package so its pins move to the new date.
- `scripts/release/manifest.ts` rewrites every `workspace:` range, peers included, to the exact
  version shipping in that release.
- The release tooling and `test/public-packages.test.ts` assume a package is named
  `@sdxc/<dir>`; the published `homepage` is `https://sdxc.sergiodxa.com/api/<dir>`.

### How `@sdxc/ui` is laid out

- `exports` has the root (every component), `./animations`, `./behaviors`, `./mixins`,
  `./styles`, `./utils` and the two stylesheets. A single component has no subpath of its own.
- Components live in `src/components/` and import each other relatively (`dialog.tsx` imports
  `./button.js` and `./heading-scope.js`). They import helpers from the sibling folders
  (`../styles/floating-surface.js`, `../utils/warn-if-no-accessible-name.js`,
  `../mixins/clear-field.js`), and every helper they import is re-exported from its folder's
  barrel except `utils/glyph-edges.js`.
- Outside the package, a component imports `remix/component`, `@sdxc/u/*` and `@sdxc/icons`.

### How an app is laid out

ADR-129 gives every kind of code one folder: controllers, middleware and validators under
`app/http/`, jobs under `app/jobs/` with the job map in `app/jobs/index.ts`, models under
`app/models/`, migrations as `database/migrations/NNNN_PascalCaseName.sql`, MCP handlers under
`app/mcp/tools/` and `app/mcp/resources/`. `test/app-layout.test.ts` holds the converted apps to it.

## Decision

Add `packages/sdxc`, published as the unscoped `sdxc`, with two parts: a generated export map and
a handwritten CLI.

### 1. Export map

Every export subpath of every public `@sdxc/<dir>` package is exposed as `sdxc/<dir><subpath>`:

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
  the target has a default export. A wildcard subpath maps to a wildcard subpath. A stylesheet
  becomes a CSS file whose only rule is `@import "@sdxc/<dir>/<file>"`.
- **Committed, with a drift test.** The generated files and the `exports` map are committed, so
  the workspace resolves `sdxc/*` without a build. A root test regenerates into memory and fails
  when the committed copy differs. Exposing a new package is its own commit,
  `feat(sdxc): expose sdxc/<dir>`, which keeps commits inside one workspace and gives the `sdxc`
  release notes a line per addition.
- **Excluded packages.** The generator reads an exclusion list for packages that only make sense
  in a test or build step. It starts empty; a package joins it by decision, recorded in the list.

Releases need no new step: `sdxc` depends on every package, so `closeOverDependents` republishes
it whenever anything ships, and `sdxc@2026.10.14` always pins the `2026.10.14` set.

### 2. CLI

`sdxc` declares `"bin": { "sdxc": "./src/cli.ts" }`, built to `dist/` like `@sdxc/spec`'s. It
runs on Node and Bun. Components, built-in templates and generator stubs ship in the `sdxc`
tarball, so what a command writes matches the `@sdxc/*` versions installed beside it; only
`create --template org/repo` uses the network. Every command that edits existing files rewrites
them through `@sdxc/codemod` (ADR-137) and accepts `--dry-run`, which prints the diff instead.

#### Project configuration and state

What the user decides and what the CLI records live in two files, so the CLI never rewrites a
file the user wrote and comments survive.

**Configuration** is written by the user and only read by the CLI. It holds what varies between
projects and cannot be read from them:

| Key               | Default                                | Meaning                                                                                      |
| ----------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ui.directory`    | `resources/components/ui`              | Where `sdxc ui add` writes components                                                        |
| `ui.alias`        | inferred                               | Import prefix app files use for the copies; overrides the one inferred from tsconfig `paths` |
| `ui.tests`        | `false`                                | Whether `ui add` and `ui update` copy a component's tests beside it                          |
| `make.routes`     | `web`                                  | Route contract `make controller` adds to, a module in `routes/`                              |
| `make.migrations` | `{ "default": "database/migrations" }` | Migration chains by name; `make migration --chain <name>` picks one, `default` when omitted  |
| `make.tests`      | `true`                                 | Whether `make` writes a test beside every generated file except migrations and factories     |
| `make.stubs`      | `.config/sdxc/stubs`                   | Folder whose stubs replace the built-in ones, kind by kind                                   |
| `format`          | none                                   | Command run once on every file a command wrote or edited, the paths appended as arguments    |
| `lock`            | `.config/sdxc.lock.jsonl`              | Where the CLI keeps its state file                                                           |

```jsonc
// .config/sdxc.jsonc
{
	"$schema": "../node_modules/sdxc/config.schema.json",
	"ui": { "directory": "resources/components/ui", "tests": true },
	"make": {
		"migrations": {
			"default": "database/migrations",
			// The tenant Durable Object's own schema
			"tenant": "database/tenant-migrations",
		},
	},
	"format": ["bunx", "vp", "fmt"],
}
```

- **Formats.** JSON, JSONC (read through `@sdxc/jsonc`, ADR-138) and YAML (read through
  `@sdxc/yaml`). XML is not read: JSON Schema does not apply to it, so it would go unvalidated.
- **Location.** The CLI looks in `.config/` for `sdxc.jsonc`, `sdxc.json`, `sdxc.yaml` and
  `sdxc.yml`, then at the project root for the same names. More than one match in the folder it
  settles on is an error naming them. The documentation and `create` use `.config/sdxc.jsonc`
  only, which keeps the project root free of another file.
- **Project root.** Every command works from the nearest directory at or above the current one
  that holds a `package.json`; `.config/` and the paths in the configuration are relative to it.
- **Every key is optional.** A project with no configuration file works with the defaults in the
  table, and `sdxc init` writes them out.
- **`ui.tests` defaults to off** because a copied test imports `vitest`, which a project without a
  test runner cannot type check; **`make.tests` defaults to on** because the templates carry
  Vitest and a generated handler with a test beside it is the layout ADR-129 expects.
- **`format` runs without a shell.** It is an argument list, run once per command after every
  write, with the written and edited paths appended. A non-zero exit is reported and leaves the
  files as written; `--dry-run` never runs it, so its diff shows the CLI's own output.
- **Inferred from the project, not configured:**
  - The package manager, from the lockfile or `package.json`'s `packageManager`, for the next
    steps `create` and `init` print.
  - The extension style of relative imports in copied components, from the tsconfig's module
    resolution: none under `bundler`, `.js` under `node16` and `nodenext`.
  - `ui.alias`, from the tsconfig `paths` entry whose target contains `ui.directory`; relative
    paths when none does.
  - Which initializer `make` edits, from what each file in `app/initializers/` imports, and the
    import form of a new mapping, from the mappings beside it.
- **Schema.** The configuration is defined once with `@sdxc/json-schema`, each key with its
  default and a description: the CLI validates the parsed file with it, reports each failing key
  with its path, and fills in the defaults; `sdxc init` renders it; and the build emits it as
  JSON Schema 2020-12 to `config.schema.json`, exported as `sdxc/config.schema.json`. The file
  is committed with the generated export map and covered by the same drift test. Editors validate
  and complete JSON and JSONC through `$schema`, and YAML through a
  `# yaml-language-server: $schema=../node_modules/sdxc/config.schema.json` comment.

**State** is written by the CLI as JSON Lines at the path `lock` names, `.config/sdxc.lock.jsonl`
by default, committed with the project, and never edited by hand. Each line is one entry:

```jsonl
{"kind":"ui","name":"button","release":"2026.10.14","files":{"button.tsx":"sha256-…"}}
{"kind":"ui","name":"dialog","release":"2026.10.14","files":{"dialog.tsx":"sha256-…","dialog.test.tsx":"sha256-…"}}
```

- **Fields.** `kind` names the command group that owns the entry, so later state joins the same
  file; `name` identifies it within the kind; `release` is the `sdxc` release a copy came from;
  `files` maps each file written, relative to `ui.directory`, to the hash of its content, so the
  CLI can tell an untouched file from an edited one. A component copied with `ui.tests` on lists
  its test file too, and `update` replaces each untouched file on its own.
- **One line per change.** `ui add` inserts a line, `ui update` replaces that line, and `ui remove`
  deletes it; no other line changes, so a diff and a review show exactly the components touched.
- **Sorted.** Lines are kept sorted by `kind` then `name`, so the file is deterministic and two
  branches that add different components usually touch different places in it.
- **Reading.** The file is read and written through `@sdxc/jsonl` (ADR-139). Each non-blank line
  is parsed as JSON and validated against the entry schema,
  exported as `sdxc/lock.schema.json`. A line that does not parse or validate, and a second line
  for the same `kind` and `name` (left behind by a merge), is an error naming the line number; the
  CLI changes nothing until it is fixed. A line whose `kind` the running CLI does not know is kept
  verbatim, so an older CLI preserves state a newer one wrote.
- **Writing.** The CLI writes `\n`-terminated lines with keys in the order above, and a final
  newline.
- **Location.** `lock` is a path relative to the project root and must stay inside it; the CLI
  creates its parent folders on the first write. Changing `lock` does not move the file: when the
  configured path is missing and a lock file exists at the default path, the CLI stops and names
  both, so a project never starts a second, empty state file beside its real one.

#### `sdxc init [--format jsonc|json|yaml]`

Writes the configuration file with every default spelled out, so a project gets the file, the
editor completion its `$schema` brings, and a place to change a default without looking any of
it up.

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
  as `ui.alias` and `format`, is written commented out with an example. A key added to the schema appears in
  `init`'s output with no change to `init`.
- **Formats.** `jsonc` is the default and writes `.config/sdxc.jsonc`. `json` writes
  `.config/sdxc.json` with `$schema` and the defaults and no comments, since JSON has none. `yaml`
  writes `.config/sdxc.yaml`, opening with the `yaml-language-server` schema comment and carrying
  the descriptions as YAML comments.
- **Never overwrites.** When any configuration file the CLI would read already exists, in
  `.config/` or at the project root, `init` names it and writes nothing.
- **Configuration only.** The lock file is created by the first command that records state.
- **The same file `create` ships.** The built-in templates' `.config/sdxc.jsonc` is `init`'s
  output; a test renders it and compares, so a new key reaches new projects without editing a
  template.

#### `sdxc ui`

Vendors `@sdxc/ui` components: an app copies a component's source when it needs to change it, and
keeps importing the rest from `sdxc/ui/<name>`.

| Command                                    | Effect                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdxc ui list`                             | Every component in the installed registry, marking the ones copied and whether each copy is edited or behind the installed version                                                                      |
| `sdxc ui add <component...> [--with-deps]` | Copies the components (and their tests with `ui.tests`) and points the app's imports of them at the copies; `--with-deps` also copies every component they reach through other components, transitively |
| `sdxc ui diff <component>`                 | Shows how the local copy differs from the component in the installed version                                                                                                                            |
| `sdxc ui update <component...> [--force]`  | Replaces each copied file whose hash still matches the recorded one with the installed version; an edited file is left alone and reported unless `--force`                                              |
| `sdxc ui remove <component...>`            | Deletes the copies, drops them from the lock file, and points the app's imports of them back at `sdxc/ui/<name>`                                                                                        |

- **Only components are vendored.** A component is a file under `@sdxc/ui`'s `src/components/`.
  Animations, behaviors, mixins, styles and utils are always imported from `sdxc/ui/<folder>`,
  `--with-deps` included.
- **Per-component subpaths in `@sdxc/ui` first.** `@sdxc/ui` gains
  `"./*": "./src/components/*.tsx"` and exports `utils/glyph-edges.js` from its barrel, so
  `sdxc/ui/youtube-embed` resolves and every helper a copied component reaches is importable.
- **Registry built at release.** The release build writes `registry/ui/<name>.json` into the
  tarball from `packages/ui/src/components`: the source with its imports already rewritten
  through `@sdxc/codemod` (`@sdxc/*` to `sdxc/*`, `./button.js` to `sdxc/ui/button`,
  `../styles/floating-surface.js` to `sdxc/ui/styles`), its test file rewritten the same way when
  it has one, the components it imports, and the names it exports.
- **A copy is what the whole app uses.** After `add`, every TypeScript and JavaScript file in the
  project outside `node_modules` and build output, copies included, imports the component from the
  copy: `sdxc/ui/button` is replaced, and `import { Button, Dialog } from "sdxc/ui"` is split so
  the names the copy exports come from the copy and the rest stay on `sdxc/ui`. `remove` reverses
  both, folding the names back into an existing `sdxc/ui` import when one is present. `update`
  writes the new version and points its imports at the copies the lock file lists.

#### `sdxc create [directory] [--template <template>]`

Creates a project from a built-in or a remote template.

- **Target.** `directory` defaults to the current directory. The target must be missing or empty
  apart from a `.git` folder, so `git init && sdxc create` works; anything else is refused. The
  project is named after the target's last path segment, written to `package.json`'s `name`.
- **Built-in templates.** A `--template` without a slash names a template shipped in the tarball,
  from `packages/sdxc/templates/<name>/`; it defaults to `app`, a Remix v3 Worker in the ADR-129
  layout with `cloudflare.config.ts`, a Vite+ configuration, `.config/sdxc.jsonc`, and `sdxc`
  pinned to the version that created it. A test materializes each built-in template into a
  temporary directory and type checks it, so one that stops compiling fails CI.
- **Remote templates.** `--template org/repo[/path][#ref]` names a GitHub repository, optionally a
  folder inside it and a branch, tag or commit. Any repository is a template; nothing in it has
  to declare itself as one. A `host:` prefix (`gitlab:org/repo`) is reserved and refused until a
  second host is supported.
- **Download.** The CLI fetches `https://api.github.com/repos/<org>/<repo>/tarball/<ref>`, the
  default branch when `ref` is omitted, sending `GITHUB_TOKEN` or `GH_TOKEN` as a bearer token
  when either is set so private repositories and the rate limit work.
- **Extraction.** The body streams through `DecompressionStream("gzip")` into
  `parseTar` from `remix/tar-parser`, whose default path policy rejects absolute and `..` entry
  names. The CLI drops the archive's top-level `<org>-<repo>-<sha>/` folder, keeps only entries
  under `path` when one is given, writes regular files and directories, skips symbolic and hard
  links, and checks every resolved path stays inside the target. It sets the parser's size and
  entry limits explicitly and names the exceeded limit when a template is larger.
- **Nothing from a template runs.** `create` installs no dependencies and runs no scripts; it
  prints the next steps (`bun install`, `bun dev`).
- **Git.** When `create` made the target directory, it asks whether to initialize a repository
  there and runs `git init` on yes; it makes no commit, so the first one is the user's. It does
  not ask when the target is the current directory or already holds `.git`, nor when `git` is
  not on the `PATH`, which it notes. `--git` and `--no-git` answer in advance; without a terminal
  to ask on, the answer is no unless `--git` is passed.

#### `sdxc make <kind> <name>`

Writes a file from a stub, at the location ADR-129 gives that kind:

| Kind          | File                                         |
| ------------- | -------------------------------------------- |
| `controller`  | `app/http/controllers/<name>.tsx`            |
| `middleware`  | `app/http/middleware/<name>.ts`              |
| `validator`   | `app/http/validators/<name>.ts`              |
| `job`         | `app/jobs/<name>.ts`                         |
| `model`       | `app/models/<name>.ts`                       |
| `migration`   | `<chain folder>/<NNNN>_<PascalCaseName>.sql` |
| `factory`     | `database/factories/<name>.ts`               |
| `service`     | `app/services/<name>.ts`                     |
| `policy`      | `app/policies/<name>.ts`                     |
| `initializer` | `app/initializers/<name>.ts`                 |
| `email`       | `app/emails/<name>.tsx`                      |
| `mcp`         | `app/mcp/tools/<name>.ts`                    |

Every kind is one word. A slash in the name argument means a folder inside the kind's folder
(`make controller cms/posts`), so a kind never contains one.

- **MCP.** `make mcp <name>` writes a tool, the handler most MCP servers have; `--resource`
  writes a resource to `app/mcp/resources/<name>.ts` instead.
- **Migrations by chain.** `make migration <name> [--chain <chain>]` writes into the folder
  `make.migrations` names for the chain, `default` (`database/migrations`) when omitted, taking
  the next number after the highest in that folder. An unknown chain is an error listing the
  configured ones.
- A name with slashes nests (`make job trials/expire` writes `app/jobs/trials/expire.ts`), which
  keeps the feature grouping ADR-129 recommends.
- **Tests beside the file.** With `make.tests` on, every kind except `migration` and `factory`
  also writes `<name>.test.ts` (`.test.tsx` beside a `.tsx` file) from that kind's test stub.
  `--test` and `--no-test` override the setting for one run.
- The generator refuses to overwrite an existing file, the test included.

##### Stubs

The built-in stubs follow the repo's own rules: module JSDoc header, `@sdxc/result` for failures,
the invocation's log, `lazy()`-mapped routes.

- **One naming rule.** A kind's stub is `<kind>.stub`; a flag that changes what the generated
  file looks like selects a variant, `<kind>.<variant>.stub` (`mcp.resource.stub` for
  `--resource`, `job.cron.stub` for `--cron`, `controller.form.stub` for `--method form`); a test
  stub is `<kind>.test.stub` or `<kind>.<variant>.test.stub`.
- **Project stubs win.** For each stub name, `make` uses the file in `make.stubs` when it exists
  and the built-in one otherwise, so a project overrides only the stubs it cares about.
- **`sdxc make stubs [kind...]`** copies the built-in stubs for the given kinds, or all of them,
  into `make.stubs` to start from; it never overwrites a stub already there.
- **Placeholders.** A stub is the file's text with `{{name}}` placeholders: the file's base name,
  its camelCase key, its PascalCase name, its import specifier and, for a tool, its snake_case
  tool name. The set is documented per kind; a placeholder outside it is an error naming the stub,
  so a typo never reaches a generated file.
- **Declarations are not stubs.** The entry `make` adds to `app/jobs/index.ts`, a route contract
  or an MCP declaration module is fixed per kind and driven by the command's options, since its
  shape is what the mapping depends on.

##### Declaring and mapping what the handler serves

A job, a controller, an MCP tool and an MCP resource each need a declaration and a mapping in the
initializer before the app reaches them. `make` writes both through `@sdxc/codemod`, so the new
handler answers as soon as the command finishes:

| Kind             | Declaration                                                                  | Mapping                                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `job`            | `expire: job({ input: s.object({}) })` under `trials` in `app/jobs/index.ts` | `dispatcher.map(jobs.trials.expire, () => import("~/app/jobs/trials/expire"))`              |
| `controller`     | `sponsors: get("/sponsors")` in `routes/web.ts`                              | `router.map(routes.sponsors, lazy(() => import("~/app/http/controllers/sponsors")))`        |
| `mcp`            | `getPost: tool("get_post", { … })` in `app/mcp/tools/index.ts`               | `mcp.tools.map(toolset.getPost, lazy(() => import("~/app/mcp/tools/get-post")))`            |
| `mcp --resource` | `article: resource("…", { … })` in `app/mcp/resources/index.ts`              | `mcp.resources.map(resourceset.article, lazy(() => import("~/app/mcp/resources/article")))` |

- **Naming.** A file name's kebab-case segments become the camelCase declaration key
  (`get-post` → `getPost`) and, for a tool, the snake_case tool name (`get_post`). A job's
  leading segments name its group; an existing group whose mapped handlers already live in that
  folder is reused (the `activitypub/` folder maps to the existing `activityPub` group), and a
  missing group is created.
- **Declaration options.** `make job` takes `--cron "<expression>"` to declare a scheduled job
  instead of one with input. `make controller` takes `--method` (`get`, `post`, `put`, `patch`,
  `delete` or `form`, default `get`), `--path` (default `/<name>`) and `--routes <contract>`
  (default `make.routes` from the configuration, else `web`; a module in `routes/`). Leading name segments of a controller nest the route
  under the `route({ … })` group with that key, created without a path prefix when missing.
- **Which initializer.** The router initializer is the one in `app/initializers/` that imports
  the chosen contract; the job dispatcher and the MCP handler are the initializers that import
  `~/app/jobs` and `~/app/mcp/tools` (or `resources`). The new mapping follows the last mapping
  of the same declarations in that file, inside a router factory when the existing calls are
  there, or directly after the instance is created when none exist yet.
- **Import specifiers** follow the form the existing mappings use (`~/app/…` in the templates),
  and a relative path when there are none.
- **All or nothing.** Every edit is computed before anything is written. When the declaration or
  the mapping cannot be placed — no initializer imports the contract, or the declarations are not
  an object literal passed to `jobs()`, `route()`, `tools()` or `resources()` — the command writes
  only the new file, leaves the declarations and initializers untouched, and prints both edits for
  the user to make. An app never ends up with a declaration that has no mapping.
- Mappings are written without guards or middleware; a route that needs `lazy()`'s second
  argument gets it by hand.

#### `sdxc upgrade [version]`

Moves the project to another `sdxc` release and writes the prompt an AI agent needs to bring the
code along.

1. **Resolve.** The current version is the installed `sdxc`; the target is `version`, or the
   latest release on npm when omitted. A target older than the current version is refused, and
   the current version is reported as up to date.
2. **Bump.** `sdxc` in `package.json` becomes the exact target version; nothing else in the file
   changes. Each `@sdxc/*` dependency the file lists is reported as unsupported beside `sdxc`, with
   the files that import it.
3. **Install** with the project's package manager, inferred as for `create`. `--no-install`
   stops here and prints the install command and the prompt command to run after it.
4. **Prompt.** The CLI runs the newly installed `sdxc` as `sdxc upgrade --prompt --from <current>`,
   so the prompt is written by the target release's code from the target release's data.
   `--prompt --from <version>` also regenerates it later without bumping anything.

**Changelog in the tarball.** The release build writes `changelog.jsonl` into the `sdxc` package
through `@sdxc/jsonl`: one line per commit, per package, per release, with the release, the
package, the Conventional Commits type, whether it is breaking (`!`), the title and the body. It
comes from the same commit parsing as the GitHub Release notes (ADR-007), so `upgrade` reads it
offline.

**What the prompt holds,** for the releases after the current version up to the target:

- the packages the project imports, found with `findModuleReferences` from `@sdxc/codemod` over
  every `sdxc/*` specifier, and only their entries;
- breaking changes first, each with its full body, then features and fixes with theirs; commit
  bodies carry the instructions for applying each change (ADR-140);
- vendored components whose source changed after the release their lock entry records, read from
  the `changedIn` release each registry entry carries (the latest release whose commits touched
  the component or its test), with `sdxc ui diff` and `sdxc ui update` as the way to take the
  change;
- the project's own verification commands, from its `package.json` scripts (`check`, `typecheck`,
  `test`), to run after editing;
- links to each package's documentation page.

The prompt goes to stdout, so it pipes into a clipboard or an agent's command line; `--output
<file>` writes it to a file.

### Imports in this repo and in documentation

- **A project that depends on `sdxc` imports only `sdxc/*`** and lists no `@sdxc/*` package of
  its own. Every package arrives through `sdxc` at the versions that release pins, so a project
  never holds two copies of one package, and upgrading is one version to move.
- Apps in this repo keep importing `@sdxc/*`, so each app's `package.json` lists what it uses.
  `apps/sdxc`, the documentation site, switches to `sdxc/*` and is the in-repo consumer the
  package is verified against.
- Packages never import `sdxc`; it depends on all of them.
- READMEs, the documentation site and blog posts show `sdxc/*` first and mention `@sdxc/*` as the
  per-package install.

## Consequences

### Positive

- **One install, one version.** `bun add sdxc` brings a matched set; upgrading is one bump.
- **No release work.** Pinning and republishing come from the existing dependency closure.
- **Owned components.** An app takes a component's source when it needs to change it, its
  imports follow the copy without hand edits, and `ui list`/`ui update` show which copies have
  fallen behind.
- **Offline, version-matched output.** Components, built-in templates and stubs come from the
  installed tarball.
- **Any repository is a starting point.** A team keeps its own template on GitHub and passes
  `--template org/repo`, with no registration or manifest.
- **The layout is reachable outside this repo.** `create` and `make` give a consumer the ADR-129
  structure without reading the ADR.
- **Upgrades come with their instructions.** `sdxc upgrade` moves one version and hands an agent
  the changes that matter to this project, with the steps each one needs.
- **A generated handler is live immediately.** `make job`, `controller` and `mcp` declare and map
  what they create, so a forgotten mapping cannot ship.

### Negative

- **Install size.** Every package, `linkedom` and `jose` included, lands in `node_modules` for a
  consumer who uses three of them. Bundles are unaffected.
- **Mixing is unsupported.** A project that adds an `@sdxc/*` package beside `sdxc` can get two
  instances of it, and context keys and `instanceof` checks stop matching between them. The
  documentation says so, and `sdxc upgrade` reports any `@sdxc/*` dependency it finds.
- **A second commit per new package**, to expose it through `sdxc`.
- **A daily `sdxc` release** whenever any package ships, so its version history is long.
- **Release tooling assumes the scope.** `test/public-packages.test.ts`, the docs `homepage` and
  `release:bootstrap` need to accept a package whose name is not `@sdxc/<dir>`.
- **Two workspaces named `sdxc`.** `apps/sdxc` and `packages/sdxc` share the commit scope
  `sdxc`; release notes follow paths, so they stay correct, and a commit body names which one a
  `(sdxc)` subject means when the title leaves it unclear.
- **Templates and stubs are code outside any app.** They need the materialize-and-typecheck test
  to stay valid as packages change.
- **The CLI edits files the user wrote.** `ui add` and `ui remove` edit import declarations
  across the project, and `make` edits route contracts, declaration modules and initializers;
  `--dry-run` shows the diff first.
- **`make` depends on the initializer shapes ADR-129 and the templates use.** An app whose
  declarations or mappings are written differently falls back to printed instructions.
- **Two files to commit.** A project that vendors components commits the lock file, under
  `.config/` beside its configuration unless `lock` moves it.
- **Remote templates are unreviewed code.** `create` never runs them, but the user installs and
  runs what they downloaded; the CLI prints the source repository and commit it extracted.

### Neutral

- Copied components carry the original module header and the MIT license terms.
- The CLI surface is a namespace for later commands; adding one is a routine change, not an ADR.

## Implementation Plan

### Phase 1: Export map

1. Teach the release tooling and `test/public-packages.test.ts` about the unscoped package.
2. Write the generator and the drift test; generate `packages/sdxc`.
3. Add README, `LICENSE.md`, root README row and docs-site group; bootstrap `sdxc` on npm and
   configure its trusted publisher.
4. Move `apps/sdxc` to `sdxc/*`.

### Phase 2: `@sdxc/ui` subpaths

1. Add `"./*": "./src/components/*.tsx"` and export `glyph-edges` from the utils barrel.

### Phase 3: Configuration, `sdxc init` and `sdxc ui`

Depends on `@sdxc/jsonc` (ADR-138), `@sdxc/jsonl` (ADR-139) and `@sdxc/codemod` (ADR-137).

1. Configuration lookup and validation across JSON, JSONC and YAML, the lock file, and both
   schemas emitted to `config.schema.json` and `lock.schema.json` (one lock-file line).
2. `sdxc init` in the three formats.
3. Registry generation in the release build.
4. `list`, `add` with `--with-deps`, `diff`, `update`, `remove`, and the app-wide import rewrite.

### Phase 4: `sdxc create`

1. Target resolution and the `app` built-in template, with the materialize-and-typecheck test.
2. GitHub templates: download, extraction through `remix/tar-parser`, `path` and `ref`.

### Phase 5: `sdxc make`

1. Stubs and test stubs for every kind in the table, project stub lookup, `sdxc make stubs`,
   migration chains and numbering, nested names, and the `format` command.
2. Declaration and mapping for `job`, `controller` and `mcp` (tool and resource), verified by a
   test that runs each against the materialized `app` template and type checks the result.

### Phase 6: `sdxc upgrade`

1. `changelog.jsonl` and the registry's `changedIn` in the release build.
2. Resolve, bump, install, and the prompt, with a test that renders the prompt for a fixture
   project between two fixture releases.

## Alternatives Considered

### 1. Every package as an optional peer dependency

Bun, npm and pnpm skip optional peers on install, so `import "sdxc/markdown"` fails until the
consumer also installs `@sdxc/markdown`, which makes `sdxc` a second name for a package the user
already installs. The release pins peers exactly, so with a version per day the consumer's own
`@sdxc/*` installs would warn or conflict on nearly every upgrade; a looser range lets the
installed code drift from the types `sdxc` was built against.

**Rejected because**: the consumer installs everything twice over and still manages versions.

### 2. A remotely hosted component registry

Serve registry entries from the documentation site, as shadcn does.

**Rejected because**: a copy could come from a different release than the installed `@sdxc/u`,
and `ui add` would need the network.

### 3. `sdxc ui <component>` as the only UI command

**Rejected because**: listing, diffing, updating and removing copies are operations on the same
noun, and a bare component argument leaves no room for them.

### 4. Vendoring helpers alongside components

Copy the styles, utils, mixins and behaviors a component imports along with it.

**Rejected because**: helpers are shared by many components, so a copied helper forks behavior
the app's other components still take from the package.

### 5. Generating the export map only at release time

**Rejected because**: `sdxc/*` would not resolve inside the workspace, so nothing in the repo
could import it before publishing.

### 6. Copying only, leaving the app's imports to the user

**Rejected because**: until every import is edited by hand, the app renders the package's
component in some places and the copy in others.

### 7. One configuration file the CLI rewrites

Keep the copied components' release and hash in the configuration file, as one document.

**Rejected because**: `@sdxc/yaml` replaces comments and layout on write and `JSON.stringify`
drops JSONC comments, so each `ui add` would erase what the user wrote; restricting the file to
plain JSON would avoid that only by giving up comments.

### 8. The lock file as one JSON document

**Rejected because**: a nested document reformats around every change and two branches adding
components edit the same object; a line per entry keeps each change to one line.

### 9. Configurable paths per `make` kind

Let a project move controllers, jobs or models out of the ADR-129 folders.

**Rejected because**: the layout is what the templates, the stubs and the declaration and mapping
edits are built around; migrations get named chains because one app already has two schemas, and
that is the only location that varies between projects that follow the layout.

### 10. Folder-style kind names (`http/controller`, `mcp/tool`)

**Rejected because**: a slash already means a folder inside the kind's folder in the name
argument, so `make http/controller cms/posts` would use it for two things in one command, and the
kind typed most often would be the longest.

### 11. Reading the changelog from GitHub Releases at upgrade time

**Rejected because**: it needs the network and a rate-limited API, and the notes are Markdown
written for people; the tarball's `changelog.jsonl` is structured, offline, and ships with the
release it describes.

### 12. `sdxc upgrade` applying changes itself

**Rejected because**: a breaking change rarely reduces to a mechanical rewrite of the app's code;
the CLI moves the version and gathers the instructions, and the agent, with the project in front
of it, makes the edits.

### 13. XML configuration

**Rejected because**: JSON Schema does not apply to XML, so an XML file would be the one format
the editor cannot validate, and mapping elements to nested keys is ambiguous.

### 14. `git clone --depth 1` for remote templates

**Rejected because**: it requires git on the machine and brings the repository's history folder,
which the CLI would then delete; the tarball plus `remix/tar-parser` needs neither.

## Deferred

- Template hosts other than GitHub, behind the reserved `host:` prefix.
- Registering the other kinds `make` writes, such as a model in an app's model registry or
  middleware in a router's chain.
- `sdxc doctor`, reporting installed `@sdxc/*` packages from different release dates.

## References

- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-017: README Package Description Source of Truth](./ADR-017-readme-package-description-source-of-truth.md)
- [ADR-129: One Folder Layout for Every App](./ADR-129-app-folder-layout.md)
- [ADR-137: `@sdxc/codemod` Package](./ADR-137-codemod-package.md)
- [ADR-138: `@sdxc/jsonc` Package](./ADR-138-jsonc-package.md)
- [ADR-139: `@sdxc/jsonl` Package](./ADR-139-jsonl-package.md)
- [ADR-140: Commit Bodies Are Release Notes](./ADR-140-commit-bodies-are-release-notes.md)
- [GitHub REST API: download a repository archive (tar)](https://docs.github.com/en/rest/repos/contents#download-a-repository-archive-tar)
- [`remix` on npm](https://www.npmjs.com/package/remix)
- [shadcn CLI](https://ui.shadcn.com/docs/cli)

## Current Progress

- [ ] Phase 1: Export map
- [ ] Phase 2: `@sdxc/ui` subpaths
- [ ] Phase 3: Configuration, `sdxc init` and `sdxc ui`
- [ ] Phase 4: `sdxc create`
- [ ] Phase 5: `sdxc make`
- [ ] Phase 6: `sdxc upgrade`
