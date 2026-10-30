---
title: Generate reference docs from JSDoc
description: Read the JSDoc in your TypeScript source at build time, emit JSON, and serve an API reference page for every public symbol.
section:
    title: Content & feeds
    order: 8
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How to read the JSDoc in your TypeScript source at build time with `@sdxc/jsdoc`"
    - "How to write the records as JSON and serve a page per public symbol"
    - "How to keep every public symbol documented"
---

The comments above your exported functions already say what each parameter means, what comes
back and how to call it. An API reference built from them stays correct for as long as the
comments do, and a test can keep those comments from going missing. This guide builds one: a
build script reads your package's source into a JSON documentation model, trims it to the
records a page needs, and a route renders one page per public symbol.

[`@sdxc/jsdoc`](/api/jsdoc) reads JSDoc out of JavaScript and TypeScript source text.

> [!WARNING]
> `@sdxc/jsdoc` parses with the TypeScript compiler, which is larger than a whole Worker and
> expects globals a Worker lacks. Run it in the build, and let the Worker read only the JSON it
> produced.

```bash
npm add @sdxc/http @sdxc/result remix
npm add -D @sdxc/jsdoc typescript
```

## Read every module

`extract(source, { path })` turns one file's text into a `DocModule`: its header comment, the
symbols it exports, and the exports it forwards. It reads only the string it is given, so
walking the files is your part:

```typescript {% title="scripts/read-sources.ts" %}
import type { DocModule, ExtractError } from "@sdxc/jsdoc";

import { extract } from "@sdxc/jsdoc";
import { isFailure } from "@sdxc/result";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Sources {
	modules: DocModule[];
	errors: ExtractError[];
}

export function readSources(root: string): Sources {
	let sources: Sources = { modules: [], errors: [] };

	for (let file of readdirSync(root, {
		recursive: true,
		encoding: "utf8",
	}).sort()) {
		if (!/\.tsx?$/.test(file) || /\.(test|d)\.tsx?$/.test(file)) continue;

		let path = `${root}/${file.replaceAll("\\", "/")}`;
		let result = extract(readFileSync(join(root, file), "utf8"), { path });
		if (isFailure(result)) sources.errors.push(result.error);
		else sources.modules.push(result.data);
	}

	return sources;
}
```

`path` selects the dialect from the extension and becomes each symbol's `source`. A file that
does not parse comes back as an `ExtractError` listing every syntax error with its line, and
symbols tagged `@internal` are left out.

## Find what the entry point publishes

A barrel such as `src/index.ts` produces no symbols of its own. Following its `reExports` from
the entry point decides which symbols are public and under which name:

```typescript {% title="scripts/public-symbols.ts" %}
import type { DocModule, DocNode } from "@sdxc/jsdoc";

import { posix } from "node:path";

function resolve(from: string, specifier: string): string {
	return posix.join(posix.dirname(from), specifier).replace(/\.js$/, ".ts");
}

function published(byPath: Map<string, DocModule>, module: DocModule): DocNode[] {
	let forwarded = module.reExports.flatMap((reExport) => {
		let target = byPath.get(resolve(module.path, reExport.module));
		if (!target) return [];
		if (reExport.kind === "all") return published(byPath, target);
		return target.children
			.filter((node) => node.name === reExport.name)
			.map((node) => ({ ...node, name: reExport.exported ?? node.name }));
	});
	return [...module.children, ...forwarded];
}

export function publicSymbols(modules: DocModule[], entry: string): DocNode[] {
	let byPath = new Map(modules.map((module) => [module.path, module]));
	let root = byPath.get(entry);
	return root ? published(byPath, root) : [];
}
```

An `export * as ns from` forward matches no child by name here, so give it a page of its own if
your package uses one.

## Shape the records a page reads

A `DocNode` is the whole model, and whatever the build leaves in the JSON the Worker ships, so
turn each symbol into the record a page renders:

```typescript {% title="scripts/reference-pages.ts" %}
import type { DocNode } from "@sdxc/jsdoc";

import { findTag, findTags } from "@sdxc/jsdoc";

export interface ReferencePage {
	name: string;
	kind: string;
	description: string;
	parameters: { name: string; type: string | null; description: string | null }[];
	returns: { type: string | null; description: string | null };
	examples: string[];
	deprecated: string | null;
	source: string;
}

export function toPage(node: DocNode): ReferencePage {
	let signature = node.signatures[0];
	return {
		name: node.name,
		kind: node.kind,
		description: node.comment?.description ?? "",
		parameters: (signature?.parameters ?? []).map((parameter) => ({
			name: parameter.optional ? `${parameter.name}?` : parameter.name,
			type: parameter.type,
			description: parameter.description,
		})),
		returns: {
			type: signature?.returns ?? null,
			description: findTag(node.comment, "returns")?.text ?? null,
		},
		examples: findTags(node.comment, "example").map((tag) => tag.text.trim()),
		deprecated: node.flags.deprecated
			? (findTag(node.comment, "deprecated")?.text ?? "")
			: null,
		source: `${node.source.path}:${node.source.line}`,
	};
}
```

