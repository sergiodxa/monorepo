---
title: Edit source files
description: Find the modules a project imports, rename a package across every file, move names to another module, and add declarations and calls, changing only the text each edit touches.
section:
    title: Operations & testing
    order: 9
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "How to find the modules a project imports"
    - "How to rename a package or move names to another module across every file"
    - "How to add declarations and calls while changing only the text each edit touches"
---

A tool that changes code for people, such as a migration script, a generator or an upgrade
step, has to leave everything it did not mean to change exactly as it was: the formatting, the
comments, the quote style. A diff of its work should show the edit and nothing else.

[`@sdxc/codemod`](/api/codemod) makes source-to-source edits to the imports and declarations of
JavaScript and TypeScript files. It scans the text rather than rebuilding it from a syntax
tree, so each edit replaces only the ranges it changes. Every function answers a `Result`, and
it has no runtime dependency, so it runs in a script on Node or Bun as well as in a Worker.

```bash
npm add @sdxc/codemod @sdxc/result
```

The examples read files from a project; `projectFiles` walks it:

```typescript {% title="scripts/project-files.ts" %}
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

export async function projectFiles(root: string) {
	let entries = await readdir(root, { recursive: true });
	return entries
		.filter((path) => SOURCE.test(path) && !path.includes("node_modules"))
		.map((path) => join(root, path));
}
```

## Find what a project imports

`findModuleReferences` lists every module a file names, in source order: static imports and
re-exports, side-effect imports, and `import()` with a string argument. Each reference carries
its `kind`, its `specifier`, whether it is `typeOnly`, the names it binds, and the ranges they
occupy:

```typescript {% title="scripts/used-packages.ts" %}
import { readFile } from "node:fs/promises";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure } from "@sdxc/result";

import { projectFiles } from "./project-files.js";

let used = new Set<string>();
for (let file of await projectFiles(process.cwd())) {
	let references = findModuleReferences(file, await readFile(file, "utf8"), {
		calls: ["vi.mock"],
	});
	if (isFailure(references)) {
		process.stderr.write(`${references.error.message}\n`);
		continue;
	}
	for (let reference of references.data) {
		let match = /^@sdxc\/([^/]+)/.exec(reference.specifier);
		if (match?.[1] !== undefined) used.add(match[1]);
	}
}
process.stdout.write(`${[...used].sort().join("\n")}\n`);
```

The file name's extension decides how the text is read, `.tsx` as TypeScript with JSX. Strings,
comments and JSX text are tokens of their own, so a specifier written inside a string is never
mistaken for an import. `calls` adds the first argument of listed calls, such as `vi.mock`, as
`call` references. A file the scanner cannot read fails with its position, such as
`page.tsx:12:8: string is never closed`.

## Rename a package everywhere

`rewriteSpecifiers` replaces each specifier the function answers a string for and leaves the
rest; `null` means untouched. Only the string literals that change are rewritten, each in its
original quote character:

```typescript {% title="scripts/rename-package.ts" %}
import { readFile, writeFile } from "node:fs/promises";

import { rewriteSpecifiers } from "@sdxc/codemod";
import { isFailure } from "@sdxc/result";

import { projectFiles } from "./project-files.js";

const FROM = "@acme/ui";
const TO = "@acme/design";

for (let file of await projectFiles(process.cwd())) {
	let source = await readFile(file, "utf8");
	let edit = rewriteSpecifiers(file, source, ({ specifier }) =>
		specifier === FROM || specifier.startsWith(`${FROM}/`)
			? `${TO}${specifier.slice(FROM.length)}`
			: null,
	);
	if (isFailure(edit)) {
		process.stderr.write(`${edit.error.message}\n`);
		continue;
	}
	if (edit.data.changed) await writeFile(file, edit.data.source);
}
```

`@acme/ui/icons` becomes `@acme/design/icons`, and a dynamic `import("@acme/ui/chart")`
moves with the static imports. Writing only when `changed` keeps every untouched file's
modification time.

## Move names to another module

`moveImports` moves some names a module exports to another module, in every declaration that
imports or re-exports them:

```typescript {% title="scripts/adopt-dialog.ts" %}
import { moveImports } from "@sdxc/codemod";

let edit = moveImports("page.tsx", source, {
	from: "@acme/ui",
	names: ["Dialog"],
	to: "~/components/dialog",
});
```

