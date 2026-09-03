# @pkg/markdown

Markdown parsing, frontmatter validation, and rendering, from source text to Remix UI nodes.

## Overview

`@pkg/markdown` parses markdown with [Markdoc](https://markdoc.dev), validates frontmatter with [Standard Schema](https://standardschema.dev), and highlights fenced code with [`@pkg/highlight`](/packages/highlight), whose Markdoc node it registers. Parsing returns a Markdoc render tree rather than markup, so the same parsed document can be rendered by different UI runtimes, cached, or handed to a client renderer untouched.

The package has three entry points, split by what they need to run:

- `@pkg/markdown` — markdown transformations that are neither parsing nor rendering, currently plain-text extraction. It carries no runtime beyond the parser, so an excerpt or a search index can use it without pulling in a highlighter or a renderer.
- `@pkg/markdown/server` — the server-only pipeline: the `Markdown` parser class, frontmatter extraction and validation, and the highlighter's fence node. Frontmatter is read by [`@pkg/yaml`](/packages/yaml), over [the subset it documents](#frontmatter-format).
- `@pkg/markdown/client` — the renderer, which turns a Markdoc tree into `remix/ui` nodes instead of React DOM elements, including the code-fence UI.

Keeping the split at the entry-point level means the grammars stay out of client bundles and the renderer stays out of loaders and services. The token colors the rendered fences expect live with the tokens, in `@pkg/highlight/styles.css`.

## Usage

### Parse markdown on the server

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let schema = s.object({
	title: s.string(),
	description: s.optional(s.string()),
	publishedAt: coerce.date(),
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

if (isFailure(result)) throw result.error;

let content = result.data.content;
let frontmatter = result.data.frontmatter;
```

### Render the parsed tree on the client

```tsx
import { MarkdownView } from "@pkg/markdown/client";
import type { Markdown } from "@pkg/markdown/server";
import type { Handle } from "remix/ui";

type Props = { content: Markdown.Parsed<unknown>["content"] };

export function PostPage({ props }: Handle<Props>) {
	return () => <MarkdownView content={props.content} />;
}
```

### Extract plain text

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

### Load a code theme

```tsx
import highlightStyles from "@pkg/highlight/styles.css?url";

export let links = () => [{ rel: "stylesheet", href: highlightStyles }];
```

Declare the `--highlight-*` properties afterwards to spend your own palette on
the token types; [`@pkg/highlight`](/packages/highlight) lists them.

## API

### Root: `@pkg/markdown`

#### `toPlainText(markdown: string, options?: PlainTextOptions): string`

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

#### `PlainTextOptions`

```typescript
interface PlainTextOptions {
	fences?: boolean;
	images?: boolean;
}
```

`toPlainText` and `PlainTextOptions` are re-exported from `@pkg/markdown/server`
as well, so server code that already imports the parser does not need a second
import path.

### Server: `@pkg/markdown/server`

#### `Markdown<Schema>`

Parses markdown source into a Markdoc render tree plus validated frontmatter.

##### `new Markdown(options: Markdown.Options<Schema>)`

Creates a parser instance.

**Parameters:**

- `options.frontmatter`: Standard Schema validator applied to the frontmatter
- `options.markdoc?`: Optional Markdoc config (`nodes`, `tags`, `variables`, …); the `fence` node below is merged in unless overridden

**Example:**

```typescript
import { Markdown } from "@pkg/markdown/server";
import * as s from "remix/data-schema";

let markdown = new Markdown({ frontmatter: s.object({ title: s.string() }) });
```

##### `markdown.parse(raw: string): Result<Markdown.Parsed<FM>, MarkdownParseError>`

Validates frontmatter, then parses and transforms the remaining body into
Markdoc renderable content.

**Parameters:**

- `raw`: Markdown source

**Returns:**

- `success`: `{ content, frontmatter }`
- `failure`: `MarkdownParseError`

**Example:**

```typescript
import { isFailure } from "@pkg/result";

let result = markdown.parse(raw);
if (isFailure(result)) return;

let content = result.data.content;
```

##### `Markdown.frontmatter(raw: string, schema: Schema): Result<{ frontmatter: FM; content: string }, MarkdownParseError>`

Static method. Extracts and validates frontmatter without running the Markdoc
transform, and returns the markdown body that followed it.

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
if (isFailure(result)) return;

let frontmatter = result.data.frontmatter;
```

#### `MarkdownParseError`

Error returned in the failure branch when frontmatter fails to parse or
validate, or when the schema validates asynchronously.

**Properties:**

- `name`: `"MarkdownParseError"`
- `issues`: `ReadonlyArray<StandardSchemaV1.Issue>` — the validator's issues, empty for non-validation failures

#### Frontmatter format

Frontmatter is the block between a leading `---` line and the next one, read by
[`@pkg/yaml`](/packages/yaml) over the subset that package documents. Scalars resolve
by the YAML 1.2 core schema, so `2026-08-02` arrives as a string, `yes` stays `"yes"`,
and only `true`/`false` become booleans. Anchors, aliases, merge keys, tags, explicit
keys and multi-document sources are not part of the subset.

A block that fails to parse is treated as empty, which leaves the frontmatter schema to
report what the document is missing. A document whose schema is `s.object({})` therefore
still renders when its body opens on two thematic breaks.

#### Fenced code

Fences are highlighted by [`@pkg/highlight`](/packages/highlight)'s Markdoc node,
which `Markdown` registers by default. It reads the fence's `language`, `path` and
`title`, resolves the language through the highlighter's aliases, tokenizes the
body, and emits a `Fence` tag the client renderer draws.

**Example:**

````markdown
```tsx path="app/root.tsx" title="Root route"
export default function Root() {}
```
````

#### Types

##### `Markdown.Parsed<FM>`

```typescript
interface Parsed<FM> {
	content: RenderableTreeNodes;
	frontmatter: FM;
}
```

##### `Markdown.Options<Schema>`

```typescript
interface Options<Schema extends StandardSchemaV1> {
	frontmatter: Schema;
	markdoc?: Config;
}
```

### Client: `@pkg/markdown/client`

#### `MarkdownView`

Renders a parsed Markdoc tree into the `remix/ui` runtime.

**Props:**

- `content`: `unknown` — the render tree returned by `markdown.parse()`
- `components?`: `MarkdownViewComponents` — custom renderers keyed by tag name

**Example:**

```tsx
import { MarkdownView } from "@pkg/markdown/client";
import type { Handle } from "remix/ui";

export function DocPage({ props }: Handle<{ content: unknown }>) {
	return () => <MarkdownView content={props.content} />;
}
```

#### `renderToRemix(content: unknown, components?: MarkdownViewComponents): RemixNode`

The renderer behind `MarkdownView`, without the component wrapper. Use it when
the output is composed into surrounding markup rather than rendered on its own.

**Parameters:**

- `content`: Markdoc render tree
- `components`: Optional custom tag renderers keyed by tag name

**Returns:**

- Remix UI nodes for the whole document

**Example:**

```tsx
import { renderToRemix } from "@pkg/markdown/client";

return () => <article>{renderToRemix(content)}</article>;
```

#### `Fence`

The code-fence component the default renderer uses for `Fence` tags. It draws a
scrollable `<pre>`, emitting one span per token with the classes the stylesheet
targets, plus an
optional header showing the fence's `title` and `path`.

**Props:**

- `tokens`: `Token[]` — the runs the fence node highlighted, rendered one span each
- `language`: `string` — resolved language name, used for the `language-*` class
- `path?`: `string` — file path shown in the header
- `title?`: `string` — label shown in the header

Override it through `components={{ Fence: MyFence }}` when an app needs different
code-block chrome.

#### `MarkdownViewComponents`

```typescript
type MarkdownViewComponents = Record<
	string,
	(handle: Handle<{ children: RemixNode; [key: string]: unknown }>) => () => RemixNode
>;
```

## Patterns

### Pattern: Custom Markdoc tag with a matching component

Declare the tag on the server so the transform emits it:

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

Then supply the component that renders it:

```tsx
import { MarkdownView } from "@pkg/markdown/client";
import type { Handle, RemixNode } from "remix/ui";

function Callout({ props }: Handle<{ type: string; children: RemixNode }>) {
	return () => <div className={`callout-${props.type}`}>{props.children}</div>;
}

export function PostPage({ props }: Handle<{ content: unknown }>) {
	return () => <MarkdownView content={props.content} components={{ Callout }} />;
}
```

### Pattern: Parse in a loader, render in the view

Parsing is the server's job and the render tree is plain data, so it crosses the
loader boundary without the client re-parsing anything.

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";

let parser = new Markdown({ frontmatter: schema });

export async function loader({ params }: Route.LoaderArgs) {
	let raw = await readPost(params.slug);
	let result = parser.parse(raw);
	if (isFailure(result)) throw result.error;
	return { post: result.data };
}
```

```tsx
import { MarkdownView } from "@pkg/markdown/client";

export default function Component({ loaderData }: Route.ComponentProps) {
	return () => <MarkdownView content={loaderData.post.content} />;
}
```

### Pattern: Frontmatter-only reads for list pages

An index page needs titles and dates, not rendered bodies. Skipping the transform
avoids highlighting every post to build a list.

```typescript
import { Markdown } from "@pkg/markdown/server";
import { isFailure } from "@pkg/result";

let result = Markdown.frontmatter(rawMarkdown, schema);
if (isFailure(result)) return null;

let metadata = result.data.frontmatter;
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

## Related Packages

- [`@pkg/result`](/packages/result) - Explicit success/failure handling, used by every parse entry point
- [`@pkg/yaml`](/packages/yaml) - Reads the frontmatter block, over a documented subset of YAML
- [`@pkg/validate`](/packages/validate) - Validation helpers over Standard Schema
- [`@pkg/strings`](/packages/strings) - Excerpts, word counts, and slugs over the text `toPlainText()` returns

## Tips

1. **Import `/server` only from server code** - The server entry point pulls in the grammars; keeping it out of components keeps that weight out of client bundles.
2. **Reuse parser instances** - Create `Markdown` instances at module scope and reuse them across requests instead of building one per parse.
3. **Always load the highlighter's stylesheet** - Without `@pkg/highlight/styles.css`, highlighted fences render as undifferentiated text.
4. **Write frontmatter inside `@pkg/yaml`'s subset** - Anchors, aliases and tags are failures there, and a failed block reaches the schema as empty.
5. **Keep frontmatter schemas synchronous** - An async validator returns a `MarkdownParseError` rather than awaiting; the parse path is deliberately sync.
6. **Prefer `Markdown.frontmatter` for index pages** - It skips the Markdoc transform and the highlighting that comes with it.
7. **Write fences with known aliases** - `tsx`, `sh`, `jsonc`, and friends resolve to a grammar; an unrecognized language renders as plain text.
8. **Use `toPlainText` for excerpts and search indexes** - It reads the parsed tree, so it cannot be fooled by markup a regular expression would miss.
9. **Turn on `fences` only for a search index** - Code reads as noise in an excerpt but is worth indexing.
10. **Reach for `renderToRemix` over `MarkdownView` when composing** - Use it when the rendered nodes go inside surrounding markup you control; use the component when the document stands alone.
