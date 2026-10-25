# @sdxc/markdown

GitHub Flavored Markdown: parse to a typed AST, transform it, write it back.

The dialect is [CommonMark](https://spec.commonmark.org/) plus
[GitHub Flavored Markdown](https://github.github.com/gfm/)'s tables, task lists, strikethrough
and autolinks, GitHub's alerts and footnotes, and a few extensions: annotations, registered
tags, allowlisted HTML, variables and comments. Every node is a plain JSON object with a `type`
and a `position`, so a parsed document can be cached, sent in a payload and diffed in a test.

## Installation

```sh
npm add @sdxc/markdown
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). Frontmatter is
read as YAML and validated with any [Standard Schema](https://standardschema.dev) validator, such
as `remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix), which
`@sdxc/markdown/remix` also renders into.

## Usage

### Parse a document

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

let result = Markdown.parse("# Hello\n\nSome **markdown**.");
if (isFailure(result)) throw result.error; // a MarkdownParseError with a position

let { document } = result.data;
document.children[0]; // { type: "heading", level: 1, children: [...], position: {...} }
```

### Validate the frontmatter

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let Frontmatter = s.object({ title: s.string(), publishedAt: coerce.date() });

let result = Markdown.parse(source, { frontmatter: Frontmatter });
if (isFailure(result)) throw result.error; // names the line of the bad or missing field

result.data.frontmatter.publishedAt; // Date

let meta = Markdown.frontmatter(source, { frontmatter: Frontmatter }); // the block alone, body unparsed
```

### Transform it with visitors

A visitor is an object with one optional handler per node type. `Markdown.walk` applies it and
returns a new tree; `Markdown.compose` merges several so they run in one pass.

```typescript
import { Markdown } from "@sdxc/markdown";
import { headings } from "@sdxc/markdown/plugin/headings";
import { typography } from "@sdxc/markdown/plugin/typography";

let walked = Markdown.walk(
	document,
	Markdown.compose(headings(), typography(), {
		image(node) {
			return { ...node, src: new URL(node.src, "https://cdn.example.com/").href };
		},
	}),
);
```

### Render it

```tsx
import type { Markdown } from "@sdxc/markdown";
import type { Handle } from "remix/component";

import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";
import { toRemix } from "@sdxc/markdown/remix";

let html = toHTML(document); // static markup, for a feed or an email
let excerpt = toPlainText(document); // prose only, for a description or a search index

export default function Article(handle: Handle<{ document: Markdown.Document }>) {
	return () => <article>{toRemix(handle.props.document)}</article>;
}
```

### Write it back

```typescript
import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";

let { frontmatter, document } = unwrap(Markdown.parse(source, { frontmatter: Frontmatter }));

let written = Markdown.stringify(document, {
	frontmatter: { ...frontmatter, updatedAt: new Date() },
});
```

The output is normalized markdown: parsing it and writing it again yields the same string.

## API

### `@sdxc/markdown`

#### `Markdown.parse(source: string, options?: Markdown.Options): Result<{ frontmatter, document }, MarkdownParseError>`

Reads the frontmatter block and the body. `frontmatter` is the schema's output, the YAML value as
`unknown` without a schema, or `{}` when the file has no block (a schema then runs against `{}`).
A delimited block that is not a mapping counts as body.

#### `Markdown.frontmatter(source: string, options?: Markdown.Options): Result<{ frontmatter }, MarkdownParseError>`

Reads only the frontmatter block, with the same options and rules as `parse`, so an index over
many documents skips their bodies.

#### `Markdown.stringify(document: Markdown.Document, options?: Markdown.StringifyOptions): Result<string, MarkdownStringifyError>`

Writes a document as markdown, with `options.frontmatter` as a YAML block ahead of it. It fails
only for a frontmatter value YAML cannot write.

#### `Markdown.walk(node: N, visitor: Markdown.Visitor): Result<N, MarkdownWalkError>`

Rewrites a tree top-down, returning a node of the same type that shares every untouched subtree.
It returns a promise of the result when any handler is asynchronous.

#### `Markdown.compose(...visitors: Markdown.Visitor[]): Markdown.Visitor`

Merges visitors into one. Handlers for the same node type run in order, each on the node the
previous one returned.

A parent's handlers all run before the walk reaches its children, so text one visitor produces
inside a node, such as a value `variables()` fills, reaches the others only in a later walk.

#### `MarkdownParseError`, `MarkdownStringifyError`, `MarkdownWalkError`

The failures. `MarkdownParseError` carries the `position` and any schema `issues`;
`MarkdownWalkError` carries the `position` and the thrown value as `cause`.

#### `namespace Markdown`

The AST and option types. `Markdown.Node` is `Document | Block | Inline`:

| Blocks                                                                                                                                                                   | Inline                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading` `paragraph` `code` `list` `listItem` `blockquote` `alert` `table` `tableRow` `tableCell` `thematicBreak` `html` `footnoteDefinition` `comment` `element` `tag` | `text` `emphasis` `strong` `strikethrough` `inlineCode` `link` `image` `softBreak` `hardBreak` `inlineHtml` `footnoteReference` `variable` `comment` `element` `tag` |

Each `type` names one interface (`Markdown.Heading`, `Markdown.Link`, …). `tag`, `element` and
`comment` are block or inline depending on where they are written. Every node has a `position`
(`start` and `end` points with 1-based `line` and `column` and 0-based `offset`), and every block
but `comment` has `attributes`. Link reference definitions resolve into `link` nodes.

The namespace also holds `Options` (`frontmatter`, `tags`, `html`), `StringifyOptions`,
`TagDefinition`, `Visitor`, `Attributes`, `AttributeValue`, `Position` and `Point`.

### `@sdxc/markdown/html`

#### `toHTML(node: Markdown.Node, options?: HTMLOptions): string`

Renders any node as static HTML with no wrapper. `options.tags` maps a tag name to an
`HTMLTagRenderer` (`({ name, attributes, children }) => string`, children already rendered); a tag
without one renders its children. `options.syntax: "xhtml"` self-closes void elements and writes
boolean attributes as `name="name"`, for EPUB and other XML consumers.

Raw HTML renders as escaped text. An annotation's `id` and `class` land on the element and other
attributes as `data-*`. Elements are semantic, with `md-` classes where HTML has no element:

| Class                                                                     | On                                        |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| `md-alert md-alert-<kind>`                                                | an alert's `<aside>`, with `data-kind`    |
| `md-code`                                                                 | a code block's `<pre>`, with `language-*` |
| `md-table`, `md-align-left/center/right`                                  | a table and its aligned cells             |
| `md-task`, `md-task-box`                                                  | a task list item and its checkbox         |
| `md-footnotes`, `md-footnote-list`, `md-footnote-ref`, `md-footnote-back` | the footnote section and its links        |
| `md-variable`                                                             | a variable nobody filled in               |

A code node carrying `tokens` (as a syntax highlighter sets them) renders one
`<span class="token …">` per run.

### `@sdxc/markdown/plain`

#### `toPlainText(node: Markdown.Node, options?: PlainTextOptions): string`

The prose of any node, blocks separated by a blank line. `options.code` adds code block bodies
and `options.images` adds alternative text; both default to `false`.

### `@sdxc/markdown/remix`

#### `toRemix(node: Markdown.Node, options?: RemixOptions): RemixNode`

Renders any node as `remix/component` output. `options.components` maps a tag name, or a node
type such as `alert` or `code`, to a `MarkdownComponent`, which receives the node's fields and
attributes as props plus `children`. A tag without a component renders its children; raw HTML
renders as escaped text.

#### `FrameTag`

The component for the `frame` tag: a Remix `<Frame>` loading `src`, with the tag's children as
its fallback. The page must render through `render()` from `remix/middleware/render`, which
resolves frames.

### `@sdxc/markdown/plugin/headings`

#### `headings(options?: HeadingsOptions): Markdown.Visitor`

Gives every heading an `id`: the one an annotation wrote, or a GitHub-compatible slug of its text,
numbered `-1`, `-2` when repeated and never taking an id written elsewhere in the document.
`options.levels` limits which levels get one; `options.slug` replaces the slug function. Use a
fresh `headings()` per walk.

#### `tableOfContents(node: Markdown.Node, options?: TableOfContentsOptions): TableOfContentsEntry[]`

The headings of a walked document as a tree of `{ id, text, level, children }`, levels `[2, 3]` by
default. Headings without an `id` are left out, so run it after `headings()`.

### `@sdxc/markdown/plugin/links`

#### `links(options?: LinksOptions): Markdown.Visitor`

Rewrites the `href` and `src` of links, images and allowlisted elements. `options.base` resolves
relative URLs the way a browser does (absolute, `mailto:`, `tel:` and `#fragment` URLs stay);
`options.rewrite(url, node)` then returns a new URL or `undefined` to keep it.

### `@sdxc/markdown/plugin/typography`

#### `typography(options?: TypographyOptions): Markdown.Visitor`

Curly quotes and apostrophes, `--` to –, `---` to — and `...` to …, in text nodes only. Quotes
are decided across a whole paragraph, so `"**bold**"` curls around the emphasis.
`options.quotes` (`true`, `false` or `{ double, single }` pairs for a locale), `options.dashes`
and `options.ellipses` all default to on.

### `@sdxc/markdown/plugin/variables`

#### `variables(values: Record<string, Markdown.AttributeValue>, options?: VariablesOptions): Markdown.Visitor`

Fills every `variable` node: a text hole becomes `text`, an attribute takes the value itself. Pass
the document's `tags` and `html` options so tag schemas and element URLs are checked once filled.
`options.missing` is `"fail"` (the default) or `"keep"`. A text hole whose value is an array,
object or `null` fails.

### `@sdxc/markdown/plugin/embeds`

#### `embeds(providers: EmbedProvider[]): Markdown.Visitor`

Turns a paragraph holding only a bare URL into a block `tag` named after the first provider that
matches it. Its attributes are the paragraph's annotation, what the provider matched, and `url`.

#### `youtube(options?)`, `vimeo(options?)`, `gist(options?)`, `x(options?)`

Built-in providers; `options.name` renames the tag.

| Provider  | Recognises                                                        | Attributes     |
| --------- | ----------------------------------------------------------------- | -------------- |
| `youtube` | `watch?v=`, `/shorts/`, `/embed/`, `/live/`, `youtu.be`, nocookie | `id`, `start?` |
| `vimeo`   | `vimeo.com/ID`, `vimeo.com/ID/HASH`, `player.vimeo.com/video/ID`  | `id`, `hash?`  |
| `gist`    | `gist.github.com/USER/ID`                                         | `user`, `id`   |
| `x`       | `x.com/USER/status/ID`, `twitter.com/USER/status/ID`              | `user`, `id`   |

### `@sdxc/markdown/plugin/frames`

#### `FRAME_TAG`

The `frame` tag definition for `options.tags`. It takes `src`, which must be a path on the page's
own origin, and an optional `name` a client entry finds it by; its children are block markdown.

### `@sdxc/markdown/plugin/lint`

#### `lint(document: Markdown.Document, options?: LintOptions): LintProblem[]`

Every `{ rule, message, position }` problem in source order; an empty array means the document
passed. `options.rules` turns rules off by name, `options.ids` adds ids that exist outside the
document, and `options.custom` adds `(node, report) => void` rules.

| Rule                | Reports                                                   |
| ------------------- | --------------------------------------------------------- |
| `code-language`     | a code block with no language                             |
| `heading-increment` | a heading more than one level deeper than the one before  |
| `single-h1`         | every level-1 heading after the first                     |
| `image-alt`         | an image or `img` element with empty alternative text     |
| `empty-link`        | a link or `a` element with an empty `href` or no text     |
| `broken-anchor`     | a `#fragment` link matching no id `headings()` would give |
| `duplicate-id`      | an explicit `id` an earlier block already claimed         |

### Types

`HTMLOptions`, `HTMLSyntax` and `HTMLTagRenderer` from `./html`; `PlainTextOptions` from
`./plain`; `RemixOptions` and `MarkdownComponent` from `./remix`; `HeadingsOptions`,
`TableOfContentsOptions` and `TableOfContentsEntry` from `./plugin/headings`; `LinksOptions` and
`LinkedNode` from `./plugin/links`; `TypographyOptions` and `QuotePair` from
`./plugin/typography`; `VariablesOptions` from `./plugin/variables`; `EmbedProvider`
(`{ name, match(url): Markdown.Attributes | null }`) and `EmbedProviderOptions` from
`./plugin/embeds`; `LintRule`, `LintProblem`, `LintReport`, `LintCustomRule` and `LintOptions`
from `./plugin/lint`.

## Pattern: A Documentation Page

Parse once, run every plugin in one walk, then read a table of contents, HTML and search text
from the same tree.

```typescript
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";
import { headings, tableOfContents } from "@sdxc/markdown/plugin/headings";
import { links } from "@sdxc/markdown/plugin/links";
import { typography } from "@sdxc/markdown/plugin/typography";
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse(source);
if (isFailure(parsed)) throw parsed.error;

let walked = Markdown.walk(
	parsed.data.document,
	Markdown.compose(
		highlight,
		headings({ levels: [2, 3] }),
		links({
			base: "https://example.com/docs/guides/",
			rewrite: (url) => (url.endsWith(".md") ? url.slice(0, -3) : undefined),
		}),
		typography(),
	),
);
if (isFailure(walked)) throw walked.error;

let toc = tableOfContents(walked.data); // [{ id, text, level, children }]
let html = toHTML(walked.data);
let searchText = toPlainText(walked.data, { code: true, images: true });
```

The syntax highlighter is the `highlight` visitor from
[`@sdxc/highlight`](https://www.npmjs.com/package/@sdxc/highlight).

## Pattern: Writing A Visitor

What a handler returns decides the node's fate:

| Returns           | Effect                                 |
| ----------------- | -------------------------------------- |
| a node            | replaces it                            |
| an array of nodes | splices them in its place              |
| `null`            | removes it                             |
| nothing           | keeps it, and its children are visited |
| a promise         | makes the whole walk asynchronous      |

A replacement must fit its slot (blocks for a block, inlines for an inline), and handlers never
run on a replacement itself, so a `code` handler returning a `code` node does not loop. A handler
that throws becomes a `MarkdownWalkError` at the node's position.

```typescript
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";

export const dropDrafts = {
	tag(node) {
		if (node.name === "draft") return null;
	},
	async image(node) {
		return { ...node, src: await signImageURL(node.src) };
	},
} satisfies Markdown.Visitor;

let headingTexts: string[] = [];
Markdown.walk(document, {
	heading(node) {
		headingTexts.push(toPlainText(node)); // returns nothing: a read-only traversal
	},
});

let result = await Markdown.walk(document, dropDrafts);
```

Declare exported visitors with `satisfies Markdown.Visitor`, never a type annotation: the walk
reads each handler's return type to decide whether it is asynchronous. A visitor can store its
own data on a node by augmenting the namespace; `Markdown.stringify` leaves such fields out.

```typescript
declare module "@sdxc/markdown" {
	namespace Markdown {
		interface Code {
			lineCount?: number;
		}
	}
}
```

## Pattern: Annotations, Tags And Comments

An annotation adds attributes to an existing block: on the same line for a heading or a fence,
on its own line above anything else. `#id` and `.class` are shorthands. A registered tag is a
node markdown has no syntax for, written like an element, with its attributes checked by a
schema at parse time. `{/* … */}` is a comment every renderer omits and `stringify` keeps.

```text
## Getting started {% #getting-started .lead %}

{% .wide %}

| Plan    | Seats |
| ------- | ----- |
| Starter | 5     |

<callout type="warning">
Deleting a workspace also deletes its **history**.
</callout>

Press <kbd>Cmd</kbd> then <kbd>K</kbd>. {/* TODO: confirm the shortcut */}

> [!NOTE]
> Alerts parse to an `alert` node with a `kind`.
```

```tsx
import { Markdown } from "@sdxc/markdown";
import { toRemix } from "@sdxc/markdown/remix";
import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";

let options = {
	tags: {
		callout: { attributes: s.object({ type: s.enum_(["info", "warning"]) }) },
		kbd: { content: "inline" },
		video: { content: "none", attributes: s.object({ src: s.string() }) },
	},
} satisfies Markdown.Options;

let { document } = unwrap(Markdown.parse(source, options));

toRemix(document, { components: { callout: Callout, kbd: Kbd, video: Video, alert: Alert } });
```

`content` is `"blocks"` (the default; children are block markdown), `"inline"` or `"none"` (a
self-closing tag). Unregistered names stay raw HTML. Attribute values are a quoted string, a bare
key for `true`, or braces holding a number, boolean, `null`, `$variable` (with a dotted path such
as `$plan.price`), array or object: `options={{ stacked: true, width: $width }}`.

## Pattern: Variables Filled Per Render

`{% $name %}` in text and `{$name}` in an attribute parse to `variable` nodes, so one cached
document serves every reader and `stringify` writes the template back.

```typescript
import { Markdown } from "@sdxc/markdown";
import { headings } from "@sdxc/markdown/plugin/headings";
import { variables } from "@sdxc/markdown/plugin/variables";
import { isFailure } from "@sdxc/result";

// source: "## Welcome to {% $product %}\n\nYour plan costs {% $plan.price %} a month."
let filled = Markdown.walk(cachedDocument, variables({ product: "Acme", plan }));
if (isFailure(filled)) throw filled.error; // "No value for $plan.price" at its position

let result = Markdown.walk(filled.data, headings());
```

Fill variables in their own walk before a visitor that reads the text they produce, such as
`headings()`. Pass the `tags` and `html` options the document was parsed with as the second argument, and
`missing: "keep"` for a preview that shows unfilled holes.

## Pattern: Allowlisted HTML

Raw HTML stays escaped text unless `options.html` names the element and the attributes it may
carry. An allowlisted element parses to an `element` node with markdown children, and every
renderer draws it as itself.

```typescript
import { Markdown } from "@sdxc/markdown";

let options = {
	html: { details: ["open"], summary: [], sup: [], a: ["href", "title"], br: [] },
} satisfies Markdown.Options;

let result = Markdown.parse(
	"<details open>\n<summary>What is **retry**?</summary>\n\nA failed check runs again.\n</details>\n\nE = mc<sup>2</sup>",
	options,
);
```

An attribute outside the list is a parse error, `on*` handlers are always refused, and URL
attributes take only relative, `http`, `https`, `mailto` and `tel` URLs. Elements markdown already
spells (`p`, `h1`, `ul`, `table`, `pre`) and script or raw-text elements cannot be allowlisted.

## Pattern: Embeds And Server-Rendered Frames

A URL pasted on its own line becomes an embed tag, and a `frame` tag holds a region a server route
renders per request inside otherwise static prose.

```text
https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90

<frame src="/frames/counter">
Loading the counter…
</frame>
```

```tsx
import { Markdown } from "@sdxc/markdown";
import { embeds, gist, youtube } from "@sdxc/markdown/plugin/embeds";
import { FRAME_TAG } from "@sdxc/markdown/plugin/frames";
import { FrameTag, toRemix } from "@sdxc/markdown/remix";
import { unwrap } from "@sdxc/result";

let { document } = unwrap(Markdown.parse(source, { tags: { frame: FRAME_TAG } }));
let embedded = unwrap(Markdown.walk(document, embeds([youtube(), gist()])));

toRemix(embedded, { components: { youtube: YouTube, gist: Gist, frame: FrameTag } });
```

Register a component for every provider: an embed tag has no children, so without one it renders
nothing. Matching reads the URL alone and never fetches it.

## Pattern: Lint Content In CI

```typescript
import { Markdown } from "@sdxc/markdown";
import { lint } from "@sdxc/markdown/plugin/lint";
import { unwrap } from "@sdxc/result";

let file = "docs/getting-started.md";
let { document } = unwrap(Markdown.parse(source));

let problems = lint(document, {
	rules: { "single-h1": false },
	ids: ["comments"],
	custom: {
		"no-todo"(node, report) {
			if (node.type === "text" && node.value.includes("TODO")) report("TODO left in the copy");
		},
	},
});

let lines = problems.map((p) => `${file}:${p.position.start.line} ${p.message} (${p.rule})`);
if (lines.length > 0) process.exitCode = 1;
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
		"@sdxc/markdown": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