```tsx {% title="page.tsx" %}
import { Button } from "@acme/ui";
import { Dialog } from "~/components/dialog";
```

A declaration whose names all move has its specifier replaced in place. Otherwise it keeps the
rest, and the moved names join one declaration of the new module, keeping their aliases and
`type` modifiers. A namespace import of the old module, such as `import * as ui from "@acme/ui"`,
still reaches the moved name as `ui.Dialog`; the edit returns it in `unhandled`, so report each
one for a person to change.

## Add a declaration and its call

A generator that adds a job, a route or a command usually makes two edits: a property in a
declaration object, and a call that maps it. `addProperty` appends `key: value` to the object
literal passed to the first call of `call`, walking into nested objects through `path` and
creating the levels that are missing:

```typescript {% title="scripts/add-job.ts" %}
import { addProperty, insertAfterLast } from "@sdxc/codemod";

let declared = addProperty("app/jobs/index.ts", jobsSource, {
	call: "jobs",
	path: ["reports"],
	key: "daily",
	value: 'job({ cron: "0 8 * * *" })',
});

let mapped = insertAfterLast("app/initializers/dispatcher.ts", dispatcherSource, {
	call: "dispatcher.map",
	statement:
		'dispatcher.map(jobs.reports.daily, () => import("~/app/jobs/reports/daily"));',
	fallbackAfter: "createJobDispatcher",
});
```

```typescript {% title="app/jobs/index.ts" %}
export default jobs({
	sendConfirmation: job({ input: s.object({ postingId: s.string() }) }),
	reports: {
		daily: job({ cron: "0 8 * * *" }),
	},
});
```

The property follows the last one, with its siblings' indentation and trailing-comma style. A
key that already exists fails with `duplicate-key`, so running the generator twice cannot
declare a job twice. `insertAfterLast` places the statement after the last statement that
calls `dispatcher.map`; with no such call yet, it follows the declaration that calls
`createJobDispatcher`, and with neither it fails with `not-found`.

> [!WARNING]
> Compute both edits before writing either. When one fails, write neither and print both for a
> person to make, so a declaration never lands without the call that maps it.

Every edit scans its own output again and fails with `invalid-output` rather than return text
that does not scan. `value` and `statement` are inserted as written apart from indentation, so
run the project's formatter over the files you wrote.

## Test an edit against a fixture

Each edit takes a file name and its text and answers the new text, so a test needs no files:
write the source as a string, run the edit, and compare the whole output. Comparing the whole
string is what proves the edit touched nothing else.

```typescript {% title="scripts/rename-package.test.ts" %}
import { addProperty, rewriteSpecifiers } from "@sdxc/codemod";
import { expect, test } from "vitest";

test("renames the package and leaves the rest of the file as it was", () => {
	let source = [
		"import { Button } from '@acme/ui';",
		'import { Chart } from "@acme/ui-charts";',
		'let icons = import("@acme/ui/icons"); // loaded on demand',
	].join("\n");

	let edit = rewriteSpecifiers("page.tsx", source, ({ specifier }) =>
		specifier === "@acme/ui" || specifier.startsWith("@acme/ui/")
			? `@acme/design${specifier.slice("@acme/ui".length)}`
			: null,
	);

	expect(edit).toMatchObject({
		status: "success",
		data: {
			changed: true,
			source: [
				"import { Button } from '@acme/design';",
				'import { Chart } from "@acme/ui-charts";',
				'let icons = import("@acme/design/icons"); // loaded on demand',
			].join("\n"),
		},
	});
});

test("refuses to declare a job twice", () => {
	let source = [
		"export default jobs({",
		'\treports: { daily: job({ cron: "0 8 * * *" }) },',
		"});",
	].join("\n");
	let edit = addProperty("app/jobs/index.ts", source, {
		call: "jobs",
		path: ["reports"],
		key: "daily",
		value: 'job({ cron: "0 8 * * *" })',
	});
	expect(edit).toMatchObject({
		status: "failure",
		error: { code: "duplicate-key" },
	});
});
```

## Where to go next

- [Generate files](/docs/sdxc/generate-files) — `sdxc make`, which makes these edits for you
  and undoes them with `sdxc destroy`.
- [Build a command line](/docs/operations-and-testing/build-a-command-line) — turn a script like
  these into a command with flags and a `--dry-run`.
- [`@sdxc/codemod`](/api/codemod) — every option, reference field and error code.
