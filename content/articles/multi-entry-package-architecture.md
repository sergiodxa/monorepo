---
title: Multi-Entry Package Architecture
excerpt: Structure packages with multiple entry points to separate server and client code cleanly.
technologies: typescript@5.0.0
---

Modern JavaScript packages rarely export everything from a single entry point. A markdown library might include a parser that runs on the server and a renderer that runs in the browser, like when you [build a type-safe markdown pipeline with Markdoc](/tutorials/build-a-type-safe-markdown-pipeline-with-markdoc). A UI library might export components alongside CSS files. Bundling all of this into one entry forces consumers to import code they do not need, bloating their bundles and potentially breaking their builds.

The multi-entry package architecture solves this by exposing multiple entry points through the `exports` field in `package.json`. Each entry point serves a specific purpose, allowing consumers to import only what they need.

## The Problem with Single Entry Points

Consider a markdown package that parses markdown on the server and renders it in React on the client. A single entry point would look like this:

```ts {% path="packages/markdown/src/index.ts" %}
// Server-only code
export { Markdown, MarkdownParseError } from "./server/index.js";

// Client-only code
export { MarkdownView } from "./client/index.js";
```

This creates several problems:

1. **Bundle bloat**: Importing `MarkdownView` in the browser pulls in the entire Markdoc parser, YAML parser, and Prism.js syntax highlighter, even though rendering only needs the React renderer.

2. **Server code in client bundles**: The server code might use Node.js APIs or dependencies that do not work in browsers, causing build errors or runtime crashes.

3. **Tree-shaking limitations**: While bundlers can theoretically remove unused exports, they struggle with side effects and complex dependency graphs. A single entry point makes this harder.

## Structuring Multiple Entry Points

The solution is to split the package into multiple entry points, each with its own purpose. Here is how a markdown package might structure this:

```json {% path="packages/markdown/package.json" %}
{
	"name": "my-markdown",
	"type": "module",
	"exports": {
		"./server": "./src/server/index.ts",
		"./client": "./src/client/index.tsx",
		"./styles/light.css": "./styles/prism-light.css",
		"./styles/dark.css": "./styles/prism-dark.css"
	}
}
```

Each key in the `exports` object is a subpath that consumers can import:

```ts
// Server-side: parse markdown
import { Markdown } from "my-markdown/server";

// Client-side: render parsed content
import { MarkdownView } from "my-markdown/client";

// Styles: import in CSS or JS
import "my-markdown/styles/light.css";
```

The directory structure mirrors this separation:

```txt
packages/markdown/
  src/
    server/
      index.ts      # Markdown parser, frontmatter extraction
      fence.ts      # Code block handling with Prism.js
    client/
      index.tsx     # MarkdownView React component
      fence.tsx     # Code block component with copy button
  styles/
    prism-light.css
    prism-dark.css
```

## Server Entry Point

The server entry point exports everything needed to parse markdown:

```ts {% path="packages/markdown/src/server/index.ts" %}
import type { Config, RenderableTreeNodes } from "@markdoc/markdoc";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as Markdoc from "@markdoc/markdoc";
import YAML from "yaml";

import { fence } from "./fence.js";

export class MarkdownParseError extends Error {
	override name = "MarkdownParseError";
	issues: ReadonlyArray<StandardSchemaV1.Issue>;

	constructor(
		message: string,
		issues: ReadonlyArray<StandardSchemaV1.Issue> = [],
		options?: ErrorOptions,
	) {
		super(message, options);
		this.issues = issues;
	}
}

// Using a Result type for error handling
// See: /articles/result-objects-in-ts
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export namespace Markdown {
	export interface Parsed<FM> {
		content: RenderableTreeNodes;
		frontmatter: FM;
	}

	export interface Options<Schema extends StandardSchemaV1> {
		frontmatter: Schema;
		markdoc?: Config;
	}
}

export class Markdown<Schema extends StandardSchemaV1> {
	#options: Markdown.Options<Schema>;

	constructor(options: Markdown.Options<Schema>) {
		this.#options = options;
	}

	parse(
		raw: string,
	): Result<Markdown.Parsed<StandardSchemaV1.InferOutput<Schema>>, MarkdownParseError> {
		let result = Markdown.frontmatter(raw, this.#options.frontmatter);
		if (!result.success) return result;

		let config = {
			...this.#options.markdoc,
			nodes: { fence, ...this.#options.markdoc?.nodes },
		} satisfies Config;

		let ast = Markdoc.parse(result.data.content);
		let content = Markdoc.transform(ast, config);

		return { success: true, data: { content, frontmatter: result.data.frontmatter } };
	}
}
```

This code depends on `@markdoc/markdoc`, `yaml`, and `prismjs` for syntax highlighting. None of these need to ship to the browser. The [Result type pattern](/articles/result-objects-in-ts) provides a clean way to handle parsing errors without throwing exceptions.

## Client Entry Point

The client entry point exports only what is needed to render parsed content:

