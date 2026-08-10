# @pkg/markdown

Type-safe Markdown parsing on the server with a Remix renderer on the client.

## Overview

`@pkg/markdown` parses markdown with [Markdoc](https://markdoc.dev), validates frontmatter with [Standard Schema](https://standardschema.dev), and highlights code blocks with [Prism.js](https://prismjs.com). The server entry point returns a Markdoc render tree (`RenderableTreeNodes`) so rendering can happen in different UI runtimes.

The package is split by responsibility:

- `@pkg/markdown` transforms markdown without rendering it, currently plain-text extraction
- `@pkg/markdown/server` parses markdown and frontmatter only
- `@pkg/markdown/client/remix` renders content in Remix apps

This split keeps parsing and syntax highlighting logic centralized and out of the code that renders it.

## Usage

### Server: parse markdown

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";
import { z } from "zod";

let schema = z.object({
	title: z.string(),
	description: z.string().optional(),
	publishedAt: z.coerce.date(),
});

let markdown = new Markdown({ frontmatter: schema });

let result = markdown.parse(`---
title: Hello World
description: A simple example
publishedAt: 2024-01-15
---

# Hello

This is **markdown** content.

\`\`\`tsx
let greeting = <h1>Hello</h1>;
\`\`\`
`);

if (isFailure(result)) {
	throw result.error;
}

let content = result.data.content;
let frontmatter = result.data.frontmatter;
```

### Plain text from markdown

```typescript
import { toPlainText } from "@pkg/markdown";

let text = toPlainText(`---
title: Hello World
---

# Hello

A [linked](https://example.com) paragraph with \`code\`.
`);
// "Hello\n\nA linked paragraph with code."
```

### Client: render markdown

```tsx
import { MarkdownView } from "@pkg/markdown/client/remix";
import type { Markdown } from "@pkg/markdown/server";

export function PostPage() {
	return ({ content }: { content: Markdown.AST }) => {
		return <MarkdownView content={content} />;
	};
}
```

### Dark code theme

```tsx
import prismDark from "@pkg/markdown/styles/dark.css?url";

export let links = () => [{ rel: "stylesheet", href: prismDark }];
```

## API

### `toPlainText(markdown: string, options?: PlainTextOptions): string`

Import from `@pkg/markdown`.

Extracts the prose from a markdown document by walking the parsed AST, so the
result is derived from what the parser identified rather than from a pass of
regular expressions over the source. Frontmatter, reference definitions, link
targets and titles, raw HTML tags, and comments are left out; headings,
paragraphs, list items, table rows, and block quotes each become one block,
separated by a blank line. Inline code is kept, since it is part of the sentence
around it.

**Parameters:**

- `markdown`: Markdown source, with or without frontmatter
- `options.fences`: Include the body of code blocks; defaults to `false`
- `options.images`: Include image alternative text; defaults to `false`

**Returns:**

- The document's prose, blocks separated by a blank line

**Example:**

```typescript
import { toPlainText } from "@pkg/markdown";

let text = toPlainText(body);
let indexed = toPlainText(body, { fences: true });
```

### `Markdown<Schema>`

Server parser class.

#### `new Markdown(options: Markdown.Options<Schema>)`

Creates a parser instance.

**Parameters:**

- `options.frontmatter`: Standard Schema validator for frontmatter
- `options.markdoc?`: Optional Markdoc config (`nodes`, `tags`, etc.)

#### `markdown.parse(raw: string): Result<Markdown.Parsed<FM>, MarkdownParseError>`

Parses frontmatter + markdown body and transforms it to Markdoc renderable content.

**Parameters:**

- `raw`: Markdown source

**Returns:**

- `success`: `{ content, frontmatter }`
- `failure`: `MarkdownParseError`

**Example:**

```typescript
import { isFailure } from "@pkg/result";

let result = markdown.parse(raw);
if (isFailure(result)) {
	return;
}

let content = result.data.content;
```

#### `Markdown.frontmatter(raw: string, schema: Schema): Result<{ frontmatter: FM; content: string }, MarkdownParseError>`

Extracts and validates frontmatter without full Markdoc transform.

**Parameters:**

- `raw`: Markdown source
- `schema`: Standard Schema validator

**Returns:**

- `success`: `{ frontmatter, content }`
- `failure`: `MarkdownParseError`

**Example:**

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";

let result = Markdown.frontmatter(raw, schema);
if (isFailure(result)) {
	return;
}

let frontmatter = result.data.frontmatter;
```

### `MarkdownParseError`

Error returned on validation failures.

**Properties:**

- `name`: `"MarkdownParseError"`
- `issues`: Standard Schema issues list

### `MarkdownView`

Import from `@pkg/markdown/client/remix`.

Renders parsed markdown content in Remix Component runtime.

**Props:**

- `content`: `Markdown.AST`
- `components?`: `Record<string, MarkdownView.Component>`

**Example:**

```tsx
import { MarkdownView } from "@pkg/markdown/client/remix";
import type { Markdown } from "@pkg/markdown/server";

export function DocPage() {
	return ({ content }: { content: Markdown.AST }) => {
		return <MarkdownView content={content} />;
	};
}
```

### `Markdown.AST`

Type alias for parsed renderable content in the client entry point.

```typescript
import type { Markdown } from "@pkg/markdown/server";

interface ArticleData {
	content: Markdown.AST;
}
```

## Patterns

### Pattern: Custom Markdoc tag + custom component

```typescript
import { Tag } from "@markdoc/markdoc";
import { Markdown } from "@pkg/markdown/server";

let parser = new Markdown({
	frontmatter: schema,
	markdoc: {
		tags: {
			callout: {
				attributes: { type: { type: String, default: "info" } },
				transform(node, config) {
					return new Tag("Callout", { type: node.attributes.type }, node.transformChildren(config));
				},
			},
		},
	},
});
```

Then render with client components:

```tsx
import { MarkdownView } from "@pkg/markdown/client/remix";
import type { Markdown } from "@pkg/markdown/server";
import type { Handle, RemixNode } from "remix/ui";

function Callout({ props }: Handle<{ type: string; children: RemixNode }>) {
	return () => <div className={`callout-${props.type}`}>{props.children}</div>;
}

export function PostPage() {
	return ({ content }: { content: Markdown.AST }) => {
		return <MarkdownView content={content} components={{ Callout }} />;
	};
}
```

### Pattern: Excerpt and reading time from a post body

Plain-text extraction is the step before any text measurement; keep the text
operations themselves in a string utility so this package stays about markdown.

```typescript
import { toPlainText } from "@pkg/markdown";
import { excerpt, wordCount } from "@pkg/strings";

let text = toPlainText(body);
let summary = excerpt(text, { length: 200 });
let minutes = Math.ceil(wordCount(text) / 200);
```

### Pattern: Frontmatter-only reads for list pages

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";

let result = Markdown.frontmatter(rawMarkdown, schema);
if (isFailure(result)) {
	return null;
}

let metadata = result.data.frontmatter;
```

## Related Packages

- [`@pkg/result`](/packages/result) - Explicit success/failure handling
- [`@pkg/validate`](/packages/validate) - Validation helpers with Standard Schema
- [`@pkg/strings`](/packages/strings) - Excerpts, word counts, and slugs over the text `toPlainText()` returns

## Tips

1. **Import only server code in loaders/actions** - Keep rendering code out of server-only modules to avoid unnecessary bundle weight.
2. **Always load a Prism stylesheet** - Import `@pkg/markdown/styles/light.css` or `@pkg/markdown/styles/dark.css` in routes that render markdown.
3. **Reuse parser instances** - Create `Markdown` instances at module scope and reuse them across requests.
4. **Prefer `Markdown.frontmatter` for index pages** - It is faster when you only need metadata and not full rendered content.
5. **Use `toPlainText` for excerpts and search indexes** - It reads the parsed tree, so it cannot be fooled by markup a regular expression would miss.
6. **Turn on `fences` only for a search index** - Code reads as noise in an excerpt but is worth indexing.
