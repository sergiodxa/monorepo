# @sdxc/jsdoc

Read JSDoc out of JavaScript and TypeScript source text into a JSON documentation model.

## Installation

```bash
npm add @sdxc/jsdoc
```

`extract()` reports failures as a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Extract One Module

```typescript
import { extract } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

let source = `
/** Adds two numbers. */
export function add(a: number, b: number): number {
	return a + b;
}
`;

let result = extract(source, { path: "src/add.ts" });
if (isFailure(result)) throw result.error;

result.data.children[0]?.name; // "add"
result.data.children[0]?.signatures[0]?.returns; // "number"
```

### Build The Document A Site Reads

Extract every module a package ships, then assemble them into one `DocProject`.

```typescript
import type { DocModule } from "@sdxc/jsdoc";

import { extract, SCHEMA_VERSION } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

let files = new Map([
	["src/index.ts", 'export { add } from "./add.js";'],
	[
		"src/add.ts",
		"/** Adds two numbers. */\nexport function add(a: number, b: number) {\n\treturn a + b;\n}",
	],
]);

let modules: DocModule[] = [];
for (let [path, source] of files) {
	let result = extract(source, { path });
	if (isFailure(result)) throw result.error;
	modules.push(result.data);
}

let project = { schema: SCHEMA_VERSION, name: "math", version: "1.4.0", modules };
```

### Parse A Comment On Its Own

```typescript
import { findTag, parseComment } from "@sdxc/jsdoc";

let comment = parseComment("/** Adds. @param a - The addend. @returns The sum. */");

comment.description; // "Adds."
findTag(comment, "returns")?.text; // "The sum."
```

## API

### `extract(source: string, options?: ExtractOptions): Result<DocModule, ExtractError>`

Reads one file's source text into its documentation module: the header comment, the symbols it exports, and the exports it forwards to other modules. It touches nothing outside the string it is given — no file system, no imports followed, no type checker — so the same text always yields the same document.

- `options.path`: Path the text came from, which selects the dialect from its extension (`.tsx` and `.jsx` enable JSX) and is recorded on every node's `source` (default `"module.ts"`)
- `options.id`: Prefix for every node id, as `<id>#<name>` (default: `path` with its extension removed)
- `options.includeInternal`: Keep symbols tagged `@internal`, dropped by default so a published site shows only what its readers can use (default `false`)

The file's first `/** … */` block is the module's header when a blank line follows it, when a second block follows it, or when the first statement is an import; otherwise it documents the declaration below it.

Returns a `DocModule`, or an `ExtractError` listing every syntax error with its position.

```typescript
let result = extract(source, { path: "src/add.ts", includeInternal: true });
```

### `parseComment(raw: string): DocComment`

Splits one JSDoc block into the prose before its first block tag and the tags after it. Accepts the comment with or without its `/**`/`*/` markers, collapses aliases (`@arg` and `@argument` become `param`, `@return` becomes `returns`), and keeps fenced code inside an `@example` intact even when that code contains tags of its own.

```typescript
parseComment("/** @param {string} name - The subject. */").tags;
// [{ tag: "param", name: "name", type: "string", text: "The subject." }]
```

### `findTag(comment: DocComment | null, tag: string): DocTag | null`

First tag with the given canonical name, or `null`. Takes `null` for a symbol with no comment, so a renderer asks the same way everywhere.

### `findTags(comment: DocComment | null, tag: string): DocTag[]`

Every tag with the given canonical name, in source order.

### `inlineLinks(text: string): DocLink[]`

Every `{@link}`, `{@linkcode}` and `{@linkplain}` in a description or tag text, each with the raw text it occupies and the offset it starts at, so a renderer substitutes anchors without rescanning the markdown.

```typescript
inlineLinks("See {@link parseComment|the parser}.");
// [{ raw: "{@link parseComment|the parser}", target: "parseComment", text: "the parser", index: 4 }]
```

### `SCHEMA_VERSION: number`

The number to write into `DocProject.schema`. It rises whenever a field changes meaning or disappears, so a site recognizes a document written by an older version of this package.

