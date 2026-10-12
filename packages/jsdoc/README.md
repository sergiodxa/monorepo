# @sdxc/jsdoc

Read JSDoc out of JavaScript and TypeScript source text into a JSON documentation model.

## Installation

```sh
npm add @sdxc/jsdoc typescript
```

`extract()` parses with [`typescript`](https://www.npmjs.com/package/typescript), a peer
dependency, and reports failures as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package.

## Usage

### Extract one module

`extract()` reads one file's text — no file system, no imports followed, no type checker — and
documents what it exports.

```typescript
import { extract } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

let source = `
/**
 * Adds two numbers.
 * @param a - The first addend.
 * @returns The sum.
 */
export function add(a: number, b = 1): number {
	return a + b;
}
`;

let result = extract(source, { path: "src/add.ts" });
if (isFailure(result)) throw result.error;

let [add] = result.data.children;
add?.id; // "src/add#add"
add?.kind; // "function"
add?.signatures[0]?.parameters[0]; // { name: "a", type: "number", description: "The first addend.", ... }
add?.signatures[0]?.parameters[1]?.default; // "1"
add?.signatures[0]?.returns; // "number"
```

### Read a symbol's tags

Each comment is split into its description and block tags, with aliases collapsed (`@return`
becomes `returns`, `@arg` becomes `param`). `findTag` and `findTags` accept `null`, so a symbol
without a comment needs no guard.

```typescript
import type { DocNode } from "@sdxc/jsdoc";

import { findTag, findTags } from "@sdxc/jsdoc";

function summarize(node: DocNode) {
	return {
		description: node.comment?.description ?? "",
		returns: findTag(node.comment, "returns")?.text ?? null,
		examples: findTags(node.comment, "example").map((tag) => tag.text),
		deprecated: node.flags.deprecated,
	};
}
```

### Parse a comment on its own

Block tags start a line; the `/**` and `*/` markers are optional.

```typescript
import { parseComment } from "@sdxc/jsdoc";

let comment = parseComment(`/**
 * Greets someone.
 * @param {string} name - The subject.
 */`);

comment.description; // "Greets someone."
comment.tags; // [{ tag: "param", name: "name", type: "string", text: "The subject." }]
```

### Assemble the document a site reads

Extract every module a package ships and stamp the result with `SCHEMA_VERSION`.

```typescript
import type { DocModule, DocProject } from "@sdxc/jsdoc";

import { extract, SCHEMA_VERSION } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

let files = new Map([
	["src/index.ts", 'export { add } from "./add.js";'],
	["src/add.ts", "/** Adds two numbers. */\nexport function add(a: number, b: number) {}"],
]);

let modules: DocModule[] = [];
for (let [path, source] of files) {
	let result = extract(source, { path });
	if (isFailure(result)) throw result.error;
	modules.push(result.data);
}

let project: DocProject = { schema: SCHEMA_VERSION, name: "math", version: "1.4.0", modules };
let json = JSON.stringify(project);
```

## API

### `extract(source: string, options?: ExtractOptions): Result<DocModule, ExtractError>`

Reads one file into a `DocModule`: its header comment, its exported symbols and the exports it
forwards. Symbols tagged `@internal` are dropped, along with everything under them.

- `options.path`: where the text came from; `.tsx` and `.jsx` enable JSX, and it is recorded on
  every node's `source` (default `"module.ts"`)
- `options.id`: prefix for node ids, `<id>#<name>` (default: `path` without its extension)
- `options.includeInternal`: keep `@internal` symbols (default `false`)

The file's first `/** … */` block is the module comment when a blank line, a second block or an
import follows it; otherwise it documents the declaration below it.

### `parseComment(raw: string): DocComment`

Splits one JSDoc block into the prose before its first block tag and the tags after it. Fenced
code inside an `@example` stays intact, tags included.

### `findTag(comment: DocComment | null, tag: string): DocTag | null`

The first tag with the given canonical name, or `null`.

### `findTags(comment: DocComment | null, tag: string): DocTag[]`

Every tag with the given canonical name, in source order.

### `inlineLinks(text: string): DocLink[]`

Every `{@link}`, `{@linkcode}` and `{@linkplain}` in a description or tag text, with its raw text
and starting offset. Reads `{@link target}`, `{@link target|label}` and `{@link target label}`.

```typescript
inlineLinks("See {@link parseComment|the parser}.");
// [{ raw: "{@link parseComment|the parser}", target: "parseComment", text: "the parser", index: 4 }]
```

### `SCHEMA_VERSION: number`

The value for `DocProject.schema`. It rises whenever a field changes meaning or disappears.

### `ExtractError`

The error inside the `Failure` for text that does not parse. `path` is the path passed in,
`diagnostics` lists every syntax error in source order, and the message leads with the first.

### Types

#### `ExtractOptions`

The options of `extract()`.

#### `DocProject`

`{ schema, name, version, modules }`: the document a site reads, assembled by the caller in the
order it wants modules presented.

#### `DocModule`

`{ id, path, comment, children, reExports }`: one extracted file.

#### `DocNode`

One documented symbol. Members of classes, interfaces, enums and namespaces are `DocNode`s under
`children`, so one recursive renderer covers the tree.

```typescript
interface DocNode {
	id: string; // "src/point#Point.x" for a member
	name: string;
	kind: DocKind;
	comment: DocComment | null;
	source: DocSource;
	type: string | null; // annotation, alias right-hand side or enum initializer
	signatures: DocSignature[];
	typeParameters: DocTypeParameter[];
	extends: string[];
	implements: string[];
	children: DocNode[];
	flags: DocFlags;
}
```

#### `DocKind`

`function`, `class`, `interface`, `type-alias`, `variable`, `enum`, `enum-member`, `namespace`,
`property`, `method`, `accessor` or `constructor`.

#### `DocFlags`

`default`, `optional`, `readonly`, `static`, `abstract`, `async`, `deprecated`, `internal` and
`visibility` (`"public" | "protected" | "private"`), always present.

#### `DocComment` and `DocTag`

`DocComment` is `{ description, tags }`. `DocTag` is `{ tag, name, type, text }`: `name` is the
subject of `@param`, `@property`, `@template`, `@typedef` and `@callback`, `type` the text inside
`{…}`, and `text` the rest without the `-` separator.

#### `DocSignature`, `DocParameter` and `DocTypeParameter`

`DocSignature` is `{ comment, typeParameters, parameters, returns }`; `comment` is filled in per
overload, and `returns` is `null` when inferred. `DocParameter` is
`{ name, type, description, optional, rest, default }`, merged with its `@param` tag.
`DocTypeParameter` is `{ name, constraint, default, description }`, merged with its `@template`
tag.

#### `DocReExport`

`{ kind, module, name, exported, typeOnly }`: a forwarded export for the caller to resolve.
`kind` is `named` for `export { a } from`, `all` for `export *`, or `namespace` for
`export * as ns`; `module` is the specifier as written.

#### `DocSource`, `DocLink` and `DocDiagnostic`

`DocSource` is `{ path, line, column }` and `DocDiagnostic` is `{ message, line, column }`, both
1-based. `DocLink` is `{ raw, target, text, index }`.

## Pattern: Resolving A Barrel

An `index.ts` that only re-exports has no symbols of its own. Follow `reExports` across the
extracted modules to list what an entry point publishes, under the name it publishes it.

```typescript
import type { DocModule, DocNode } from "@sdxc/jsdoc";

function resolve(from: string, specifier: string): string {
	let url = new URL(specifier, `file:///${from}`);
	return url.pathname.slice(1).replace(/\.js$/, ".ts");
}

