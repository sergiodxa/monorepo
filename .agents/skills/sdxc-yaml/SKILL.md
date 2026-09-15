---
name: sdxc-yaml
description: "@sdxc/yaml reads and writes YAML over a documented subset, shaped after the built-in `JSON` object: `parse` returns `Result<unknown, YAMLParseError>` and `stringify` returns `Result<string, YAMLStringifyError>`. Use when reading frontmatter or a config file, when a parse failure should carry the line it stopped on instead of throwing, or when writing block-style YAML back out."
---

# @sdxc/yaml

`parse` turns YAML text into JavaScript values and `stringify` writes them back out, named after their `JSON` counterparts and exported one by one so importing the reader leaves the serializer out of the bundle. Where `JSON` throws, both halves return a `Result` from `@sdxc/result`: a `YAMLParseError` carries the `line` it stopped on, a `YAMLStringifyError` carries the `path` to the offending value. The covered subset is block mappings and sequences, plain and quoted scalars, flow collections, block scalars and comments; anchors, aliases, merge keys, tags and multi-document sources are parse failures, named as such. It has no runtime dependency beyond `@sdxc/result` and runs anywhere.

Full API, options and examples: [packages/yaml/README.md](packages/yaml/README.md)

## When to reach for it

- A config file, frontmatter block or authored document has to be read into data.
- A malformed source should produce a message naming the line rather than an exception.
- Data has to be written back out as YAML a person will read and edit.
- A YAML feature outside the subset — an anchor, a tag, a second document — should fail loudly instead of being silently misread.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/yaml": "workspace:*" } }
```

```ts
import { isFailure } from "@sdxc/result";
import { parse } from "@sdxc/yaml";

let result = parse("title: API Keys\norder: 3\n");
if (isFailure(result)) throw result.error;

let data = result.data; // { title: "API Keys", order: 3 }
```

Writing a value:

```ts
import { isFailure } from "@sdxc/result";
import { stringify } from "@sdxc/yaml";

let result = stringify({ tags: ["remix"] }, { indent: 4 });
if (isFailure(result)) return;

let text = result.data; // "tags:\n    - remix\n"
```

## Suggestions

- `parse` answers `unknown`, which is the honest type for text off a file — hand it to a Standard Schema validator to get a type, and a source holding no nodes (empty, blank, or only comments) reads as `null`.
- The core schema has no timestamp type, so a date is a string on the way in and a string on the way out; validate and convert it yourself.
- `stringify` follows `JSON.stringify` for values — `toJSON` is used, an `undefined` object entry is dropped, an `undefined` array entry becomes `null` — but writes `NaN` and the infinities as `.nan`, `.inf` and `-.inf`, and fails on a circular structure or a `bigint`. `options.indent` defaults to `2`.
- Output is block style ending in a line break, with empty mappings and sequences written flow-style as `{}` and `[]`.
- `import * as YAML from "@sdxc/yaml"` reads well at a call site and shakes the same as the named imports.

## Related

- `@sdxc/result` — the `Result` both halves return; skill `sdxc-result`
- `@sdxc/markdown` — parses frontmatter with this reader; skill `sdxc-markdown`
