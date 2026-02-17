---
title: How to Build a Type-Safe Markdown Pipeline with Markdoc
excerpt: Create a server and client architecture for parsing and rendering Markdown with full type safety.
tech: @markdoc/markdoc@0.4.0 react@19.0.0
---

Markdoc splits content processing into two distinct phases: parsing and rendering. The parsing phase transforms raw Markdown into an abstract syntax tree (AST), while the rendering phase converts that tree into React components. This separation creates a natural boundary between server and client code. If you're new to Markdoc, start with [parsing Markdown with Markdoc in Remix](/tutorials/parse-markdown-with-markdoc-in-remix) for the fundamentals.

The challenge is that parsing must happen on the server where you have access to the filesystem, but rendering happens on the client where you need React. You need to serialize the parsed content and pass it across this boundary while maintaining type safety throughout the pipeline.

## Parse Markdown on the Server

```ts {% path="lib/markdown/server.ts" %}
import Markdoc, { type RenderableTreeNode } from "@markdoc/markdoc";
import { z } from "zod";

const frontmatterSchema = z.object({
	title: z.string(),
	excerpt: z.string().max(130),
	publishedAt: z.coerce.date(),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export interface ParsedMarkdown {
	frontmatter: Frontmatter;
	content: RenderableTreeNode;
}

export function parseMarkdown(source: string): ParsedMarkdown {
	let ast = Markdoc.parse(source);

	let frontmatter = frontmatterSchema.parse(ast.attributes.frontmatter);

	let content = Markdoc.transform(ast, {
		variables: { frontmatter },
	});

	return { frontmatter, content };
}
```

The `parseMarkdown` function takes raw Markdown as input and returns a structured object with validated frontmatter and a `RenderableTreeNode`. The `RenderableTreeNode` type is Markdoc's serializable representation of the content tree, which can be safely passed from server to client through JSON serialization.

Validating frontmatter with Zod ensures that your content always has the required fields with the correct types. If a Markdown file is missing a title or has an invalid date, you'll get a clear error at parse time rather than a runtime crash in your component.

## Render Content on the Client

```tsx {% path="lib/markdown/client.tsx" %}
import Markdoc, { type RenderableTreeNode } from "@markdoc/markdoc";
import * as React from "react";

import { Callout } from "./components/callout";
import { CodeBlock } from "./components/code-block";
import { Heading } from "./components/heading";

const components = {
	Callout,
	CodeBlock,
	Heading,
};

export function renderMarkdown(content: RenderableTreeNode): React.ReactNode {
	return Markdoc.renderers.react(content, React, { components });
}
```

The `renderMarkdown` function takes the `RenderableTreeNode` from the server and converts it to React elements. The `components` object maps Markdoc tag names to your custom React components, allowing you to control exactly how each element renders.

This separation keeps your server module free of React dependencies and your client module free of parsing logic. Each module has a single responsibility and a clear interface. This [multi-entry package architecture](/articles/multi-entry-package-architecture) pattern works well for any code that needs to run in different environments.

## Create Custom Components for Markdoc Tags

```tsx {% path="lib/markdown/components/callout.tsx" %}
interface CalloutProps {
	type: "note" | "warning" | "error";
	children: React.ReactNode;
}

export function Callout({ type, children }: CalloutProps) {
	let styles = {
		note: "bg-blue-50 border-blue-200 text-blue-900",
		warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
		error: "bg-red-50 border-red-200 text-red-900",
	};

	return <aside className={`border-l-4 p-4 my-4 ${styles[type]}`}>{children}</aside>;
}
```

Custom components receive their attributes as props. The `children` prop contains the rendered content inside the tag. You can use any React patterns here: hooks, context, or composition with other components. For code blocks specifically, you can [add syntax highlighting with Prism.js](/tutorials/add-syntax-highlight-to-markdoc-using-prism-js) or [create a copy button](/tutorials/create-a-copy-button-for-code-blocks) for better UX.

```tsx {% path="lib/markdown/components/heading.tsx" %}
interface HeadingProps {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	id?: string;
	children: React.ReactNode;
}

export function Heading({ level, id, children }: HeadingProps) {
	let Tag = `h${level}` as const;

	return (
		<Tag id={id} className="scroll-mt-20">
			{id ? (
				<a href={`#${id}`} className="hover:underline">
					{children}
				</a>
			) : (
				children
			)}
		</Tag>
	);
}
```

The heading component demonstrates how to handle dynamic element types. The `level` prop determines which HTML heading tag to render, while the optional `id` prop enables anchor links for navigation.

## Define Markdoc Tags with Schema Validation

```ts {% path="lib/markdown/tags.ts" %}
import { type Schema } from "@markdoc/markdoc";

