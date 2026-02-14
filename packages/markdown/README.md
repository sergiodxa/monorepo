# @pkg/markdown

Markdown processing with Markdoc and Prism.js syntax highlighting.

## Overview

This package provides server-side markdown parsing using [Markdoc](https://markdoc.dev) with automatic syntax highlighting via [Prism.js](https://prismjs.com), and a React component for rendering the parsed content. It uses [Standard Schema](https://standardschema.dev) for type-safe frontmatter validation, working with Zod, Valibot, ArkType, or any compliant library.

The package is split into server and client entry points to keep client bundles small - only the rendering component is included on the client side.

## Usage

### Server: Parse Markdown

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";
import { z } from "zod";

let schema = z.object({
	title: z.string(),
	description: z.string().optional(),
	publishedAt: z.coerce.date(),
});

let md = new Markdown({ frontmatter: schema });

let result = md.parse(`---
title: Hello World
description: A simple example
publishedAt: 2024-01-15
---

# Hello

This is **markdown** content with \`inline code\`.

\`\`\`typescript
let greeting = "Hello, World!";
console.log(greeting);
\`\`\`
`);

if (isFailure(result)) {
	console.error(result.error.message, result.error.issues);
} else {
	// result.data.frontmatter is typed as { title: string; description?: string; publishedAt: Date }
	// result.data.content is MarkdownView.Content for use with MarkdownView
}
```

### Client: Render Markdown

```tsx
import { MarkdownView } from "@pkg/markdown/client";
import prismStyles from "@pkg/markdown/styles/light.css?url";
import type { Route } from "./+types/article";

export function links(): Route.LinksFunction {
	return [{ rel: "stylesheet", href: prismStyles }];
}

export default function Article({ loaderData }: Route.ComponentProps) {
	return <MarkdownView content={loaderData.content} className="my-8" />;
}
```

### Dark Theme

```tsx
import prismStyles from "@pkg/markdown/styles/dark.css?url";

export function links(): Route.LinksFunction {
	return [{ rel: "stylesheet", href: prismStyles }];
}
```

## API

### Server

#### `Markdown` Class

Creates a markdown parser instance with configured frontmatter schema.

```typescript
import { Markdown } from "@pkg/markdown/server";

let md = new Markdown({
	frontmatter: schema, // Required: Standard Schema for frontmatter
	markdoc: {
		// Optional: Markdoc configuration
		nodes: {}, // Custom Markdoc node overrides
		tags: {}, // Custom Markdoc tags
	},
});
```

#### `Markdown.parse(raw: string)`

Parses raw markdown content and returns a Result with typed frontmatter and renderable content.

**Parameters:**

- `raw`: The raw markdown string to parse

**Returns:**

- `Result<Markdown.Parsed<FM>, MarkdownParseError>` containing on success:
  - `content`: `MarkdownView.Content` - Markdoc AST for rendering
  - `frontmatter`: Validated and typed frontmatter object

**Example:**

```typescript
import { isFailure } from "@pkg/result";

let result = md.parse(rawMarkdown);
if (isFailure(result)) {
	console.error(result.error.issues);
	return;
}
let { content, frontmatter } = result.data;
```

#### `Markdown.frontmatter(raw: string, schema: Schema)`

Static method to extract and validate frontmatter without full parsing. Useful when you only need metadata.

**Parameters:**

- `raw`: The raw markdown string
- `schema`: Standard Schema for validation

**Returns:**

- `Result<{ frontmatter: FM; content: string }, MarkdownParseError>` - Validated frontmatter and remaining content

**Example:**

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";
import { z } from "zod";

let schema = z.object({ title: z.string() });
let result = Markdown.frontmatter(rawMarkdown, schema);
if (isFailure(result)) return;
// result.data.frontmatter.title is typed as string
// result.data.content is the markdown without frontmatter block
```

#### `MarkdownParseError`

Error class returned in failure results when frontmatter validation fails.

**Properties:**

- `message`: Error description
- `issues`: `ReadonlyArray<StandardSchemaV1.Issue>` - Validation issues with paths

**Example:**

```typescript
import { Markdown, MarkdownParseError } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";

let result = md.parse(rawMarkdown);
if (isFailure(result)) {
	console.error(result.error.message);
	for (let issue of result.error.issues) {
		console.error(`${issue.path?.join(".")}: ${issue.message}`);
	}
}
```

### Client

#### `MarkdownView` Component

React component that renders parsed Markdoc content with syntax-highlighted code blocks.

**Props:**

- `content`: `MarkdownView.Content` - The parsed content from `Markdown.parse()`
- `className?`: `cn.ClassName` - Additional CSS classes for the container (supports strings, arrays, objects)
- `components?`: `Record<string, React.ComponentType>` - Custom components for Markdoc tags

**Example:**

```tsx
import { MarkdownView } from "@pkg/markdown/client";

function Callout({ type, children }) {
	return <div className={`callout callout-${type}`}>{children}</div>;
}

function DocPage({ content }: { content: MarkdownView.Content }) {
	return (
		<article>
			<MarkdownView content={content} components={{ Callout }} />
		</article>
	);
}
```

The component wraps content in a `div` with Tailwind Typography classes (`prose prose-neutral dark:prose-invert max-w-none`) and uses `cn()` from `@pkg/cn` to merge classes. Code blocks include copy-to-clipboard functionality.

Note: The `Fence` component for code blocks cannot be overridden.

#### `MarkdownView.Content` Type

Type alias for the parsed markdown content. Use this instead of importing `RenderableTreeNodes` from `@markdoc/markdoc`.

```typescript
import { MarkdownView } from "@pkg/markdown/client";

interface ArticleProps {
	content: MarkdownView.Content;
}
```

## Syntax Highlighting

Code blocks are automatically syntax-highlighted using Prism.js. Supported languages:

- `typescript` / `ts` / `tsx`
- `javascript` / `js` / `jsx`
- `bash` / `sh` / `shell`
- `json`
- `yaml` / `yml`
- `css`
- `html` / `erb`
- `markdown` / `md` / `mdx`
- `sql`
- `python` / `py`
- `ruby` / `rb`
- `graphql` / `gql`
- `http` / `rest`
- `diff`
- `plain` / `text` / `env` / `dotenv`

Language aliases are normalized automatically (e.g., `ts` becomes `typescript`).

## Integration with React Router

### Loader Pattern

```tsx
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";
import { z } from "zod";
import type { Route } from "./+types/docs.$slug";

let md = new Markdown({
	frontmatter: z.object({ title: z.string(), description: z.string() }),
});

export async function loader({ params }: Route.LoaderArgs) {
	let file = await readFile(`./docs/${params.slug}.md`, "utf-8");
	let result = md.parse(file);
	if (isFailure(result)) throw new Response("Invalid document", { status: 500 });

	return result.data;
}

export default function DocsPage({ loaderData }: Route.ComponentProps) {
	return (
		<article>
			<h1>{loaderData.frontmatter.title}</h1>
			<p>{loaderData.frontmatter.description}</p>
			<MarkdownView content={loaderData.content} />
		</article>
	);
}
```

### Meta Function

```typescript
export function meta({ data }: Route.MetaArgs) {
	return [
		{ title: data.frontmatter.title },
		{ name: "description", content: data.frontmatter.description },
	];
}
```

## Pattern: Custom Markdoc Tags

Extend markdown with custom components:

```typescript
import { Markdown } from "@pkg/markdown/server";
import { Tag } from "@markdoc/markdoc";

let md = new Markdown({
	frontmatter: schema,
	markdoc: {
		tags: {
			callout: {
				attributes: {
					type: { type: String, default: "info" },
				},
				transform(node, config) {
					return new Tag("Callout", { type: node.attributes.type }, node.transformChildren(config));
				},
			},
		},
	},
});
```

Then pass the component to `MarkdownView`:

```tsx
import { MarkdownView } from "@pkg/markdown/client";

function Callout({ type, children }: { type: string; children: React.ReactNode }) {
	return <div className={`callout callout-${type}`}>{children}</div>;
}

export default function DocsPage({ loaderData }: Route.ComponentProps) {
	return <MarkdownView content={loaderData.content} components={{ Callout }} />;
}
```

## Pattern: Reusable Schema

Define schemas in a central location:

```typescript
// lib/markdown.ts
import { Markdown } from "@pkg/markdown/server";
import { z } from "zod";

export let docsSchema = z.object({
	title: z.string(),
	description: z.string(),
	sidebar: z.string().optional(),
});

export let blogSchema = z.object({
	title: z.string(),
	description: z.string(),
	publishedAt: z.coerce.date(),
	author: z.string(),
	tags: z.string().transform((s) => s.split(",").map((t) => t.trim())),
});

export let docsMd = new Markdown({ frontmatter: docsSchema });
export let blogMd = new Markdown({ frontmatter: blogSchema });
```

## Related Packages

- [`@pkg/result`](/packages/result) - Result type for explicit error handling
- [`@pkg/validate`](/packages/validate) - Form validation with Standard Schema

## Tips

1. **Split imports** - Import from `/server` in loaders and `/client` in components to optimize bundles
2. **Validate early** - Use `Markdown.frontmatter()` to validate metadata without full parsing when listing content
3. **Reuse instances** - Create `Markdown` instances once and reuse them across requests
4. **Custom errors** - Catch `MarkdownParseError` to provide user-friendly validation messages
5. **Theme matching** - Import the CSS theme that matches your app's color scheme