### `ExtractError`

The failure `extract` reports for text that will not parse, delivered inside a `Failure`. Its message leads with the first syntax error, since a later one is usually a consequence of it.

- `path`: `string` - Path the caller passed for the source text
- `diagnostics`: `DocDiagnostic[]` - Every syntax error found, in source order, each `{ message, line, column }` with 1-based positions

### Types

#### `ExtractOptions`

Options accepted by `extract()`, documented above alongside the function.

#### `DocProject`

The document a site reads. The caller assembles it from the modules it extracted, in whatever order it wants them presented.

```typescript
interface DocProject {
	schema: number;
	name: string;
	version: string | null;
	modules: DocModule[];
}
```

#### `DocModule`

One extracted file.

```typescript
interface DocModule {
	id: string;
	path: string;
	comment: DocComment | null;
	children: DocNode[];
	reExports: DocReExport[];
}
```

#### `DocNode`

One documented symbol. Members of classes, interfaces, enums and namespaces are the same shape under `children`, so one recursive renderer covers the whole tree.

```typescript
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

`DocKind` is one of `function`, `class`, `interface`, `type-alias`, `variable`, `enum`, `enum-member`, `namespace`, `property`, `method`, `accessor` or `constructor`.

#### `DocComment` and `DocTag`

```typescript
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

A symbol with one signature documents itself, so `DocSignature.comment` is filled in only for an overloaded symbol, where each signature keeps the comment written above it.

```typescript
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

An export forwarded from another module, for the caller to resolve against the modules it holds. `kind` is `named` for `export { a } from`, `all` for `export *`, or `namespace` for `export * as ns`.

```typescript
interface DocReExport {
	kind: "named" | "all" | "namespace";
	module: string;
	name: string | null;
	exported: string | null;
	typeOnly: boolean;
}
```

#### `DocFlags`, `DocSource`, `DocLink` and `DocDiagnostic`

`DocFlags` carries `default`, `optional`, `readonly`, `static`, `abstract`, `async`, `deprecated`, `internal` and `visibility`, always present so a template reads `flags.deprecated` without guarding. `DocSource` is `{ path, line, column }` with 1-based positions. `DocLink` is `{ raw, target, text, index }`. `DocDiagnostic` is `{ message, line, column }`.

## Pattern: Resolving A Barrel

An `index.ts` that only re-exports produces no symbols of its own. Extract every module a package ships, then follow `reExports` to decide what each entry point publishes and under which name.

```typescript
import type { DocModule, DocNode } from "@sdxc/jsdoc";

function published(byPath: Map<string, DocModule>, module: DocModule): DocNode[] {
	return module.reExports.flatMap((forwarded) => {
		let target = byPath.get(resolve(module.path, forwarded.module));
		if (!target) return [];
		if (forwarded.kind === "all") return published(byPath, target);
		return target.children
			.filter((node) => node.name === forwarded.name)
			.map((node) => ({ ...node, name: forwarded.exported ?? node.name }));
	});
}
```

## Pattern: Linking Symbols To Each Other

`{@link}` targets are written as names, not ids. Index the tree by name once, then turn each link into an href the site can route to.

```typescript
import type { DocModule } from "@sdxc/jsdoc";

import { inlineLinks } from "@sdxc/jsdoc";

function linkify(modules: DocModule[], text: string): string {
	let ids = new Map(
		modules.flatMap((module) => module.children.map((node) => [node.name, node.id])),
	);

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

Walking the links in reverse keeps every earlier offset valid while the text is rewritten.

## Pattern: Grouping A Page By Kind

`DocNode.kind` is the only thing a page needs to lay symbols out, and the tree is uniform, so the same grouping works for a module and for the members of a class.

```typescript
import type { DocKind, DocNode } from "@sdxc/jsdoc";

function byKind(nodes: DocNode[]): Map<DocKind, DocNode[]> {
	let groups = new Map<DocKind, DocNode[]>();
	for (let node of nodes) groups.set(node.kind, [...(groups.get(node.kind) ?? []), node]);
	return groups;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/jsdoc": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