function published(byPath: Map<string, DocModule>, module: DocModule): DocNode[] {
	let forwarded = module.reExports
		.filter((entry) => entry.kind !== "namespace")
		.flatMap((entry) => {
			let target = byPath.get(resolve(module.path, entry.module));
			if (!target) return [];
			if (entry.kind === "all") return published(byPath, target);
			return target.children
				.filter((node) => node.name === entry.name)
				.map((node) => ({ ...node, name: entry.exported ?? node.name }));
		});
	return [...module.children, ...forwarded];
}

function entryPoint(modules: DocModule[], path: string): DocNode[] {
	let byPath = new Map(modules.map((module) => [module.path, module]));
	let entry = byPath.get(path);
	return entry ? published(byPath, entry) : [];
}
```

## Pattern: Linking Symbols To Each Other

`{@link}` targets are names. Index the tree by name once, then replace each link with an anchor
to the node's id.

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

Walking the links in reverse keeps every earlier offset valid while the text changes.

## Pattern: Rendering The Tree By Kind

The tree is uniform, so one function groups a module's symbols and a class's members alike, and
`flags` drive the badges.

```typescript
import type { DocKind, DocNode } from "@sdxc/jsdoc";

function byKind(nodes: DocNode[]): Map<DocKind, DocNode[]> {
	let groups = new Map<DocKind, DocNode[]>();
	for (let node of nodes) groups.set(node.kind, [...(groups.get(node.kind) ?? []), node]);
	return groups;
}

function outline(nodes: DocNode[], depth = 0): string[] {
	return [...byKind(nodes)].flatMap(([kind, group]) => [
		`${"  ".repeat(depth)}${kind}:`,
		...group.flatMap((node) => {
			let badges = [node.flags.static && "static", node.flags.deprecated && "deprecated"];
			let label = [node.name, ...badges.filter(Boolean)].join(" ");
			return [`${"  ".repeat(depth + 1)}${label}`, ...outline(node.children, depth + 2)];
		}),
	]);
}
```

## Pattern: Reporting Syntax Errors

Point at each line that failed to parse instead of failing the whole build with one message.

```typescript
import { extract } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";

let result = extract(source, { path: "src/broken.ts" });

if (isFailure(result)) {
	for (let { message, line, column } of result.error.diagnostics) {
		process.stderr.write(`${result.error.path}:${line}:${column} ${message}\n`);
	}
}
```

## Pattern: A Maintainers' Build With Internal Symbols

Keep `@internal` symbols for a contributors' site and give its node ids their own prefix, so its
anchors never collide with the public site's.

```typescript
import { extract } from "@sdxc/jsdoc";

let result = extract(source, {
	path: "src/cache.ts",
	id: "internal/cache",
	includeInternal: true,
});
// node ids read "internal/cache#<name>", and nodes with flags.internal stay in the tree
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
