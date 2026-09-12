# @sdxc/markdown

GitHub Flavored Markdown as a format: read a document into a typed AST, transform it, and write it back out.

## Overview

`@sdxc/markdown` parses and serializes markdown itself, over a first-party AST. The dialect is the one every author already knows — everything in [CommonMark](https://spec.commonmark.org/), plus [GitHub Flavored Markdown](https://github.github.com/gfm/)'s tables, task lists, strikethrough and literal autolinks, plus GitHub's alerts and footnotes. On top of that sit two additions of its own: an annotation that decorates a block with attributes, and an element that creates a node markdown has no syntax for.

Every node is a plain JSON-serializable object with a `type` discriminator, its own fields, and a `position`. That is what lets a parsed document be cached in KV, sent in a payload, diffed in a test, and narrowed by the compiler at every hop. Frontmatter is read by [`@sdxc/yaml`](/packages/yaml) and validated against a [Standard Schema](https://standardschema.dev).

The package has four entry points. The root is the format; each of the others is one thing you do _with_ a parsed document, named for what it produces:

- `@sdxc/markdown` — `Markdown.parse`, `Markdown.frontmatter`, `Markdown.stringify`, `Markdown.walk`, and the AST types. No rendering runtime.
- `@sdxc/markdown/plain` — plain text, for excerpts, word counts and search indexes.
- `@sdxc/markdown/html` — static HTML, for a feed item or any response that carries markup.
- `@sdxc/markdown/remix` — `remix/ui` nodes, which is the only entry that carries the UI runtime.

Importing one is how a bundle pays for what it needs. Highlighting is not among them: it is a `Markdown.walk` visitor, and it ships from [`@sdxc/highlight`](/packages/highlight).

## Usage

### Parse a document and render it

```tsx
import { Markdown } from "@sdxc/markdown";
import { highlight } from "@sdxc/highlight/markdown";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

const Frontmatter = s.object({
	title: s.string(),
	description: s.string(),
	lastUpdated: coerce.date(),
});

let result = Markdown.parse(source, { frontmatter: Frontmatter });
if (isFailure(result)) throw result.error;

let { frontmatter, document } = result.data;

let highlighted = Markdown.walk(document, highlight);
if (isFailure(highlighted)) throw highlighted.error;
```

The view receives a typed document, and owns the markup around it:

```tsx
import type { Markdown } from "@sdxc/markdown";
import type { Handle } from "remix/ui";

import { toRemix } from "@sdxc/markdown/remix";

export default function DocView({ props }: Handle<{ title: string; document: Markdown.Document }>) {
	return () => (
		<article>
			<h1>{props.title}</h1>
			{toRemix(props.document)}
		</article>
	);
}
```

### Read the frontmatter without parsing the body

`Markdown.frontmatter` takes the same options object and stops after the block, so an index over a hundred posts reads a hundred titles without parsing a hundred bodies.

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

const options = { frontmatter: Frontmatter } satisfies Markdown.Options;

let entries = await Promise.all(
	slugs.map(async (slug) => {
		let result = Markdown.frontmatter(await readDoc(slug), options);
		if (isFailure(result)) throw result.error;
		return { slug, ...result.data.frontmatter };
	}),
);
```

### Write a document back

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure, unwrap } from "@sdxc/result";

let { frontmatter, document } = unwrap(Markdown.parse(source, { frontmatter: Frontmatter }));

let written = Markdown.stringify(document, {
	frontmatter: { ...frontmatter, lastUpdated: new Date() },
});
if (isFailure(written)) throw written.error;
```

Omitting `frontmatter` writes the body alone, which is what a route serving content to an agent wants.

### Extract plain text

```typescript
import { toPlainText } from "@sdxc/markdown/plain";

let text = toPlainText(document);
let indexed = toPlainText(document, { code: true });
```

It takes a node rather than a source string, so a caller that has already parsed does not parse twice, and a caller that walked the tree first measures what it actually renders.

### Load a code theme

Highlighted fences render token spans. Link the stylesheet from the document layout's `<head>`, so every page that can render a fence carries the token colors:

```tsx
import highlightStyles from "@sdxc/highlight/styles.css?url";
import type { Handle, RemixNode } from "remix/ui";

export default function DocumentLayout({ props }: Handle<{ children: RemixNode }>) {
	return () => (
		<html lang="en">
			<head>
				<link rel="stylesheet" href={highlightStyles} data-rmx-key="style-highlight" />
			</head>
			<body>{props.children}</body>
		</html>
	);
}
```

Declare the `--highlight-*` properties afterwards to spend your own palette on the token types; [`@sdxc/highlight`](/packages/highlight) lists them.

## API

### `@sdxc/markdown`

#### `Markdown`

A class with a private constructor and only static methods, merged with a namespace of the same name. `new Markdown()` is a compile error, so the name is a namespace the compiler enforces: `Markdown.parse()` is the method and `Markdown.Document` is the type it returns.

##### `Markdown.parse(source, options?)`

Reads the frontmatter block and the body in one traversal.

**Parameters:**

- `source`: Markdown source, with or without a frontmatter block
- `options.frontmatter`: Standard Schema validator for the frontmatter
- `options.tags`: The tags this document may use, keyed by name

**Returns:**

- `success`: `{ frontmatter, document }`
- `failure`: `MarkdownParseError`, carrying the `position` it stopped at

```typescript
let result = Markdown.parse(source, { frontmatter: Frontmatter });
```

##### `Markdown.frontmatter(source, options?)`

Reads the frontmatter block and stops, leaving the body unparsed. What it yields depends on whether the file opens with a block and whether the options carry a schema:

| Block   | Schema | `frontmatter` is                                                       |
| ------- | ------ | ---------------------------------------------------------------------- |
| present | yes    | the schema's output, or a failure carrying its issues and the position |
| present | no     | the YAML value as read, typed `unknown`                                |
| absent  | yes    | the schema run against `{}`, so a required field fails at line 1       |
| absent  | no     | `{}`                                                                   |

A block the YAML parser rejects is a failure, not an empty object: the error carries the YAML error as its `cause` and the line it sits on.

Frontmatter is a set of named fields, so a delimited block holding anything else — a scalar, a sequence, nothing at all — counts as absent, and its lines belong to the body. That is what lets a document open on two thematic breaks.

##### `Markdown.stringify(document, options?)`

Writes a document back as markdown.

**Parameters:**

- `document`: The document to serialize
- `options.frontmatter`: A value to write as a YAML block ahead of the body

**Returns:**

- `success`: the markdown source
- `failure`: `MarkdownStringifyError`, for a frontmatter value YAML cannot write

The serializer normalizes rather than reproducing the source. What holds is idempotency: parsing the output and serializing again yields the same string. Its output is also a fixed point of this repository's formatter, so a file written back stays written.

##### `Markdown.walk(node, visitor)`

Rewrites a tree through a visitor, returning a new node and sharing every subtree no handler touched.

**Parameters:**

- `node`: Any node; the result comes back as the same type
- `visitor`: An object with one optional handler per node type

**Returns:**

- `Result<N, MarkdownWalkError>`, or a promise of one when a handler is asynchronous

See [Pattern: transform a document](#pattern-transform-a-document) below.

#### `namespace Markdown`

The AST. `Markdown.Node` is `Document | Block | Inline`; `document` is the root and belongs to neither column, so a `Block[]` can never hold a nested document.

| Blocks                                                                                                                                               | Inline                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `heading` `paragraph` `code` `list` `listItem` `blockquote` `alert` `table` `tableRow` `tableCell` `thematicBreak` `html` `footnoteDefinition` `tag` | `text` `emphasis` `strong` `strikethrough` `inlineCode` `link` `image` `softBreak` `hardBreak` `inlineHtml` `footnoteReference` `variable` `tag` |

Every `type` names exactly one interface, so `Extract<Markdown.Node, { type: K }>` always narrows to one shape. The one name in both columns is `tag`: a tag is block-level or inline depending on where it is written, and its `children` say which.

Every node carries a `position` — 1-based `line` and `column`, 0-based `offset`, all into the source as written, frontmatter included. Every block carries `attributes`, because an annotation may sit above any block.

Two constructs exist in the source and not in the tree. A link reference definition is consumed at parse time and every reference to it becomes a `link`. Footnotes keep both halves, because a renderer draws them in two places.

#### `MarkdownParseError`, `MarkdownStringifyError`, `MarkdownWalkError`

`MarkdownParseError` and `MarkdownWalkError` carry the `position` they failed at; `MarkdownParseError` also carries the `issues` a frontmatter or attribute schema reported, and `MarkdownWalkError` the thrown value as its `cause`. `MarkdownStringifyError` reports a frontmatter value YAML cannot write, which belongs to no place in the document.

### `@sdxc/markdown/plain`

#### `toPlainText(node: Markdown.Node, options?: PlainTextOptions): string`

Reads the prose out of any node, blocks separated by a blank line.

**Parameters:**

- `node`: Any node, which is what makes this usable inside a visitor
- `options.code`: Include the body of code blocks; defaults to `false`
- `options.images`: Include image alternative text; defaults to `false`

### `@sdxc/markdown/html`

#### `toHTML(node: Markdown.Node, options?: HTMLOptions): string`

Renders any node as static HTML, with no wrapper element of its own.

**Parameters:**

- `node`: Any node, so a caller can render a fragment of a document
- `options.tags`: Markup for a tag, keyed by tag name; a tag with no renderer contributes its children alone

Elements are plain and semantic, and a `md-` class appears only where HTML has no element that says what the node is:

| Class                                                                     | On                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------- |
| `md-alert md-alert-<kind>`                                                | the `<aside>` an alert renders as, with `data-kind` |
| `md-code`                                                                 | a code block's `<pre>`, beside `language-<name>`    |
| `md-table`                                                                | a table                                             |
| `md-align-left/center/right`                                              | a cell in a column the delimiter row aligned        |
| `md-task`, `md-task-box`                                                  | a task list item and its checkbox                   |
| `md-footnotes`, `md-footnote-list`, `md-footnote-ref`, `md-footnote-back` | the trailing footnote section and its links         |
| `md-variable`                                                             | an unresolved `{% $name %}` hole                    |

An annotation's `id` and `class` are written onto the element, and any other attribute becomes a `data-` attribute, so `{% #install .lead %}` styles and links the way it reads.

Raw HTML renders **as escaped text**, so nothing the renderer did not vet becomes markup. A code block a caller highlighted first renders one `<span class="token …">` per run, matching `@sdxc/highlight/styles.css`.

```typescript
import { toHTML } from "@sdxc/markdown/html";

let body = toHTML(document);
```

### `@sdxc/markdown/remix`

#### `toRemix(node: Markdown.Node, options?: RemixOptions): RemixNode`

Renders any node into `remix/ui` output.

**Parameters:**

- `node`: Any node, so a caller can render a fragment of a document
- `options.components`: Components keyed by tag name, or by a node type to take it over

It returns nodes from data and holds no props or reactive state, so calling it inside a render closure is not a component called as a function.

Raw HTML renders **as escaped text**, so a stray `<div>` shows as written rather than becoming an element. An author who wants an element registers a tag for it.

## Pattern: transform a document

`Markdown.walk` is the only transform mechanism. A visitor is a plain object with one optional handler per node type, keyed by the type's name, so the handler's argument is typed with no narrowing to write. A node whose type has no handler is passed through untouched.

What a handler returns decides what happens to that node:

| Returns                       | Effect                                        |
| ----------------------------- | --------------------------------------------- |
| a node                        | replaces the node                             |
| an array of nodes             | splices them in its place                     |
| `null`                        | removes the node                              |
| nothing                       | leaves the node alone, children still visited |
| a promise of any of the above | makes the whole walk asynchronous             |

The walk is top-down, and no handler runs on a replacement node itself — only on its children — so a `code` handler returning a `code` terminates rather than looping. The root is exempt from removal and splicing.

```typescript
let absolute = Markdown.walk(document, {
	link(node) {
		if (!node.href.startsWith("/")) return;
		return { ...node, href: new URL(node.href, origin).href };
	},
	image(node) {
		return { ...node, src: new URL(node.src, origin).href };
	},
});
```

A handler that throws lands on the failure branch with the node's position attached, rather than escaping as an exception. The `cause` is always the original value, so a caller that throws on an unfamiliar `cause` and handles a familiar one keeps both.

Being an object makes a visitor a value: it can be named, exported from another package, and merged by spread, so a consumer runs one pass instead of three.

```typescript
import { highlight } from "@sdxc/highlight/markdown";

let result = Markdown.walk(document, { ...highlight, ...anchors });
```

An exported visitor is declared with `satisfies Markdown.Visitor`, never with a type annotation: an annotation widens every handler's return type, and the walk reads those types to decide whether it is asynchronous.

A visitor may attach a field of its own to a node by declaring it through the namespace the class merges with:

```typescript
declare module "@sdxc/markdown" {
	namespace Markdown {
		interface Code {
			tokens?: Token[];
		}
	}
}
```

`Markdown.stringify` writes only the fields the parser produces, so anything a visitor attaches is derived data that survives a round trip through the document and not through the text.

## Pattern: read the tree without transforming it

A handler that returns nothing changes nothing, which makes `Markdown.walk` a traversal as well.

```typescript
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";

let toc: Array<{ level: number; text: string; id: string }> = [];

Markdown.walk(document, {
	heading(node) {
		if (node.level > 3) return;
		toc.push({
			level: node.level,
			text: toPlainText(node),
			id: String(node.attributes.id ?? slugify(toPlainText(node))),
		});
	},
});
```

## Pattern: annotations and tags

An **annotation** attaches attributes to a block that already exists. It is `{% key="value" %}`, it supports `#id` and `.class` shorthands, and it goes on the same line for blocks with a single-line opener — a heading, a fence — and on its own line above for the rest. A blank line between the annotation and its block is allowed. Two annotations above one block merge, the lower one winning a repeated key.

````md
## Installing the agent {% #install .lead %}

```tsx {% path="app/http/controllers/post.tsx" title="Post controller" %}
export default createAction(routes.posts.show, (ctx) => ctx.render(<PostView />));
```

{% .wide %}

| Plan | Monitors |
| ---- | -------- |
| Free | 5        |
````

A **tag** creates a node that has no markdown syntax, and is written as an element. Only registered names become tags; an unregistered `<div>` stays raw HTML. Registering a tag declares its attribute schema, which is what makes a bad attribute a parse error with a line number:

```typescript
export const options = {
	frontmatter: Frontmatter,
	tags: {
		callout: { attributes: s.object({ type: s.picklist(["info", "warning", "danger"]) }) },
		kbd: { content: "inline" },
		video: { content: "none", attributes: s.object({ src: s.string() }) },
	},
} satisfies Markdown.Options;
```

`content` says what the tag contains, which is the one question the parser asks before reading what follows the opening tag:

| `content`            | The tag's children                                 | Example     |
| -------------------- | -------------------------------------------------- | ----------- |
| `"blocks"` (default) | parsed as block markdown — paragraphs, lists, tags | `<callout>` |
| `"inline"`           | parsed as inline markdown only                     | `<kbd>`     |
| `"none"`             | none; the tag is written self-closing              | `<video />` |

```md
<callout type="warning">
Deleting a monitor also deletes its **history**. This cannot be undone.
</callout>

Press <kbd>Cmd</kbd> then <kbd>K</kbd> to open search.

<video src="/demo/flow-monitors.mp4" />
```

A tag's children are markdown all the way down, so `**history**` arrives as a `strong` node. Supply the components where the document is rendered:

```tsx
toRemix(document, { components: { callout: Callout, kbd: Kbd, video: Video } });
```

A tag with no component renders its children and nothing else, so a missing component drops the chrome and keeps the content.

## Pattern: variables resolved per render

`{% $name %}` in text parses to a `variable` node carrying that name. Nothing is substituted at parse time, so one parsed document serves every render, and resolution is a `Markdown.walk` the caller writes.

```typescript
let variables: Record<string, string | number> = { product: "Uptime", plan: team.plan };

let result = Markdown.walk(cachedDocument, {
	variable(node) {
		let value = variables[node.name];
		if (value === undefined) throw new Error(`Unresolved variable ${node.name}`);
		return { type: "text", value: String(value), position: node.position };
	},
});
```

What a variable _means_ is the consumer's: documentation should fail loudly on an unresolved name, a marketing page should probably render the literal, and a preview should show the name itself. Throwing from the handler turns it into the failure branch with the node's position attached; returning nothing leaves the hole in place.

Because variables survive parsing, `Markdown.stringify` round-trips them, so the markdown an agent fetches is the template rather than one tenant's copy.

## Pattern: GitHub alerts

```md
> [!NOTE]
> Cron monitors bill per check, not per minute.
```

They parse to an `alert` node carrying `kind`, so a renderer draws them without inspecting the first line of a block quote, and a custom component can take them over:

```tsx
toRemix(document, { components: { alert: Alert } });
```

## Pattern: lint content in CI

Parsing returns positions, so a check reads like a test:

```typescript
let problems: string[] = [];

Markdown.walk(document, {
	code(node) {
		if (node.language === undefined) {
			problems.push(`${file}:${node.position.start.line} code block without a language`);
		}
	},
});
```

## What is out of scope

- **Math and emoji shortcodes.** Inline math is a second delimiter grammar over the most common currency character in prose, and emoji shortcodes need a table of roughly eighteen hundred names. Both are visitors another package can ship over `text` nodes.
- **Derived heading anchors.** GitHub slugifies heading text at render time; that is a renderer's or a visitor's decision, so the parser attaches only the `id` an annotation writes.
- **Repository-context autolinking.** `@mention`, `#123` and bare commit SHAs need a repository to resolve against.
- **Rendering a fence's language.** A `mermaid` or `geojson` fence parses as a code block with that language; drawing it is the renderer's job, through `components`.
- **A concrete syntax tree.** The serializer normalizes, and idempotency is the property that matters.

## Related Packages

- [`@sdxc/highlight`](/packages/highlight) — the `highlight` visitor and the `tokens` field it attaches
- [`@sdxc/yaml`](/packages/yaml) — reads and writes the frontmatter block
- [`@sdxc/result`](/packages/result) — the `Result` every entry point returns
- [`@sdxc/strings`](/packages/strings) — excerpts and word counts over extracted plain text

## Tips

- Hoist the options object to module scope and hand the same one to `Markdown.parse` and `Markdown.frontmatter`.
- Cache the parsed document, not the rendered output: the AST is plain JSON, and a walk per request costs a spine.
- Prefer one merged visitor over several walks; subtrees no handler touched are shared by reference either way, but one pass reads the tree once.
- Reach for a tag before raw HTML. Raw HTML renders as visible text, which is what keeps an unvetted `<script>` inert.
