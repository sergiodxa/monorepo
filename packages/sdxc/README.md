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

### Start a project and grow it

```sh
npx sdxc create my-app              # a Remix v3 app, or --template org/repo from GitHub
npx sdxc make controller posts/show # a file where the app layout puts it, with its test
npx sdxc ui add dialog              # copy a component into the project to edit it
npx sdxc upgrade                    # move to the latest release and print a prompt for the code
```

On a terminal each command asks for what you left out; every question has a flag, so scripts and agents never wait on one.

## API

### `sdxc/<name>` and `sdxc/<name>/<subpath>`

The same module as `@sdxc/<name>` and `@sdxc/<name>/<subpath>`, default export included. `@sdxc/cloudflare-mocks`, `@sdxc/jsdoc` and `@sdxc/spec` are test and build tools and stay installable on their own.

### `sdxc/config.schema.json`

The JSON Schema 2020-12 document for the CLI configuration, which the `$schema` key of `.config/sdxc.jsonc` points editors at.

### `sdxc/lock.schema.json`

The JSON Schema 2020-12 document for one line of the lock file, `.config/sdxc.lock.jsonl` unless `lock` moves it, where the CLI records state such as copied components. Commit the lock file and leave it to the CLI.

### The `sdxc` command

| Command        | What it does                                                                   |
| -------------- | ------------------------------------------------------------------------------ |
| `sdxc create`  | Writes a new project from the built-in `app` template or a GitHub repository   |
| `sdxc init`    | Writes `.config/sdxc.jsonc` with every key at its default                      |
| `sdxc make`    | Writes a controller, job, model, migration or other file, declared and mapped  |
| `sdxc ui`      | Copies `@sdxc/ui` components into the project and points imports at the copies |
| `sdxc upgrade` | Moves `sdxc` and `remix` to a release and prints the prompt to update the code |

`sdxc <command> --help` lists each command's arguments and flags. Commands run from the project root, the nearest directory with a `package.json`.

### Configuration

The CLI reads `.config/sdxc.jsonc` (or `sdxc.jsonc` at the project root). Every key is optional.

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

`format` is an argument list, such as `["bunx", "vp", "fmt"]`.

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