export const callout: Schema = {
	render: "Callout",
	attributes: {
		type: {
			type: String,
			default: "note",
			matches: ["note", "warning", "error"],
			errorLevel: "error",
		},
	},
};

export const heading: Schema = {
	render: "Heading",
	children: ["inline"],
	attributes: {
		level: { type: Number, required: true },
		id: { type: String },
	},
};
```

Markdoc schemas define the structure and validation rules for custom tags. The `render` property specifies which component to use, while `attributes` defines the allowed props with their types and constraints. This validation happens during the transform phase on the server.

Update the server module to include these tag definitions:

```ts {% path="lib/markdown/server.ts" %}
import Markdoc, { type RenderableTreeNode } from "@markdoc/markdoc";
import { z } from "zod";

import * as tags from "./tags";

const frontmatterSchema = z.object({
	title: z.string(),
	excerpt: z.string().max(130),
	publishedAt: z.coerce.date(),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export interface ParsedMarkdown {
	frontmatter: Frontmatter;
	content: RenderableTreeNode;
}

export function parseMarkdown(source: string): ParsedMarkdown {
	let ast = Markdoc.parse(source);

	let frontmatter = frontmatterSchema.parse(ast.attributes.frontmatter);

	let content = Markdoc.transform(ast, {
		tags,
		variables: { frontmatter },
	});

	return { frontmatter, content };
}
```

The `tags` object is passed to `Markdoc.transform`, which validates all custom tags in the document against their schemas. Invalid attributes or missing required fields will throw errors during transformation.

## Connect Server and Client in a Route Module

```tsx {% path="app/routes/blog.$slug.tsx" %}
import { readFile } from "node:fs/promises";

import type { Route } from "./+types/blog.$slug";

import { parseMarkdown, type ParsedMarkdown } from "~/lib/markdown/server";
import { renderMarkdown } from "~/lib/markdown/client";

export async function loader({ params }: Route.LoaderArgs) {
	let source = await readFile(`content/posts/${params.slug}.md`, "utf-8");
	let { frontmatter, content } = parseMarkdown(source);
	return { frontmatter, content };
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
	let { frontmatter, content } = loaderData;

	return (
		<article>
			<header>
				<h1>{frontmatter.title}</h1>
				<time dateTime={frontmatter.publishedAt.toISOString()}>
					{frontmatter.publishedAt.toLocaleDateString()}
				</time>
			</header>
			<div className="prose">{renderMarkdown(content)}</div>
		</article>
	);
}
```

The loader reads the Markdown file, parses it with the server module, and returns both the frontmatter and the serializable content tree. React Router automatically serializes the `RenderableTreeNode` to JSON when sending it to the client.

In the component, you access the typed `frontmatter` object directly and pass the `content` to `renderMarkdown`. The type system ensures that the frontmatter has all required fields and the content is the correct type for rendering.

## Export Types for Reuse

```ts {% path="lib/markdown/index.ts" %}
export { parseMarkdown, type Frontmatter, type ParsedMarkdown } from "./server";
export { renderMarkdown } from "./client";
```

A barrel export file provides a clean public API for the markdown module. Route modules can import everything they need from a single path, and the types flow through automatically.

```tsx {% path="app/routes/blog._index.tsx" %}
import type { Frontmatter } from "~/lib/markdown";

interface PostListItemProps {
	slug: string;
	frontmatter: Frontmatter;
}

function PostListItem({ slug, frontmatter }: PostListItemProps) {
	return (
		<article>
			<a href={`/blog/${slug}`}>
				<h2>{frontmatter.title}</h2>
				<p>{frontmatter.excerpt}</p>
			</a>
		</article>
	);
}
```

The exported `Frontmatter` type can be used anywhere you need to work with post metadata. This ensures consistency across your application: the blog index, RSS feed, and sitemap all use the same type definition.

## Final Thoughts

Separating Markdoc into server and client modules creates a clean architecture where each part has a single responsibility. The server handles parsing and validation, the client handles rendering, and the `RenderableTreeNode` type provides a type safe bridge between them.

This pattern scales well as your content grows. You can add new custom tags by defining a schema, creating a component, and registering both in their respective modules. The type system catches mismatches between schemas and components at compile time rather than runtime.
