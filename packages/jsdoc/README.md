# @sdxc/jsdoc

Read JSDoc out of JavaScript and TypeScript source text into a JSON documentation model.

## Overview

A documentation site needs three things from a codebase: what each export is, what
its signature looks like, and what its author wrote about it. This package produces
all three as plain JSON, so a site renders documentation without knowing anything
about compilers.

It is a pure function of the text it is given. It never touches the file system,
never follows an import, and never runs a type checker — the caller reads files,
decides which ones belong in the documentation, and passes their contents in. That
keeps it usable from a Worker, a build step, or a test, and makes the same input
produce the same output every time.

Because nothing is resolved across files, types are reported as the annotations
their authors wrote (`Promise<Entry>`, not an expanded structural type), and a
barrel's `export … from` lines arrive as `reExports` pointing at the modules the
caller resolves next.

Parsing runs on the TypeScript compiler's own parser, which is what lets one entry
point cover `.ts`, `.tsx`, `.js`, `.jsx`, `.mts` and `.cts`.

## Usage

### Extract one module

```ts
import { readFile } from "node:fs/promises";

import { extract } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

let source = await readFile("src/add.ts", "utf8");
let result = extract(source, { path: "src/add.ts" });

if (isFailure(result)) throw result.error;

result.data.children[0]?.name; // "add"
result.data.children[0]?.signatures[0]?.returns; // "number"
```

### Build the document a site reads

```ts
import { writeFile } from "node:fs/promises";

import type { DocModule } from "@sdxc/jsdoc";

import { SCHEMA_VERSION } from "@sdxc/jsdoc";

let modules: DocModule[] = [];

for (let path of ["src/index.ts", "src/add.ts"]) {
	let result = extract(await readFile(path, "utf8"), { path });
	if (isFailure(result)) throw result.error;
	modules.push(result.data);
}

await writeFile(
	"docs/api.json",
	JSON.stringify({ schema: SCHEMA_VERSION, name: "math", version: "1.4.0", modules }, null, "\t"),
);
```

### Parse a comment on its own

```ts
import { findTag, parseComment } from "@sdxc/jsdoc";

let comment = parseComment("/** Adds. @param a - The addend. @returns The sum. */");

comment.description; // "Adds."
findTag(comment, "returns")?.text; // "The sum."
```

## API

### `extract(source: string, options?: ExtractOptions): Result<DocModule, ExtractError>`

Reads one file's source text into its documentation module: the header comment, the
symbols it exports, and the exports it forwards to other modules.

**Parameters:**

- `source`: Contents of one JavaScript or TypeScript file
- `options.path`: Path the text came from, which selects the dialect from its
  extension and is recorded on every node's `source` (default `"module.ts"`)
- `options.id`: Prefix for every node id, as `<id>#<name>` (default: `path` without
  its extension)
- `options.includeInternal`: Keep symbols tagged `@internal`, dropped by default
  (default `false`)

**Returns:**

- A `DocModule`, or an `ExtractError` listing every syntax error with its position

**Example:**

```ts
let result = extract(source, { path: "src/add.ts", includeInternal: true });
```

### `parseComment(raw: string): DocComment`

Splits one JSDoc block into the prose before its first block tag and the tags after
it. Accepts the comment with or without its markers, collapses aliases (`@arg` and
`@argument` become `param`, `@return` becomes `returns`), and keeps fenced code
inside an `@example` intact even when that code contains tags of its own.

**Example:**

```ts
parseComment("/** @param {string} name - The subject. */").tags;
// [{ tag: "param", name: "name", type: "string", text: "The subject." }]
```

### `findTag(comment: DocComment | null, tag: string): DocTag | null`

First tag with the given canonical name, or `null`. Takes `null` for a symbol with
no comment, so a renderer asks the same way everywhere.

### `findTags(comment: DocComment | null, tag: string): DocTag[]`

Every tag with the given canonical name, in source order.

### `inlineLinks(text: string): DocLink[]`

Every `{@link}`, `{@linkcode}` and `{@linkplain}` in a description or tag text, each
with the raw text it occupies and the offset it starts at, so a renderer substitutes
anchors without rescanning the markdown.

```ts
inlineLinks("See {@link parseComment|the parser}.");
// [{ raw: "{@link parseComment|the parser}", target: "parseComment", text: "the parser", index: 4 }]
```

### `ExtractError`

The failure `extract` reports for text that will not parse. Carries `path` and a
`diagnostics` array of `{ message, line, column }`, so a caller names the file and
the line instead of reporting that documentation generation failed.

### `SCHEMA_VERSION`

The number to write into `DocProject.schema`. It rises whenever a field changes
meaning or disappears, so a site recognizes a document written by an older
extractor.

### Types

#### `DocProject`

The whole document a site reads. The caller assembles it from the modules it
extracted, in the order it wants them presented.

```ts
interface DocProject {
	schema: number;
	name: string;
	version: string | null;
	modules: DocModule[];
}
```

#### `DocModule`

One extracted file.

