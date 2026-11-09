# @sdxc/blueprint

Generate files from `.stub` templates with placeholders, filters and blocks, in code or with `sdxc-blueprint`.

A stub is the text of a file with `{{placeholders}}`, an optional YAML front matter block, and two blocks: `{{#if}}` and `{{#each}}`. Rendering is strict, so a placeholder without a value or a filter nobody defined is an error naming the stub and the line, and a plan reports every file that already exists before anything is written.

## Installation

```sh
npm add @sdxc/blueprint
```

Failures are values from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result); filters come from [`@sdxc/strings`](https://www.npmjs.com/package/@sdxc/strings) and front matter is read by [`@sdxc/yaml`](https://www.npmjs.com/package/@sdxc/yaml), all installed alongside. Front matter is checked by any [Standard Schema](https://standardschema.dev); the examples use `remix/data-schema`. `plan` and `write` use `node:fs`, so they run on Node and Bun; `parse` and `render` run anywhere.

## Usage

Import the package as a namespace:

```ts
import * as blueprint from "@sdxc/blueprint";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

let stub = blueprint.parse(text, {
	schema: s.object({ to: s.string() }),
	source: "flag.stub",
});
if (isFailure(stub)) throw stub.error;

let values = { name: "checkout-v2", beta: true, variants: ["control", "new-flow"] };
let path = blueprint.render(stub.data.frontmatter.to, values);
let content = blueprint.render(stub.data, values);
if (isFailure(path) || isFailure(content)) throw new Error("render failed");

let planned = await blueprint.plan([{ path: path.data, content: content.data }], {
	root: process.cwd(),
});
if (isFailure(planned)) throw planned.error;
if (planned.data.conflicts.length > 0) console.error(planned.data.conflicts);
else await blueprint.write(planned.data);
```

### The stub format

```text
---
to: app/flags/{{name | kebab}}.ts
---
export const {{name | snake | upper}} = flag("{{name | kebab}}");
{{#if beta}}
export const BETA = true;
{{/if}}
{{#each variants}}
export const {{item | snake | upper}} = "{{item}}";
{{/each}}
```

- `{{name}}` writes a value, and `{{name | plural | camel}}` pipes it through filters, left to right.
- `{{#if name}}…{{/if}}` writes its body when the value is `true`, a non-empty string or a non-empty list.
- `{{#each name}}…{{/each}}` writes its body once per item, with `{{item}}` holding the current one. An `each` cannot hold another `each`.
- A block tag alone on its line takes the line with it, so blocks leave no blank lines.
- A multi-line value alone on an indented line takes that indentation on every line.
- A `{{` that forms no tag, such as `values={{}}`, is text; `\{{` writes a literal `{{`.

## API

### `parse(text, options?): Result<Stub, BlueprintError>`

Splits the front matter from the body and compiles the body. `options.schema` validates the front matter and types `stub.frontmatter`; without it the front matter is the YAML as read, and `{}` when there is none. `options.source` names the stub in errors.

### `render(input, values, options?): Result<string, BlueprintError>`

Renders a parsed stub, a compiled template or stub text. `options.filters` adds filters beside the built-in ones.

### `variables(inputs): Result<Variable[], BlueprintError>`

The values a set of stubs reads, in order of first use, each with its `kind` and every place it is used: `text` when a placeholder writes it, `flag` when only `{{#if}}` tests it, `list` when `{{#each}}` walks it. A command line builds its flags and help from this.

### `plan(files, options): Promise<Result<Plan, BlueprintError>>`

Marks each rendered file `create`, `replace` (with `force: true`) or `conflict`, and writes nothing. A path outside `options.root`, or two files with one path, fails.

### `write(plan): Promise<Result<string[], BlueprintError>>`

Writes a plan, creating folders. A plan with conflicts fails before anything is written.

### `compile(body, source, firstLine?)`

Compiles stub text without front matter into a `Template`, which `render` and `variables` accept.

### `FILTERS`

The built-in filters: `camel`, `pascal`, `kebab`, `snake`, `humanize`, `title`, `slug`, `plural`, `singular`, `upper`, `lower`, `upperFirst`, `lowerFirst` and `base` (the last `/` segment). Case filters apply to each `/` segment, so `users/show-page` pascal-cases to `Users/ShowPage`.

### `BlueprintError`

Every failure. `source` and `line` locate the problem when it is inside a stub.

### Types

`Stub`, `Template`, `Node`, `Value` (`string | boolean | readonly string[]`), `Values`, `Filter`, `Variable`, `Use`, `FileToWrite`, `Plan`, `PlannedFile`, `Action`, `ParseOptions`, `RenderOptions`, `PlanOptions`.

## Command line

```sh
bunx @sdxc/blueprint --help
```

With [`@sdxc/kit`](https://www.npmjs.com/package/@sdxc/kit) installed, `sdxc pkg blueprint …` runs the same command line.

`sdxc-blueprint` runs the blueprints in `.config/blueprint/`: a folder of stubs, or a single `<name>.stub`. Each stub names the file it writes in its front matter's `to`, and may hold a `description`, which `--list` shows from `index.stub`. Every value is a flag named after its placeholder in kebab case; a value only `{{#if}}` tests is a boolean flag, and one `{{#each}}` walks is repeated.

```sh
bunx @sdxc/blueprint --list
bunx @sdxc/blueprint flag --help
bunx @sdxc/blueprint flag --name checkout-v2 --beta --variants control --variants new-flow
bunx @sdxc/blueprint flag --name checkout-v2 --dry-run --json
```

A run missing a value prints the blueprint's help, generated from its stubs, and exits 2. A file that exists stops the run with exit 1, naming every one, unless `--force` replaces them; `--dry-run` reports each file as `create`, `replace` or `conflict` and writes nothing.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/blueprint": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
