---
title: Generate reference docs from JSDoc
description: Read the JSDoc in your TypeScript source at build time, emit JSON, and serve an API reference page for every public symbol.
section:
    title: Content & feeds
    order: 7
order: 6
lastUpdated: 2026-09-29
---

The comments above your exported functions already say what each parameter means, what comes
back and how to call it. An API reference built from them stays correct for as long as the
comments do, and a test can keep those comments from going missing. This guide builds one: a
build script reads your package's source into a JSON documentation model, trims it to the
records a page needs, and a route renders one page per public symbol.

[`@sdxc/jsdoc`](/api/jsdoc) reads JSDoc out of JavaScript and TypeScript source text. It parses
with the TypeScript compiler, which is larger than a whole Worker and expects globals a Worker
does not have, so it runs in the build and the Worker only ever reads the JSON it produced.

```bash
npm add -D @sdxc/jsdoc @sdxc/result typescript
```

`typescript` is a peer dependency, so the extraction parses with the compiler version your
project already uses.

## Read every module

`extract(source, { path })` turns one file's text into a `DocModule`: its header comment, the
symbols it exports, and the exports it forwards from other modules. It reads only the string
it is given, with no file system, no imports followed and no type checker, so the same text
always produces the same document. Walking the files is your part:

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

`path` selects the dialect from the extension, so a `.tsx` file parses with JSX, and it becomes
each symbol's `source`, which is what a "view source" link needs. A file that does not parse
comes back as an `ExtractError` whose `diagnostics` list every syntax error with its line and
column. Symbols tagged `@internal` are left out unless you pass `includeInternal: true`, so a
helper you export for your own tests stays off the public site.

## Find what the entry point publishes

A barrel such as `src/index.ts` that only re-exports produces no symbols of its own. Its
`reExports` list what it forwards, and following them from the entry point is what decides
which symbols are public and under which name:

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

`kind` is `named` for `export { a } from`, `all` for `export *`, and `namespace` for
`export * as ns from`. A namespace forward matches no child by name here, so give it a page of
its own if your package uses one.

## Shape the records a page reads

A `DocNode` is the whole model: signatures, type parameters, flags, members nested under
`children`. The page needs less than that, and whatever the build leaves in the JSON the Worker
ships, so turn each symbol into the record a page renders while the extractor's helpers are
still at hand:

```typescript {% title="scripts/reference-pages.ts" %}
import type { DocNode } from "@sdxc/jsdoc";

import { findTag, findTags, inlineLinks } from "@sdxc/jsdoc";

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

function linked(text: string, names: Set<string>): string {
	let out = text;
	for (let link of inlineLinks(text).reverse()) {
		let label = link.text ?? link.target;
		let target = names.has(link.target)
			? `[${label}](/reference/${link.target})`
			: label;
		out =
			out.slice(0, link.index) +
			target +
			out.slice(link.index + link.raw.length);
	}
	return out;
}

export function toPage(node: DocNode, names: Set<string>): ReferencePage {
	let signature = node.signatures[0];
	return {
		name: node.name,
		kind: node.kind,
		description: linked(node.comment?.description ?? "", names),
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

`inlineLinks` finds every `{@link}` with the offset it starts at, and walking them in reverse
keeps each earlier offset valid while the text is rewritten. A link to a symbol the reference
has becomes a markdown link to its page; any other target keeps its label. `findTag` takes
`null` for a symbol with no comment, so nothing above needs a guard. Every parameter's
`description` is already filled in from its `@param` tag, and `flags` is always present, so
`flags.deprecated` reads without one either.

## Write the JSON at build time

The script ties the three together, fails the build on a file that does not parse, and writes
two documents: the full model, for any tool that wants it, and the pages, for the Worker:

```typescript {% title="scripts/extract-reference.ts" %}
import type { DocProject } from "@sdxc/jsdoc";

import { SCHEMA_VERSION } from "@sdxc/jsdoc";
import { mkdirSync, writeFileSync } from "node:fs";

import { publicSymbols } from "~/scripts/public-symbols";
import { readSources } from "~/scripts/read-sources";
import { toPage } from "~/scripts/reference-pages";

main();

function main(): void {
	let { modules, errors } = readSources("src");
	for (let error of errors) console.error(error.message);
	if (errors.length > 0) process.exit(1);

	let project: DocProject = {
		schema: SCHEMA_VERSION,
		name: "shelf",
		version: null,
		modules,
	};
	let symbols = publicSymbols(modules, "src/index.ts");
	let names = new Set(symbols.map((node) => node.name));
	let pages = Object.fromEntries(
		symbols.map((node) => [node.name, toPage(node, names)]),
	);

	mkdirSync("app/generated", { recursive: true });
	writeFileSync("app/generated/api.json", JSON.stringify(project));
	writeFileSync("app/generated/reference.json", JSON.stringify({ pages }));
}
```

`SCHEMA_VERSION` rises whenever a field of the model changes meaning or disappears, so a
consumer of `api.json` can recognize a document an older version wrote. An `ExtractError`'s
message leads with the first syntax error, since a later one is usually a consequence of it.

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

Add `app/generated/` to `.gitignore`: it is output, rebuilt on every run.

## Serve a page per symbol

The Worker reads the JSON inside the request that needs it. Importing it dynamically keeps the
parse out of the Worker's startup, and the only thing it takes from the build scripts is a
type, which the bundler erases:

```typescript {% title="app/services/reference.ts" %}
import type { ReferencePage } from "~/scripts/reference-pages";

interface ReferenceDocument {
	pages: Record<string, ReferencePage>;
}

export async function findReference(name: string): Promise<ReferencePage | null> {
	let { default: document } = await import("~/app/generated/reference.json");
	let { pages } = document as ReferenceDocument;
	return Object.hasOwn(pages, name) ? (pages[name] ?? null) : null;
}
```

The name comes from the URL, and `Object.hasOwn` is what keeps `/reference/constructor` from
answering with something inherited. The route is a `get("/reference/:name")`:

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

Descriptions and tag text are markdown as the author wrote it, links included once the build has
rewritten them, and an `@example` may carry its own code fence. Put them through
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) to render the
formatting, and through its highlighter for the examples.

## Keep every public symbol documented

The same two functions the build uses make a test that fails when an export ships without a
comment, which is the one way a generated reference goes quietly wrong:

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

A failure names each symbol with the file and line to fix. The same walk can check that every
function documents its parameters, by comparing `signatures[0].parameters` against the
`description` each one carries.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — render the
  descriptions and highlight the examples.
- [SEO, sitemaps and robots.txt](/docs/building-remix-apps/seo-sitemaps-and-robots) — list
  every reference page in the sitemap.
- [Test Workers apps](/docs/operations-and-testing/testing) — where the documentation test
  runs.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — more on
  parsing `ctx.params`.
