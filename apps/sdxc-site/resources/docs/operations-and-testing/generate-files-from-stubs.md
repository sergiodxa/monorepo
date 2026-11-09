---
title: Generate files from stubs
description: Render .stub templates with placeholders, filters and small blocks from your own tool, check every file against the disk, and write them only when nothing would be overwritten.
section:
    title: Command lines
    order: 9.3
order: 6
lastUpdated: 2026-11-09
outcomes:
    - "How to render a stub with values and filters from code"
    - "How to read the values a set of stubs needs, to build prompts or flags"
    - "How to plan files, report conflicts and write them"
---

A generator, whether it is a command of your tool, an upgrade step or a script, needs the same few
pieces: a template format, a strict render, and a check against the disk before writing.
[`@sdxc/blueprint`](/api/blueprint) is those pieces, with no convention about where templates live
or what their front matter holds. To run an app's own templates from the terminal instead, see
[Write a blueprint](/docs/sdxc/write-a-blueprint).

```bash
npm add @sdxc/blueprint @sdxc/result
```

Import it as a namespace, so every call reads `blueprint.<name>`.

## Render a stub

A stub is the text of a file with `{{placeholders}}` and optional YAML front matter. `parse`
checks the front matter with any Standard Schema, so your tool decides which keys it reads:

```typescript {% title="scripts/generate.ts" %}
import { readFile } from "node:fs/promises";

import * as blueprint from "@sdxc/blueprint";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

let text = await readFile("templates/flag.stub", "utf8");
let stub = blueprint.parse(text, {
	schema: s.object({ to: s.string() }),
	source: "templates/flag.stub",
});
if (isFailure(stub)) throw stub.error;

let values = { name: "checkout-v2", beta: true, variants: ["control", "new-flow"] };
let path = blueprint.render(stub.data.frontmatter.to, values);
let content = blueprint.render(stub.data, values);
```

Filters chain left to right: `{{name | plural | pascal}}`. `{{#if beta}}` writes its body for a
true or non-empty value and `{{#each variants}}` once per item, as `{{item}}`. A placeholder
without a value fails with the stub, the line and the values it has. Add filters of your own
beside the built-in ones:

```typescript
blueprint.render(stub.data, values, {
	filters: { year: () => String(new Date().getFullYear()) },
});
```

## Ask for what the stubs need

`variables` reads every value a set of stubs uses: `text` for a placeholder, `flag` for a value
only `{{#if}}` tests, `list` for one `{{#each}}` walks, each with the stubs and lines that use it.
Build your prompts, flags or help from it, and they stay in step with the templates:

```typescript
let needed = blueprint.variables([stub.data.frontmatter.to, stub.data]);
if (isFailure(needed)) throw needed.error;
for (let variable of needed.data) console.log(variable.name, variable.kind);
```

## Write the files

`plan` marks each file `create`, `replace` (with `force: true`) or `conflict`, and writes nothing,
so a dry run and a real run see the same answer. `write` refuses a plan with conflicts:

```typescript
if (isFailure(path) || isFailure(content)) throw new Error("A stub did not render");

let planned = await blueprint.plan([{ path: path.data, content: content.data }], {
	root: process.cwd(),
});
if (isFailure(planned)) throw planned.error;

if (planned.data.conflicts.length > 0) {
	console.error(`These files exist: ${planned.data.conflicts.join(", ")}`);
} else {
	await blueprint.write(planned.data);
}
```

A path outside the root, or two files with the same path, fails at `plan`.

## Where to go next

- [Write a blueprint](/docs/sdxc/write-a-blueprint) — run your own stubs from the terminal with
  `sdxc pkg blueprint`.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — wrap a generator in
  a command with flags and a `--dry-run`.
- [`@sdxc/blueprint`](/api/blueprint) — every filter, option and error.
