# @sdxc/yaml

YAML reading and writing over a documented subset, shaped after the built-in `JSON` object.

## Overview

`@sdxc/yaml` parses YAML text into JavaScript values and writes JavaScript values back
out as YAML. The two functions are named after their `JSON` counterparts and exported
one by one, so `import * as YAML from "@sdxc/yaml"` gives you the familiar `YAML.parse`
and `YAML.stringify`, while `import { parse } from "@sdxc/yaml"` gives you the reader
alone. Where `JSON` throws, this returns a [`Result`](/packages/result), the way every
other parser in this repository reports failure.

Exporting them separately is what keeps the writer out of a bundle that only reads:
`@sdxc/markdown` imports `parse` for frontmatter, and the serializer — a third of the
package — is dropped from every Worker that ships it. Both import forms shake the same,
so reaching for the namespace costs nothing.

The package covers a subset of [YAML 1.2](https://yaml.org/spec/1.2.2/) rather than the
whole language: block mappings and sequences, plain and quoted scalars, flow
collections, literal and folded block scalars, and comments. Anchors, aliases, merge
keys, tags, explicit keys and multi-document sources are parse failures, named as such
instead of silently misread. Scalars resolve by the
[YAML 1.2 core schema](https://yaml.org/spec/1.2.2/#103-core-schema), so a date arrives
as text, `yes` stays the string `"yes"`, and only `true` and `false` become booleans.

Both halves cover the same subset, which makes the round trip a property the package
holds itself to: `YAML.parse(YAML.stringify(value))` returns the value it started from,
including the `NaN` and infinities JSON cannot write. The serializer picks the notation
that reads back unchanged — a plain scalar where that is unambiguous, a literal block
for text spanning lines, and double quotes otherwise.

## Usage

### Parse YAML text

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

let result = parse(`
title: API Keys
section:
  title: Team & Settings
  order: 3
tags: [remix, workers]
`);

if (isFailure(result)) throw result.error;

let data = result.data;
// { title: "API Keys", section: { title: "Team & Settings", order: 3 }, tags: ["remix", "workers"] }
```

### Write a value as YAML

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

### Reach for both under one name

```typescript
import * as YAML from "@sdxc/yaml";

let written = YAML.stringify({ title: "Hello" });
let read = YAML.parse("title: Hello\n");
```

## API

### `parse(source: string): Result<unknown, YAMLParseError>`

Parses YAML source into the value it describes. The result is `unknown`: hand it to a
[Standard Schema](https://standardschema.dev) validator to give it a type.

**Parameters:**

- `source`: YAML source text

**Returns:**

- `success`: The value the source describes, `null` for a source holding no nodes
- `failure`: `YAMLParseError`

**Example:**

```typescript
let result = parse("title: Hello\norder: 1\n");
if (isFailure(result)) return;

let data = result.data; // { title: "Hello", order: 1 }
```

### `stringify(value: unknown, options?: StringifyOptions): Result<string, YAMLStringifyError>`

Writes a value as a YAML document in the block style, ending in a line break.

Values follow `JSON.stringify`: a `toJSON` method is used where a value has one, an
`undefined` object entry is dropped, and an `undefined` array entry becomes `null`. A
function and a symbol are treated the same way. `NaN` and the infinities, which JSON
writes as `null`, become `.nan`, `.inf` and `-.inf`.

**Parameters:**

- `value`: The value to write
- `options.indent`: Spaces each nesting level adds; defaults to `2`

**Returns:**

- `success`: The YAML text
- `failure`: `YAMLStringifyError`, for a circular structure or a `bigint`

**Example:**

```typescript
let result = stringify({ tags: ["remix"] }, { indent: 4 });
if (isFailure(result)) return;

let text = result.data; // "tags:\n    - remix\n"
```

### `YAMLParseError`

Error returned in the failure branch of `parse`.

**Properties:**

- `name`: `"YAMLParseError"`
- `line`: `number` — the line parsing stopped on, counting from 1
- `message`: The reason, with the line appended

### `YAMLStringifyError`

Error returned in the failure branch of `stringify`.

**Properties:**

- `name`: `"YAMLStringifyError"`
- `path`: `string` — path to the offending value, as `items.0.parent`; empty at the root
- `message`: The reason, with the path appended

### Types

#### `StringifyOptions`

```typescript
interface StringifyOptions {
	indent?: number;
}
```

### The supported subset

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
explicit keys (`? `); quoted values spanning lines; multi-document sources; tab
indentation. A plain scalar opening on a character YAML reserves — `@`, `` ` ``, `%`,
`,`, `]`, `}` — is a failure too, as it is in YAML.

## Pattern: Validating parsed YAML with a schema

`parse` answers `unknown`, which is the honest type for text from a file. Pair it with a
schema to get a typed value and one failure branch for both steps.

```typescript
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";
import * as s from "remix/data-schema";

let schema = s.object({ title: s.string(), order: s.number() });

export function readConfig(source: string) {
	let parsed = parse(source);
	if (isFailure(parsed)) return parsed;

	return schema["~standard"].validate(parsed.data);
}
```

## Pattern: Round-tripping a document

Reading a file, changing one value, and writing it back stays lossless for everything
the subset covers. Comments and the original formatting are not part of the value, so
they do not survive the trip.

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

## Related Packages

- [`@sdxc/result`](/packages/result) - The success/failure type both halves return
- [`@sdxc/xml`](/packages/xml) - The same parse/serialize split for XML
- [`@sdxc/markdown`](/packages/markdown) - Reads document frontmatter through this package
- [`@sdxc/highlight`](/packages/highlight) - Tokenizes YAML for display, which is a separate job from reading it

## Tips

1. **Import the half you use** - `import { parse }` leaves the serializer out of the bundle; reach for `import * as YAML` when you want both under one name, which shakes the same.
2. **Type the result with a schema** - `parse` answers `unknown` on purpose; a validator is what turns text from a file into a typed value.
3. **Expect a string for a date** - The core schema does not resolve timestamps, so `2026-08-02` arrives as text and stays text on the way back out.
4. **Do not count on comments surviving a round trip** - A comment is not part of the value, so writing a parsed document back drops it.
5. **Reach for the round trip, not hand-written YAML** - `stringify` picks the quoting that reads back unchanged, which hand-written text has to get right itself.
6. **Read `line` and `path` off the errors** - Both carry where the failure was, which is what makes a bad file diagnosable without re-reading it.
7. **Keep anchors out of authored files** - They are a parse failure here; repeating the value is what this subset asks for.
