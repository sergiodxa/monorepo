# sdxc

Every @sdxc package under one install and one version, with the sdxc command line.

## Installation

```sh
npm add sdxc remix
```

`sdxc` depends on every `@sdxc/*` package at the versions released together with it, and declares [`remix`](https://www.npmjs.com/package/remix) as a peer, so the app's own `remix` is the only copy.

## Usage

### Import a package through its `sdxc/*` subpath

Every export of an `@sdxc/<name>` package is exposed as `sdxc/<name>`, subpaths, wildcards and stylesheets included:

```typescript
import { Markdown } from "sdxc/markdown";
import { isFailure } from "sdxc/result";
import { bg } from "sdxc/u/color/bg";
import "sdxc/ui/reset.css";
```

A bundle carries only the subpaths it imports. Import every package through `sdxc` and list no `@sdxc/*` package beside it: a package installed twice, once on its own and once through `sdxc`, holds two instances whose context keys and `instanceof` checks do not match.

### Write the CLI configuration

```sh
npx sdxc init
```

`sdxc init` writes `.config/sdxc.jsonc` with every key at its default and a comment explaining it. It refuses to run when the project already has a configuration file.

## API

### `sdxc/<name>` and `sdxc/<name>/<subpath>`

The same module as `@sdxc/<name>` and `@sdxc/<name>/<subpath>`, default export included. `@sdxc/cloudflare-mocks`, `@sdxc/jsdoc` and `@sdxc/spec` are test and build tools and stay installable on their own.

### `sdxc/config.schema.json`

The JSON Schema 2020-12 document for the CLI configuration, which the `$schema` key of `.config/sdxc.jsonc` points editors at.

### The `sdxc` command

Every command works from the project root: the nearest directory at or above the current one that holds a `package.json`.

- `sdxc init [--dry-run]`: writes `.config/sdxc.jsonc`; `--dry-run` prints it instead.
- `sdxc create [directory] [--template <template>] [--git | --no-git]`: writes a new project into a missing or empty directory from the built-in `app` template (a Remix v3 Worker on Cloudflare) or from any GitHub repository, `--template org/repo[/path][#ref]`, sending `GITHUB_TOKEN` or `GH_TOKEN` when set. It installs nothing and prints the next steps.
- `sdxc upgrade [version] [--no-install] [--output <file>]`: moves `sdxc`, and `remix` with it, to `version` (the latest when omitted), installs it, and prints the prompt an AI agent follows to update the code; `sdxc upgrade --prompt --from <version>` prints that prompt again without changing anything.

### Configuration

The CLI reads `.config/sdxc.jsonc`, or `sdxc.jsonc` at the project root, as JSON with comments, and stops when both exist. Every key is optional, an unknown key is an error, and every configured path must stay inside the project.

| Key               | Default                                | Meaning                                                                      |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `ui.directory`    | `resources/components/ui`              | Where `sdxc ui add` writes components                                        |
| `ui.alias`        | inferred from tsconfig `paths`         | Import prefix for the copies                                                 |
| `ui.tests`        | `false`                                | Copy a component's tests beside it                                           |
| `make.routes`     | `web`                                  | Route contract `sdxc make controller` adds to, a module in `routes/`         |
| `make.migrations` | `{ "default": "database/migrations" }` | Migration chains by name                                                     |
| `make.tests`      | `true`                                 | Write a test beside every generated file except migrations and factories     |
| `make.stubs`      | `.config/sdxc/stubs`                   | Stubs that replace the built-in ones                                         |
| `format`          | none                                   | Command run once on every file a command wrote or edited, the paths appended |
| `lock`            | `.config/sdxc.lock.jsonl`              | Where the CLI keeps its state                                                |

`format` is an argument list run without a shell, such as `["bunx", "vp", "fmt"]`. A non-zero exit is reported and leaves the files as the CLI wrote them.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"sdxc": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
