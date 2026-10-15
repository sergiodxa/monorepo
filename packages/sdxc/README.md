# sdxc

Every @sdxc package under one install and one version, with the sdxc command line from @sdxc/kit.

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

### Run the `sdxc` command

`sdxc` depends on [`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit), the `sdxc` command line, at the version released with it, and installs its `sdxc` binary, so a project that lists `sdxc` runs `npx sdxc make controller posts/show` with no other install. For the command outside a project, install the kit globally:

```sh
npm add -g @sdxc/kit
sdxc create my-app
```

## API

### `sdxc/<name>` and `sdxc/<name>/<subpath>`

The same module as `@sdxc/<name>` and `@sdxc/<name>/<subpath>`, default export included. `@sdxc/cloudflare-mocks`, `@sdxc/jsdoc` and `@sdxc/spec` are test and build tools and stay installable on their own.

### `sdxc/kit` and `sdxc/kit/config.schema.json`

The kit's exports, as every package's: `sdxc/kit/config.schema.json` is the JSON Schema for `.config/sdxc.jsonc`, which `sdxc init` points the file's `$schema` at. The commands, their flags and the configuration keys are documented with [`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit).

### The `sdxc` binary

The binary, the same command line as `@sdxc/kit`'s.

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