```ts
interface DocModule {
	id: string;
	path: string;
	comment: DocComment | null;
	children: DocNode[];
	reExports: DocReExport[];
}
```

#### `DocNode`

One documented symbol. Members of classes, interfaces, enums and namespaces are the
same shape under `children`, so one recursive renderer covers the whole tree.

```ts
interface DocNode {
	id: string;
	name: string;
	kind: DocKind;
	comment: DocComment | null;
	source: DocSource;
	type: string | null;
	signatures: DocSignature[];
	typeParameters: DocTypeParameter[];
	extends: string[];
	implements: string[];
	children: DocNode[];
	flags: DocFlags;
}
```

`DocKind` is one of `function`, `class`, `interface`, `type-alias`, `variable`,
`enum`, `enum-member`, `namespace`, `property`, `method`, `accessor` or
`constructor`.

#### `DocComment` and `DocTag`

```ts
interface DocComment {
	description: string;
	tags: DocTag[];
}

interface DocTag {
	tag: string;
	name: string | null;
	type: string | null;
	text: string;
}
```

#### `DocSignature`, `DocParameter` and `DocTypeParameter`

A symbol with one signature documents itself, so `DocSignature.comment` is filled in
only for an overloaded symbol, where each signature keeps the comment written above
it.

```ts
interface DocSignature {
	comment: DocComment | null;
	typeParameters: DocTypeParameter[];
	parameters: DocParameter[];
	returns: string | null;
}

interface DocParameter {
	name: string;
	type: string | null;
	description: string | null;
	optional: boolean;
	rest: boolean;
	default: string | null;
}
```

#### `DocReExport`

An export forwarded from another module, for the caller to resolve against the
modules it holds.

```ts
interface DocReExport {
	kind: "named" | "all" | "namespace";
	module: string;
	name: string | null;
	exported: string | null;
	typeOnly: boolean;
}
```

#### `DocFlags`, `DocSource` and `DocLink`

`DocFlags` carries `default`, `optional`, `readonly`, `static`, `abstract`, `async`,
`deprecated`, `internal` and `visibility`, always present so a template reads
`flags.deprecated` without guarding. `DocSource` is `{ path, line, column }` with
1-based positions. `DocLink` is `{ raw, target, text, index }`.

## Pattern: Resolving a barrel

An `index.ts` that only re-exports produces no symbols of its own. Extract every
module the package ships, then follow `reExports` to decide what each entry point
publishes and under which name.

```ts
let byPath = new Map(modules.map((module) => [module.path, module]));

function published(module: DocModule): DocNode[] {
	return module.reExports.flatMap((forwarded) => {
		let target = byPath.get(resolve(module.path, forwarded.module));
		if (!target) return [];
		if (forwarded.kind === "all") return published(target);
		return target.children
			.filter((node) => node.name === forwarded.name)
			.map((node) => ({ ...node, name: forwarded.exported ?? node.name }));
	});
}
```

## Pattern: Linking symbols to each other

`{@link}` targets are written as names, not ids. Index the tree by name once, then
turn each link into an href the site can route to.

```ts
let ids = new Map(modules.flatMap((module) => module.children.map((node) => [node.name, node.id])));

function render(text: string): string {
	let out = text;
	for (let link of inlineLinks(text).reverse()) {
		let id = ids.get(link.target);
		let label = link.text ?? link.target;
		let replacement = id ? `[${label}](#${encodeURIComponent(id)})` : label;
		out = out.slice(0, link.index) + replacement + out.slice(link.index + link.raw.length);
	}
	return out;
}
```

Walking the links in reverse keeps every earlier offset valid while the text is
rewritten.

## Pattern: Grouping a page by kind

`DocNode.kind` is the only thing a page needs to lay symbols out, and the tree is
uniform, so the same grouping works for a module and for the members of a class.

```ts
function byKind(nodes: DocNode[]): Map<DocKind, DocNode[]> {
	let groups = new Map<DocKind, DocNode[]>();
	for (let node of nodes) groups.set(node.kind, [...(groups.get(node.kind) ?? []), node]);
	return groups;
}
```

## Related Packages

- [`@sdxc/result`](/packages/result) - Result type the extractor reports failures with
- [`@sdxc/markdown`](/packages/markdown) - Renders the markdown a description is written in
- [`@sdxc/highlight`](/packages/highlight) - Paints the code inside an `@example`

## Tips

1. **Pass a real path** - The extension picks the dialect, so `.tsx` source parsed as
   `module.ts` fails on its first JSX element.
2. **Name ids after entry points** - Passing `id` decouples a symbol's id from where
   its file happens to live, which keeps deep links working when sources move.
3. **Write annotations you want published** - Types come from what the author wrote,
   so an exported function with an inferred return type reports `null` rather than a
   computed type.
4. **Tag implementation details `@internal`** - They are dropped by default, along
   with everything nested under them.
5. **Extract every file, then decide** - Resolution across modules is the caller's,
   so a site that follows `reExports` needs the target modules already in hand.
