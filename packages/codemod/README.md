# @sdxc/codemod

Source-to-source edits of JavaScript and TypeScript imports and declarations, changing only the edited ranges.

## Installation

```sh
npm add @sdxc/codemod
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside this package. There is no other runtime dependency: the scanner is plain JavaScript and runs on Node, Bun, Deno or a Worker.

## Usage

### Find every module a file references

```typescript
import { findModuleReferences } from "@sdxc/codemod";
import { isFailure } from "@sdxc/result";

let references = findModuleReferences("page.tsx", source, { calls: ["vi.mock"] });
if (isFailure(references)) throw references.error; // "page.tsx:12:8: string is never closed"

for (let reference of references.data) {
	reference.kind; // "import" | "export" | "dynamic" | "call"
	reference.specifier; // "./button.js"
	reference.names; // [{ imported: "Button", local: "Button", typeOnly: false, range }]
}
```

The file name's extension decides what the scanner reads: `.js`, `.mjs` and `.cjs` as JavaScript, `.jsx` with JSX, `.ts`, `.mts` and `.cts` as TypeScript, and `.tsx` as TypeScript with JSX. Strings, template literals, regular expressions, comments and JSX text are tokens of their own, so `<p>Don't import "./x.js"</p>` names no module.

### Rewrite specifiers

```typescript
import { rewriteSpecifiers } from "@sdxc/codemod";

let rewritten = rewriteSpecifiers("dialog.tsx", source, (reference) =>
	reference.specifier.startsWith("@acme/") ? reference.specifier.replace("@acme/", "acme/") : null,
);
// success({ source: "…", changed: true, unhandled: [] })
```

Only the string literals that change are replaced, each in its original quote character.

### Move named imports to another module

```typescript
import { moveImports } from "@sdxc/codemod";

let moved = moveImports("page.tsx", 'import { Button, Dialog } from "acme/ui";\n', {
	from: "acme/ui",
	names: ["Button"],
	to: "~/components/ui/button.js",
});
// import { Dialog } from "acme/ui";
// import { Button } from "~/components/ui/button.js";
```

### Add to a declaration object and to a sequence of calls

```typescript
import { addProperty, insertAfterLast } from "@sdxc/codemod";

let declared = addProperty("index.ts", source, {
	call: "jobs",
	path: ["trials"],
	key: "expire",
	value: "job({ input: s.object({}) })",
});

let mapped = insertAfterLast("dispatcher.ts", source, {
	call: "dispatcher.map",
	statement: 'dispatcher.map(jobs.trials.expire, () => import("./jobs/expire.js"));',
	fallbackAfter: "createJobDispatcher",
});
```

## API

### `findModuleReferences(filename: string, source: string, options?: FindOptions): Result<ModuleReference[], CodemodError>`

Every static import and side-effect import, every `export … from`, every `import()` whose argument is a string literal, and the first argument of each call whose callee is listed in `options.calls` (dotted paths such as `vi.mock`, or `require`), in source order. These are the specifiers a module loader resolves: imports and re-exports at the top level, where ECMAScript allows them, and `import()` in expressions. TypeScript import types (`typeof import("…")`, `import("…").Name`) and `import x = require("…")` belong to the type checker and to CommonJS, and stay out of the list.

### `rewriteSpecifiers(filename, source, map, options?): Result<Edit, CodemodError>`

Replaces the specifier of every reference `map` answers a string for; `null` leaves it untouched. `options.calls` adds listed calls to the references `map` sees.

### `moveImports(filename, source, options: MoveOptions): Result<Edit, CodemodError>`

Moves the named imports and named re-exports `options.names` (as the module exports them, whatever alias a declaration gives them) from `options.from` to `options.to`.

- A declaration whose names all move has its specifier replaced in place.
- Otherwise the declaration keeps the rest, and a declaration for the moved names follows it, keeping aliases, `type` modifiers, `import type`, the quote character and the semicolon style.
- When a declaration of the same kind for `options.to` exists, the moved names join it, one per line when its list is written one per line.
- Default imports, namespace imports and `export *` of `options.from` cannot be split by name. They are returned in `unhandled` and left as they are.

### `addProperty(filename, source, options: AddPropertyOptions): Result<Edit, CodemodError>`

Appends `key: value` to the object literal passed as the first argument of the first call to `options.call`. `options.path` walks nested object literals by key; a value that is a call, such as `route("/prefix", { … })`, is walked through its object argument, and a missing level is created. The property follows the last one with its siblings' indentation and trailing-comma style. An existing key fails with `duplicate-key`.

### `insertAfterLast(filename, source, options: InsertOptions): Result<Edit, CodemodError>`

Places `options.statement` on a new line after the last statement that calls `options.call`, at that statement's indentation. With no such call, it follows the variable declaration whose initializer calls `options.fallbackAfter`; with neither, it fails with `not-found`.

`value` and `statement` are source text: every line after the first is indented to match the surrounding code, and nothing else about them changes. Run the project's formatter afterwards for anything beyond indentation.

### `Edit`

`{ source, changed, unhandled }`: the edited text (the input itself when nothing `changed`), and for `moveImports` the references it matched but could not change. Every edit scans its own output again and fails with `invalid-output` instead of returning source that does not scan.

### `CodemodError`

The failure every function reports. Input that ends inside a string, template literal, regular expression, comment or JSX element, unbalanced brackets, or an import declaration outside the grammar fail before any edit is computed. The fields are:

- `code`: `"unsupported-file"`, `"unterminated"`, `"unbalanced"`, `"unexpected-character"`, `"invalid-declaration"`, `"not-found"`, `"duplicate-key"` or `"invalid-output"`.
- `filename`: the name the caller passed.
- `offset`: the UTF-16 offset the failure concerns, or `null`; `message` carries it as `line:column`.

### Types

#### `ModuleReference`

`{ kind, specifier, typeOnly, names, range, specifierRange, callee, braces }`. `range` covers the whole declaration (its `;` included) or call; `specifierRange` covers the string literal, quotes included; `braces` covers the `{ … }` name list when there is one. Ranges are UTF-16 offsets, as `String.prototype.slice` reads them.

#### `BoundName`

`{ imported, local, typeOnly, range }`. `imported` is `"default"` for a default import and `"*"` for a namespace; for a re-export, `local` is the exported name.

## Patterns

### Pattern: Point a project at its own copy of a component

Move the component's import in every file, and report the imports that need a hand edit.

```typescript
import { readFile, writeFile } from "node:fs/promises";

import { moveImports } from "@sdxc/codemod";
import { isFailure } from "@sdxc/result";

async function adopt(files: string[], name: string, to: string) {
	for (let file of files) {
		let source = await readFile(file, "utf8");
		let edit = moveImports(file, source, { from: "acme/ui", names: [name], to });
		if (isFailure(edit)) {
			console.warn(`Change the import of ${name} in ${file} by hand: ${edit.error.message}`);
			continue;
		}
		for (let reference of edit.data.unhandled) {
			console.warn(`${file}: ${source.slice(reference.range.start, reference.range.end)}`);
		}
		if (edit.data.changed) await writeFile(file, edit.data.source);
	}
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
		"@sdxc/codemod": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
