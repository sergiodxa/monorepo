# @sdxc/yaml

YAML reading and writing over a documented subset, shaped after the built-in `JSON` object.

`parse` and `stringify` mirror their
[`JSON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON)
counterparts, return a `Result` instead of throwing, and are separate exports, so a reader
that only parses bundles only the parser.

## Installation

```sh
npm add @sdxc/yaml
```

Both functions answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
which provides `isFailure` and installs alongside this package.

## Usage

### Read a document

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

let result = parse(`
title: API Keys
section:
  title: Team & Settings
  order: 3
tags: [remix, workers]
lastUpdated: 2026-08-02
`);

if (isFailure(result)) throw result.error;

result.data;
// {
//   title: "API Keys",
//   section: { title: "Team & Settings", order: 3 },
//   tags: ["remix", "workers"],
//   lastUpdated: "2026-08-02",
// }
```

The value is `unknown`. A date reads as a string, since the core schema has no timestamp type,
and a source with no nodes (empty, blank or only comments) reads as `null`.

### Write a value

```typescript
import { isFailure } from "@sdxc/result";
import { stringify } from "@sdxc/yaml";

let result = stringify({
	title: "API Keys",
	section: { title: "Team & Settings", order: 3 },
	tags: ["remix", "workers"],
});

if (isFailure(result)) throw result.error;

result.data;
// title: API Keys
// section:
//   title: Team & Settings
//   order: 3
// tags:
//   - remix
//   - workers
```

Output is block style and ends in a line break; pass `{ indent: 4 }` to widen each level.

### Use both under one name

```typescript
import * as YAML from "@sdxc/yaml";

let written = YAML.stringify({ title: "Hello" });
let read = YAML.parse("title: Hello\n");
```

The namespace import tree-shakes the same as named imports.

## API

### `parse(source: string): Result<unknown, YAMLParseError>`

Parses YAML source into the value it describes, or `null` for a source with no nodes. Source
outside the supported subset fails with a `YAMLParseError`.

### `stringify(value: unknown, options?: StringifyOptions): Result<string, YAMLStringifyError>`

Writes a value as a block-style YAML document ending in a line break. Values follow
[`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
(`toJSON` is used, an `undefined` object entry is dropped, an `undefined` array entry becomes
`null`), except that `NaN` and the infinities are written as `.nan`, `.inf` and `-.inf`. Strings
are written plain when that reads back unchanged, as a literal block when they span lines, and
double-quoted otherwise; empty collections are written `{}` and `[]`. A circular structure or a
`bigint` fails with a `YAMLStringifyError`.

### `YAMLParseError`

The failure of `parse`. `line` is the line parsing stopped on, counting from 1, and the message
ends with `at line <n>`.

### `YAMLStringifyError`

The failure of `stringify`. `path` points at the offending value, as `items.0.parent`, and is
empty at the document root; the message ends with `at <path>` when the path is set.

### Types

#### `StringifyOptions`

- `indent`: spaces each nesting level adds. Defaults to `2`.

### Supported subset

| Supported                                                               | Example                   |
| ----------------------------------------------------------------------- | ------------------------- |
| Block mappings, nested by space indentation                             | `section:` / `  order: 1` |
| Block sequences of scalars, mappings or sequences                       | `tags:` / `  - remix`     |
| Plain scalars, folded when written across lines                         | `title: Team & Settings`  |
| Single- and double-quoted scalars, with escapes                         | `title: "a: b"`           |
| Flow sequences and mappings, which may span lines                       | `tags: [remix, workers]`  |
| Literal and folded block scalars, with chomping and an indent indicator | `description: >-`         |
| Comments, whole-line and trailing                                       | `order: 1 # first`        |
| `null` (`null`, `~`, empty), booleans, integers, floats                 | `lastUpdated:`            |
| Every other scalar resolves to a string                                 | `lastUpdated: 2026-08-02` |

These fail to parse: anchors, aliases and merge keys; tags; explicit keys (`? `); directives;
duplicate keys in one mapping; quoted values spanning lines; multi-document sources; tab
indentation; and a plain scalar opening on a reserved character (`@`, `` ` ``, `%`, `,`, `]`,
`}`).

## Pattern: Validating parsed YAML with a schema

`parse` answers `unknown`. Pass the value to any [Standard Schema](https://standardschema.dev)
validator to get a typed result:

```typescript
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

export async function readConfig<T>(source: string, schema: StandardSchemaV1<unknown, T>) {
	let parsed = parse(source);
	if (isFailure(parsed)) return { issues: [{ message: parsed.error.message }] };

	return schema["~standard"].validate(parsed.data);
}
```

## Pattern: Editing a document

Read, change a value, and write it back. Every value in the subset survives the round trip;
comments and the original layout are replaced by the serializer's own:

```typescript
import { isFailure } from "@sdxc/result";
import * as YAML from "@sdxc/yaml";

export function bumpOrder(source: string) {
	let parsed = YAML.parse(source);
	if (isFailure(parsed)) return parsed;

	let data = parsed.data as { order: number };
	return YAML.stringify({ ...data, order: data.order + 1 });
}
```

## Pattern: Writing text that needs quoting

`stringify` picks the notation that reads back as the same value, so strings that look like
other types, contain indicators, or span lines need no manual escaping:

```typescript
import { isFailure } from "@sdxc/result";
import { parse, stringify } from "@sdxc/yaml";

let written = stringify({
	title: "a: b",
	flag: "true",
	body: "Line one\nLine two\n",
	publishedAt: new Date("2026-08-02T00:00:00Z"),
});
if (isFailure(written)) throw written.error;

written.data;
// title: "a: b"
// flag: "true"
// body: |
//   Line one
//   Line two
// publishedAt: 2026-08-02T00:00:00.000Z

parse(written.data); // flag stays "true", body keeps its line breaks, the date is a string
```

## Pattern: Reporting where a file went wrong

Both errors say where the failure is: `line` in the source being read, `path` in the value
being written.

```typescript
import { isFailure } from "@sdxc/result";
import { parse, stringify } from "@sdxc/yaml";

export function check(filename: string, source: string) {
	let result = parse(source);
	if (isFailure(result)) {
		let line = source.split("\n")[result.error.line - 1];
		return `${filename}: ${result.error.message}\n  ${line}`;
	}
	return null;
}

let written = stringify({ items: [{ parent: 1n }] });
if (isFailure(written)) written.error.path; // "items.0.parent"
```

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
		"@sdxc/yaml": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