`findTag` takes `null` for a symbol with no comment, so nothing above needs a guard, and every
parameter's `description` is already filled in from its `@param` tag.

## Write the JSON at build time

The script ties the three together, fails the build on a file that does not parse, and writes
the pages for the Worker:

```typescript {% title="scripts/extract-reference.ts" %}
import { mkdirSync, writeFileSync } from "node:fs";

import { publicSymbols } from "~/scripts/public-symbols";
import { readSources } from "~/scripts/read-sources";
import { toPage } from "~/scripts/reference-pages";

main();

function main(): void {
	let { modules, errors } = readSources("src");
	for (let error of errors) process.stderr.write(`${error.message}\n`);
	if (errors.length > 0) process.exit(1);

	let symbols = publicSymbols(modules, "src/index.ts");
	let pages = Object.fromEntries(symbols.map((node) => [node.name, toPage(node)]));

	mkdirSync("resources/generated", { recursive: true });
	writeFileSync("resources/generated/reference.json", JSON.stringify({ pages }));
}
```

Run the script before the dev server and the build, so the pages always describe the source as
it is now:

```json
{
	"scripts": {
		"dev": "bun scripts/extract-reference.ts && vite dev",
		"build": "bun scripts/extract-reference.ts && vite build"
	}
}
```

Add `resources/generated/` to `.gitignore`: it is output, rebuilt on every run.

## Serve a page per symbol

The Worker imports the JSON dynamically inside the request that needs it, which keeps the parse
out of startup; it takes only a type from the build scripts:

```typescript {% title="app/services/reference.ts" %}
import type { ReferencePage } from "~/scripts/reference-pages";

interface ReferenceDocument {
	pages: Record<string, ReferencePage>;
}

export async function findReference(name: string): Promise<ReferencePage | null> {
	let { default: document } = await import("~/resources/generated/reference.json");
	let { pages } = document as ReferenceDocument;
	return Object.hasOwn(pages, name) ? (pages[name] ?? null) : null;
}
```

> [!NOTE]
> The name comes from the URL, and `Object.hasOwn` is what keeps `/reference/constructor` from
> answering with something inherited.

The route is a `get("/reference/:name")`:

```tsx {% title="app/http/controllers/reference.tsx" %}
import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { findReference } from "~/app/services/reference";
import routes from "~/routes/web";

export default createAction(routes.reference.show, async (ctx) => {
	let { name } = s.parse(s.object({ name: s.string() }), ctx.params);
	let page = await findReference(name);
	if (page === null) return notFound("No such symbol");

	return ctx.render(
		<article>
			<h1>{page.name}</h1>
			{page.deprecated !== null && (
				<p role="note">Deprecated. {page.deprecated}</p>
			)}
			<p>{page.description}</p>
			<dl>
				{page.parameters.map((parameter) => (
					<>
						<dt>
							<code>{parameter.name}</code> {parameter.type}
						</dt>
						<dd>{parameter.description}</dd>
					</>
				))}
			</dl>
			{page.examples.map((example) => (
				<pre>
					<code>{example}</code>
				</pre>
			))}
		</article>,
	);
});
```

Descriptions and tag text are markdown as the author wrote it; put them through
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) to render the
formatting.

## Keep every public symbol documented

The same two functions the build uses make a test that fails when an export ships without a
comment:

```typescript {% title="scripts/reference.test.ts" %}
import { expect, test } from "vitest";

import { publicSymbols } from "~/scripts/public-symbols";
import { readSources } from "~/scripts/read-sources";

test("every public symbol has a description", () => {
	let { modules, errors } = readSources("src");
	expect(errors).toEqual([]);

	let undocumented = publicSymbols(modules, "src/index.ts")
		.filter((node) => !node.comment?.description)
		.map((node) => `${node.name} at ${node.source.path}:${node.source.line}`);
	expect(undocumented).toEqual([]);
});
```

A failure names each symbol with the file and line to fix.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — render the
  descriptions and highlight the examples.
- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — list
  every reference page in the sitemap.
- [Test Workers apps](/docs/operations-and-testing/testing) — where the documentation test
  runs.
