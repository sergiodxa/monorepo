# @sdxc/yaml

YAML reading and writing over a documented subset, shaped after the built-in `JSON` object.

`parse` turns YAML text into JavaScript values and `stringify` writes them back out, named
after their
[`JSON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON)
counterparts and exported one by one, so importing the reader leaves the serializer out of
the bundle. Where `JSON` throws, both halves return a `Result`.

The covered subset is block mappings and sequences, plain and quoted scalars, flow
collections, block scalars and comments. Anchors, aliases, merge keys, tags and
multi-document sources are parse failures, named as such rather than silently misread.

## Installation

```bash
npm add @sdxc/yaml
```

Both halves report their outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure`
and `isSuccess` come from. It installs alongside this package.

## Usage

### Read A Document

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

let result = parse("title: API Keys\norder: 3\n");
if (isFailure(result)) throw result.error;

let data = result.data; // { title: "API Keys", order: 3 }
```

The value is `unknown`, which is the honest type for text read off a file. A source holding
no nodes — empty, blank, or only comments — reads as `null`.

### Read Nested Collections

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

let data = result.data;
// {
//   title: "API Keys",
//   section: { title: "Team & Settings", order: 3 },
//   tags: ["remix", "workers"],
//   lastUpdated: "2026-08-02",
// }
```

`lastUpdated` comes back as a string: the core schema has no timestamp type, so a date is
text on the way in and text on the way back out.

### Write A Value

```typescript
import { isFailure } from "@sdxc/result";
import { stringify } from "@sdxc/yaml";

let result = stringify({
	title: "API Keys",
	section: { title: "Team & Settings", order: 3 },
	tags: ["remix", "workers"],
});

if (isFailure(result)) throw result.error;

console.log(result.data);
// title: API Keys
// section:
//   title: Team & Settings
//   order: 3
// tags:
//   - remix
//   - workers
```

The output is block style, ending in a line break. An empty mapping or sequence is written
in the flow style, as `{}` and `[]`.

### Reach For Both Under One Name

```typescript
import * as YAML from "@sdxc/yaml";

let written = YAML.stringify({ title: "Hello" });
let read = YAML.parse("title: Hello\n");
```

Both import forms shake the same, so reaching for the namespace costs nothing.

## API

### `parse(source: string): Result<unknown, YAMLParseError>`

Parses YAML source into the value it describes, answering `null` for a source holding no
nodes. The result is `unknown`: hand it to a
[Standard Schema](https://standardschema.dev) validator to give it a type. Source that
falls outside the subset is a `YAMLParseError` carrying the line it stopped on.

```typescript
let result = parse("title: Hello\norder: 1\n");
if (isFailure(result)) return;

let data = result.data; // { title: "Hello", order: 1 }
```

### `stringify(value: unknown, options?: StringifyOptions): Result<string, YAMLStringifyError>`

Writes a value as a YAML document in the block style, ending in a line break.

Values follow
[`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify):
a `toJSON` method is used where a value has one, an `undefined` object entry is dropped, and
an `undefined` array entry becomes `null`. A function and a symbol are treated the same way.
`NaN` and the infinities, which JSON writes as `null`, become `.nan`, `.inf` and `-.inf`. A
circular structure and a `bigint` are a `YAMLStringifyError`.

`options.indent` is how many spaces each nesting level adds, and defaults to `2`.

```typescript
let result = stringify({ tags: ["remix"] }, { indent: 4 });
if (isFailure(result)) return;

let text = result.data; // "tags:\n    - remix\n"
```

### `YAMLParseError`

The error in the failure branch of `parse`. `line` is the line parsing stopped on, counting
from 1, and the message is the reason with that line appended.

### `YAMLStringifyError`

The error in the failure branch of `stringify`. `path` points at the offending value, as
`items.0.parent`, and is empty at the document root; the message is the reason with that
path appended.

### Types

#### `StringifyOptions`

```typescript
interface StringifyOptions {
	indent?: number;
}
```

### The Supported Subset

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
| Everything else scalar-shaped resolves to a string                      | `lastUpdated: 2026-08-02` |

Reported as a failure rather than guessed at: anchors, aliases and merge keys; tags;
explicit keys (`? `); directives; duplicate keys in one mapping; quoted values spanning
lines; multi-document sources; tab indentation. A plain scalar opening on a character YAML
reserves — `@`, `` ` ``, `%`, `,`, `]`, `}` — is a failure too, as it is in YAML.

## Pattern: Validating Parsed YAML With A Schema

`parse` answers `unknown`, which is the honest type for text from a file. Pair it with a
[Standard Schema](https://standardschema.dev) validator to get a typed value and one failure
branch for both steps. Any library implementing the specification works, so the schema can
come from whichever one an application already uses:

```typescript
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

export function readConfig<T>(source: string, schema: StandardSchemaV1<unknown, T>) {
	let parsed = parse(source);
	if (isFailure(parsed)) return parsed;

	return schema["~standard"].validate(parsed.data);
}
```

## Pattern: Round-Tripping A Document

Reading a document, changing one value, and writing it back stays lossless for everything
the subset covers. Comments and the original formatting belong to the text rather than the
value, so the document that comes out carries the values it went in with and the
serializer's own layout:

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

Writing a document through `stringify` is what keeps the quoting right: it picks the
notation that reads back unchanged, which hand-written text has to get right itself.

## Pattern: Diagnosing A Bad File

Both errors carry where the failure was, which is what makes a rejected file fixable
without re-reading it. `line` points at a source line, and `path` at a value inside the
structure being written:

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

let result = parse(source);

if (isFailure(result)) {
	let { line, message } = result.error;
	console.error(`${filename}:${line} ${message}`);
	console.error(source.split("\n")[line - 1]);
}
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