```tsx {% path="packages/markdown/src/client/index.tsx" %}
import type { RenderableTreeNodes } from "@markdoc/markdoc";

import { renderers } from "@markdoc/markdoc";
import * as React from "react";

import { Fence } from "./fence.js";

export namespace MarkdownView {
	export type Content = RenderableTreeNodes;

	export interface Props {
		content: Content;
		className?: string;
		components?: Record<string, React.ComponentType>;
	}
}

export function MarkdownView({ content, className, components }: MarkdownView.Props) {
	return (
		<div className={className}>
			{renderers.react(content, React, { components: { ...components, Fence } })}
		</div>
	);
}
```

The client only imports the Markdoc renderer, not the parser. It receives pre-parsed content (a `RenderableTreeNodes` object) and renders it to React elements.

## The Data Contract

The server and client entry points communicate through a shared data type: `RenderableTreeNodes` from Markdoc. The server produces this type, and the client consumes it.

In a React Router app, this looks like:

```tsx {% path="app/routes/articles.$slug.tsx" %}
import type { Route } from "./+types/articles.$slug";
import { Markdown } from "my-markdown/server";
import { MarkdownView } from "my-markdown/client";
import { z } from "zod";

let markdown = new Markdown({
	frontmatter: z.object({
		title: z.string(),
		excerpt: z.string(),
	}),
});

export async function loader({ params }: Route.LoaderArgs) {
	let raw = await readArticle(params.slug);
	let result = markdown.parse(raw);

	if (!result.success) {
		throw new Response("Invalid article", { status: 500 });
	}

	return result.data;
}

export default function Article({ loaderData }: Route.ComponentProps) {
	return (
		<article>
			<h1>{loaderData.frontmatter.title}</h1>
			<MarkdownView content={loaderData.content} />
		</article>
	);
}
```

The loader runs on the server and imports from `my-markdown/server`. The component runs on both server (SSR) and client, importing from `my-markdown/client`. The bundler can now properly split these dependencies.

## Static Assets as Entry Points

The `exports` field is not limited to JavaScript. You can expose CSS, JSON, or any other file:

```json {% path="packages/markdown/package.json" %}
{
	"exports": {
		"./styles/light.css": "./styles/prism-light.css",
		"./styles/dark.css": "./styles/prism-dark.css"
	}
}
```

Consumers import these directly:

```css {% path="app/styles/global.css" %}
@import "my-markdown/styles/light.css";

@media (prefers-color-scheme: dark) {
	@import "my-markdown/styles/dark.css";
}
```

Or in JavaScript for bundlers that handle CSS imports:

```ts
import "my-markdown/styles/light.css";
```

## Single Entry with Styles

Not every package needs server/client separation. A UI component library might have a single JavaScript entry point alongside a CSS entry point:

```json {% path="packages/ui/package.json" %}
{
	"name": "my-ui",
	"type": "module",
	"exports": {
		".": "./src/index.ts",
		"./styles.css": "./src/styles.css"
	}
}
```

The `.` entry is the main entry point, equivalent to importing the package name directly:

```ts
import { Button, Input, Dialog } from "my-ui";
import "my-ui/styles.css";
```

This pattern keeps styles separate from components, allowing consumers to:

1. Import styles once at the app root
2. Use CSS bundling tools that handle `@import`
3. Skip styles entirely if using a different styling approach

## Tree-Shaking Benefits

Multi-entry architecture improves tree-shaking in several ways:

**Smaller dependency graphs**: Each entry point has its own dependency tree. The client entry does not pull in server dependencies, even if they share some common code.

**Clearer boundaries**: Bundlers can analyze each entry point independently. Side effects in server code do not affect client bundle analysis.

**Explicit imports**: Consumers declare exactly what they need. There is no ambiguity about which parts of the package are used.

**Faster builds**: Bundlers can parallelize analysis of separate entry points and skip entire subtrees that are not imported.

## When to Split Entry Points

Consider multiple entry points when:

1. **Code runs in different environments**: Server-only code (database access, file system, environment variables) should not ship to browsers.

2. **Dependencies differ significantly**: If one part of your package uses heavy dependencies that another part does not need, split them.

3. **Consumers have different needs**: A library used by both React and Vue apps might expose framework-specific entry points.

4. **Static assets accompany code**: CSS, images, or JSON files that consumers import separately deserve their own entry points.

For small packages with minimal dependencies that run in any environment, a single entry point is fine. The overhead of multiple entry points is not worth it if everything ends up in the same bundle anyway.

## Conclusion

The `exports` field in `package.json` enables packages to expose multiple entry points, each serving a specific purpose. By separating server and client code, static assets, and framework-specific implementations, packages give consumers control over what they import and how it affects their bundles.

This architecture requires more upfront design but pays off in smaller bundles, clearer boundaries, and better tree-shaking. For packages that span server and client environments, it is often the right choice. When organizing multiple packages together, see [building a monorepo with shared packages](/articles/building-a-monorepo-with-shared-packages) for workspace configuration and layered architecture patterns.
