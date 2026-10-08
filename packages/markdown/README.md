# @sdxc/markdown

GitHub Flavored Markdown: parse to a typed AST, transform it, write it back.

The dialect is the one every author already knows — everything in
[CommonMark](https://spec.commonmark.org/), plus
[GitHub Flavored Markdown](https://github.github.com/gfm/)'s tables, task lists,
strikethrough and literal autolinks, plus GitHub's alerts and footnotes.

Every node is a plain JSON-serializable object with a `type` discriminator, its own fields
and a `position`, so a parsed document can be cached, sent in a payload, diffed in a test,
and narrowed by the compiler at every hop.

## Installation

```bash
npm add @sdxc/markdown
```

Every entry point reports its outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure` and
`unwrap` come from; the frontmatter block is read by
[`@sdxc/yaml`](https://www.npmjs.com/package/@sdxc/yaml) and validated against any
[Standard Schema](https://standardschema.dev) validator, and `@sdxc/markdown/remix` renders
into the UI nodes of [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Parse A Document

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

let result = Markdown.parse("# Hello\n\nSome **markdown**.");
if (isFailure(result)) throw result.error;

let { document } = result.data;

document.children[0]; // { type: "heading", level: 1, children: [...], ... }
```

### Validate The Frontmatter

A schema turns the block into typed data, and a document missing a required field fails with
the line to open:

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let Frontmatter = s.object({
	title: s.string(),
	description: s.string(),
	publishedAt: coerce.date(),
});

let result = Markdown.parse(source, { frontmatter: Frontmatter });
if (isFailure(result)) throw result.error;

let { frontmatter, document } = result.data;

frontmatter.publishedAt; // Date
```

`Markdown.frontmatter` takes the same options object and stops after the block, so an index
over a hundred documents reads a hundred titles without parsing a hundred bodies.

### Render It

Static HTML, for a response that carries markup:

```typescript
import { toHTML } from "@sdxc/markdown/html";

let body = toHTML(document);
```

Or UI nodes, for a view that owns the markup around them:

```tsx
import type { Markdown } from "@sdxc/markdown";
import type { Handle } from "remix/component";

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

### Extract Plain Text

```typescript
import { toPlainText } from "@sdxc/markdown/plain";

let excerpt = toPlainText(document);
let indexed = toPlainText(document, { code: true });
```

It takes a node rather than a source string, so a caller that has already parsed does not
parse twice, and a caller that walked the tree first measures what it actually renders.

### Write A Document Back

```typescript
import { Markdown } from "@sdxc/markdown";
import { isFailure, unwrap } from "@sdxc/result";

let { frontmatter, document } = unwrap(Markdown.parse(source, { frontmatter: Frontmatter }));

let written = Markdown.stringify(document, {
	frontmatter: { ...frontmatter, updatedAt: new Date() },
});
if (isFailure(written)) throw written.error;
```

Omitting `frontmatter` writes the body alone.

## API

### `@sdxc/markdown`

#### `Markdown`

A class with a private constructor and only static methods, merged with a namespace of the
same name. `new Markdown()` is a compile error, so the name is a namespace the compiler
enforces: `Markdown.parse()` is the method and `Markdown.Document` is the type it returns.

##### `Markdown.parse(source, options?)`

Reads the frontmatter block and the body in one traversal, answering with
`{ frontmatter, document }` or a `MarkdownParseError` carrying the `position` it stopped at.
`options.frontmatter` is the schema to validate the block against, `options.tags` names
the tags the document may use, and `options.html` the HTML elements it may render as elements
(see [Pattern: Allowlisted HTML](#pattern-allowlisted-html)).

##### `Markdown.frontmatter(source, options?)`

Reads the frontmatter block and stops, leaving the body unparsed. What it yields depends on
whether the file opens with a block and whether the options carry a schema:

| Block   | Schema | `frontmatter` is                                                       |
| ------- | ------ | ---------------------------------------------------------------------- |
| present | yes    | the schema's output, or a failure carrying its issues and the position |
| present | no     | the YAML value as read, typed `unknown`                                |
| absent  | yes    | the schema run against `{}`, so a required field fails at line 1       |
| absent  | no     | `{}`                                                                   |

A block the YAML parser rejects is a failure, not an empty object: the error carries the YAML
error as its `cause` and the line it sits on.

Frontmatter is a set of named fields, so a delimited block holding anything else — a scalar,
a sequence, nothing at all — counts as absent, and its lines belong to the body. That is what
lets a document open on two thematic breaks.

##### `Markdown.stringify(document, options?)`

Writes a document back as markdown, answering with the source or a `MarkdownStringifyError`
for a frontmatter value YAML cannot write. `options.frontmatter` is written as a YAML block
ahead of the body.

The serializer normalizes rather than reproducing the source. What holds is idempotency:
parsing the output and serializing again yields the same string.

##### `Markdown.walk(node, visitor)`

Rewrites a tree through a visitor, returning a new node of the same type and sharing every
subtree no handler touched. The result is a `Result<N, MarkdownWalkError>`, or a promise of
one when a handler is asynchronous. See
[Pattern: Transform A Document](#pattern-transform-a-document).

#### `namespace Markdown`

The AST. `Markdown.Node` is `Document | Block | Inline`; `document` is the root and belongs
to neither column, so a `Block[]` can never hold a nested document.

| Blocks                                                                                                                                                                   | Inline                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heading` `paragraph` `code` `list` `listItem` `blockquote` `alert` `table` `tableRow` `tableCell` `thematicBreak` `html` `footnoteDefinition` `comment` `element` `tag` | `text` `emphasis` `strong` `strikethrough` `inlineCode` `link` `image` `softBreak` `hardBreak` `inlineHtml` `footnoteReference` `variable` `comment` `element` `tag` |

Every `type` names exactly one interface, so `Extract<Markdown.Node, { type: K }>` always
narrows to one shape. Three names sit in both columns: a `tag` or an `element` is
block-level or inline depending on where it is written, and its `children` say which; a
`comment` is a block on a line of its own and inline inside one.

Every node carries a `position` — 1-based `line` and `column`, 0-based `offset`, all into the
source as written, frontmatter included. Every block but `comment` carries `attributes`,
because an annotation may sit above any block that renders.

Two constructs exist in the source and not in the tree. A link reference definition is
consumed at parse time and every reference to it becomes a `link`. Footnotes keep both
halves, because a renderer draws them in two places.

`Markdown.Options`, `Markdown.StringifyOptions`, `Markdown.TagDefinition` and
`Markdown.Visitor` live here too, beside the node interfaces.

#### `MarkdownParseError`, `MarkdownStringifyError`, `MarkdownWalkError`

`MarkdownParseError` and `MarkdownWalkError` carry the `position` they failed at;
`MarkdownParseError` also carries the `issues` a frontmatter or attribute schema reported,
and `MarkdownWalkError` the thrown value as its `cause`. `MarkdownStringifyError` reports a
frontmatter value YAML cannot write, which belongs to no place in the document.

### `@sdxc/markdown/plain`

#### `toPlainText(node: Markdown.Node, options?: PlainTextOptions): string`

Reads the prose out of any node, blocks separated by a blank line. Taking any node is what
makes it usable inside a visitor.

- `options.code`: Include the body of code blocks; defaults to `false`. Inline code is always
  kept, since it is part of the sentence around it.
- `options.images`: Include image alternative text; defaults to `false`.

### `@sdxc/markdown/html`

#### `toHTML(node: Markdown.Node, options?: HTMLOptions): string`

Renders any node as static HTML, with no wrapper element of its own, so a caller can render a
fragment of a document. `options.tags` carries markup for a tag keyed by tag name; a tag with
no renderer contributes its children alone.

`options.syntax` is `"html"` by default. Set it to `"xhtml"` for an EPUB content document or any
other consumer that parses the output as XML: every void element is self-closed (`<input />`)
and every boolean attribute carries its name as its value (`disabled="disabled"`, an annotation's
`data-wide="data-wide"`). Markup a tag renderer returns is written as the renderer built it.

Elements are plain and semantic, and a `md-` class appears only where HTML has no element that
says what the node is:

| Class                                                                     | On                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------- |
| `md-alert md-alert-<kind>`                                                | the `<aside>` an alert renders as, with `data-kind` |
| `md-code`                                                                 | a code block's `<pre>`, beside `language-<name>`    |
| `md-table`                                                                | a table                                             |
| `md-align-left/center/right`                                              | a cell in a column the delimiter row aligned        |
| `md-task`, `md-task-box`                                                  | a task list item and its checkbox                   |
| `md-footnotes`, `md-footnote-list`, `md-footnote-ref`, `md-footnote-back` | the trailing footnote section and its links         |
| `md-variable`                                                             | an unresolved `{% $name %}` hole                    |

An annotation's `id` and `class` are written onto the element, and any other attribute becomes
a `data-` attribute, so `{% #install .lead %}` styles and links the way it reads.

Raw HTML renders **as escaped text**, so nothing the renderer did not vet becomes markup; an
`element` the allowlist let through renders as itself. A code block a visitor painted first renders one `<span class="token …">` per run.

#### `HTMLTagRenderer`

The shape of one entry in `options.tags`: it takes the tag's `name`, its `attributes` and its
`children` already rendered, and returns the markup to stand in its place.

### `@sdxc/markdown/remix`

#### `toRemix(node: Markdown.Node, options?: RemixOptions): RemixNode`

Renders any node into Remix UI output, so a caller can render a fragment of a document.
`options.components` is keyed by tag name, or by a node type to take that node over wherever
it sits.

It returns nodes from data and holds no props or reactive state, so calling it inside a render
closure is not a component called as a function.

Raw HTML renders **as escaped text**, so a stray `<div>` shows as written rather than becoming
an element. An element the document's allowlist names renders as itself; anything richer is a
registered tag.

#### `MarkdownComponent`

The shape of one entry in `options.components`: a component whose props are the node's own
content fields and the attributes an annotation wrote, flattened into one bag, plus `children`.

### `@sdxc/markdown/plugin/variables`

#### `variables(values, options?)`

Returns a visitor for `Markdown.walk` that fills every variable from `values`: a text hole
becomes a `text` node, and an attribute value takes the value itself, arrays and objects
included. A block holding no variable is handed back as the same object.

- `options.html`: The document's HTML allowlist, so a URL an element's variable is filled with
  is checked the way a literal one is at parse time.
- `options.tags`: The document's tag vocabulary. A tag whose schema waited on a variable is
  checked once its attributes are filled in, keeping what the schema coerced; a failure is
  the walk's failure, carrying the tag's position and the `MarkdownParseError` with the
  schema's issues as its `cause`. Passing the options the document was parsed with is the
  usual call.
- `options.missing`: `"fail"` (the default) turns a name with no value into a walk failure at
  the variable's position; `"keep"` leaves the variable in place.

A text hole whose value is a list, an object or `null` is a failure, because only a string,
number or boolean has a text form.

### `@sdxc/markdown/plugin/headings`

#### `headings(options?)`

Returns a visitor for `Markdown.walk` that gives every heading an `id` attribute, so in-page
links have an anchor to land on. A heading with an author-written id (`## Install {% #setup %}`)
keeps it; every other heading takes a GitHub-compatible slug of its plain text, inline markup
dropped, so a `#fragment` copied from GitHub resolves here. A repeated slug takes the first
free `-1`, `-2` suffix.

Walking a document reserves every id an author wrote in it first, on any block and wherever it
stands, so a generated slug never takes one written further down. Each document walk starts
with no ids taken; a walk from a subtree keeps the ids of the walks before it, so take a fresh
`headings()` per subtree. A heading that already carries an `id`, a variable included, and
every other node are handed back as the same object.

- `options.levels`: The levels that get a generated id (default all, `1`–`6`). Author ids at
  every level are kept and reserved all the same.
- `options.slug`: Turns a heading's plain text into its id in place of GitHub's slug; repeated
  results are still numbered.

A heading whose slug is empty, such as one of punctuation alone, is left without an id.

#### `tableOfContents(node, options?)`

Reads the headings of a walked document back as a tree of `{ id, text, level, children }`:
each heading holds the deeper ones that follow it until the next heading at its level or
shallower, so a skipped level (`##` then `####`) nests under the nearest shallower heading.
Ids are read as present, so it runs after `headings()`; a heading with no id is left out.

- `options.levels`: The levels to list (default `[2, 3]`).

```typescript
import { headings, tableOfContents } from "@sdxc/markdown/plugin/headings";

let document = unwrap(Markdown.walk(cachedDocument, headings()));
let toc = tableOfContents(document);
```

### `@sdxc/markdown/plugin/links`

#### `links(options?)`

Returns a visitor for `Markdown.walk` that rewrites the URLs a document points at: a link's
`href`, an image's `src`, and the `href` and `src` of an allowlisted element. A node whose URLs
come out as written is handed back as the same object.

- `options.base`: The absolute URL a relative one resolves against, the way a browser resolves
  it against a page; `./`, `../` and root-relative paths all resolve, keeping their query and
  fragment. Absolute URLs, `mailto:`/`tel:` and fragment-only `#id` links, which point inside
  the page, stay as written.
- `options.rewrite`: Runs on every URL once `base` has resolved it, absolute ones included,
  with the node beside it; it returns the URL to write, or `undefined` to keep the one it was
  given.

An element attribute holding a variable stays as written until the variable is filled. A
`base` that is no absolute URL fails the walk at the first relative URL.

```typescript
import { links } from "@sdxc/markdown/plugin/links";

let result = Markdown.walk(
	document,
	links({
		base: "https://github.com/acme/repo/blob/main/docs/",
		rewrite: (url) => (url.endsWith(".md") ? url.replace(/\.md$/, "") : undefined),
	}),
);
```

### `@sdxc/markdown/plugin/typography`

#### `typography(options?)`

Returns a visitor for `Markdown.walk` that sets prose in typographic punctuation: `"` and `'`
become curly quotes, `--` an en dash, `---` an em dash and `...` an ellipsis. Only `text` nodes
change, so code, inline code, raw HTML, attribute values and `code`/`kbd`/`samp`/`var`
elements keep their ASCII. A text node with nothing to change is handed back as the same
object.

Each paragraph, heading, table cell, or block-level tag or element holding inline content is
set as one run, so a quote is decided by the characters around it even when they sit in a
sibling or a nested node: `"**bold**"` opens before the strong text and closes after it. A
quote opens after the start of the run, whitespace, a bracket, a dash or another opening
quote, when something follows it, and closes otherwise; a `'` inside a word (`don't`,
`Sergio's`) or ahead of an elided year (`'90s`) is an apostrophe, `’`.

- `options.quotes`: `true` (the default), `false`, or the marks a locale writes,
  `{ double: ["«", "»"], single: ["‹", "›"] }`; the apostrophe stays `’` either way.
- `options.dashes`: Turns `--` and `---` into dashes; defaults to `true`.
- `options.ellipses`: Turns `...` into `…`; defaults to `true`.

### `@sdxc/markdown/plugin/embeds`

#### `embeds(providers)`

Returns a visitor for `Markdown.walk` that turns a URL pasted on a line of its own into a
block `tag` node. The first provider in `providers` that recognises the URL wins. A paragraph
qualifies when it holds one link and nothing but whitespace around it, and that link shows its
own URL, whether written bare, as `<https://…>`, or as a `www.` autolink. A link with a label
of its own, or a URL sharing its line with text, stays a link. A paragraph no provider claims
is handed back as the same object.

The tag takes the provider's `name`, the paragraph's position and no children. Its attributes
are the paragraph's annotation, then what the provider matched, then `url` holding the link's
href, so a renderer can always fall back to a plain link. Matching reads the URL alone, and
embedding never touches the network.

#### `EmbedProvider`

`{ name: string; match(url: URL): Markdown.Attributes | null }`. `name` is the tag name the
renderer is registered under; `match` returns the tag's attributes, or `null` for a URL that
is not the provider's.

#### `youtube(options?)`, `vimeo(options?)`, `gist(options?)`, `x(options?)`

Built-in providers whose tag name defaults to their own name. Pass `options.name` to rename
it, e.g. `youtube({ name: "video" })`.

| Provider  | Recognises                                                                     | Attributes     |
| --------- | ------------------------------------------------------------------------------ | -------------- |
| `youtube` | `youtube.com/watch?v=`, `/shorts/`, `/embed/`, `/live/`, `youtu.be/`, nocookie | `id`, `start?` |
| `vimeo`   | `vimeo.com/ID`, `vimeo.com/ID/HASH`, `player.vimeo.com/video/ID?h=HASH`        | `id`, `hash?`  |
| `gist`    | `gist.github.com/USER/ID`                                                      | `user`, `id`   |
| `x`       | `x.com/USER/status/ID` and `twitter.com/USER/status/ID`                        | `user`, `id`   |

`start` is YouTube's `t` or `start` parameter in seconds (`90`, `90s`, `1m30s`).

### `@sdxc/markdown/plugin/lint`

#### `lint(document, options?)`

Checks a parsed document and returns a `LintProblem[]` (`{ rule, message, position }`),
ordered by where each problem starts in the source. Problems are data: an empty array means
the document passed, and the function never fails. Every rule runs by default:

| Rule                | Reports                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| `code-language`     | a code block with no language, indented code included                                   |
| `heading-increment` | a heading more than one level deeper than the one before it; the first may be any level |
| `single-h1`         | every level-1 heading after the first                                                   |
| `image-alt`         | an image, or an `img` element, with empty alternative text                              |
| `empty-link`        | a link, or an `a` element, with an empty `href` or no text                              |
| `broken-anchor`     | a `#fragment` link that matches no id in the document                                   |
| `duplicate-id`      | a block whose explicit `id` an earlier block already claimed                            |

A fragment resolves against the ids `headings()` would assign: every explicit `id` an
annotation wrote, then a GitHub slug for each heading without one, numbered `-1`, `-2` when
repeated.

- `options.rules`: `{ [rule]: false }` turns a rule off, built-in or custom.
- `options.ids`: Ids the page has outside the document, such as a layout's `#comments`.
- `options.custom`: Extra rules keyed by name, each `(node, report) => void`, run once per
  node in document order. `report(message, position?)` records a problem at the node, or at
  the position given.

## Pattern: Transform A Document

`Markdown.walk` is the only transform mechanism. A visitor is a plain object with one optional
handler per node type, keyed by the type's name, so the handler's argument is typed with no
narrowing to write. A handler receives the node and its parent, and a node whose type has no
handler is passed through untouched.

What a handler returns decides what happens to that node:

| Returns                       | Effect                                        |
| ----------------------------- | --------------------------------------------- |
| a node                        | replaces the node                             |
| an array of nodes             | splices them in its place                     |
| `null`                        | removes the node                              |
| nothing                       | leaves the node alone, children still visited |
| a promise of any of the above | makes the whole walk asynchronous             |

The walk is top-down, and no handler runs on a replacement node itself — only on its children
— so a `code` handler returning a `code` terminates rather than looping. A replacement stands
in the slot the original held, so a block yields blocks and an inline yields inline. The node
the walk started from is handed back whole: replacing it with a node of its own category is
allowed, and removing or splicing it is a failure.

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

A handler that throws lands on the failure branch with the node's position attached, rather
than escaping as an exception. The `cause` is always the original value, so a caller that
throws on an unfamiliar `cause` and handles a familiar one keeps both.

Being an object makes a visitor a value: it can be named, exported from another package, and
merged by spread, so a consumer runs one pass instead of three. Syntax highlighting ships that
way, as the `highlight` visitor in
[`@sdxc/highlight`](https://www.npmjs.com/package/@sdxc/highlight):

```typescript
import { highlight } from "@sdxc/highlight/markdown";

let result = Markdown.walk(document, { ...highlight, ...anchors });
```

An exported visitor is declared with `satisfies Markdown.Visitor`, never with a type
annotation: an annotation widens every handler's return type, and the walk reads those types
to decide whether it is asynchronous.

A visitor may attach a field of its own to a node by declaring it through the namespace the
class merges with:

```typescript
declare module "@sdxc/markdown" {
	namespace Markdown {
		interface Code {
			tokens?: Token[];
		}
	}
}
```

`Markdown.stringify` writes only the fields the parser produces, so anything a visitor
attaches is derived data that survives a round trip through the document and not through the
text.

## Pattern: Read The Tree Without Transforming It

A handler that returns nothing changes nothing, which makes `Markdown.walk` a traversal as
well.

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

## Pattern: Annotations And Tags

An **annotation** attaches attributes to a block that already exists. It is `{% key="value" %}`,
it supports `#id` and `.class` shorthands, and it goes on the same line for blocks with a
single-line opener — a heading, a fence — and on its own line above for the rest. A blank line
between the annotation and its block is allowed. Two annotations above one block merge, the
lower one winning a repeated key.

````text
## Getting started {% #getting-started .lead %}

```typescript
let client = connect(url);
```

{% .wide %}

| Plan    | Seats |
| ------- | ----- |
| Starter | 5     |
````

A **tag** creates a node that has no markdown syntax, and is written as an element. Only
registered names become tags; an unregistered `<div>` stays raw HTML. Registering a tag
declares its attribute schema, which is what makes a bad attribute a parse error with a line
number:

```typescript
let options = {
	frontmatter: Frontmatter,
	tags: {
		callout: { attributes: s.object({ type: s.enum_(["info", "warning", "danger"]) }) },
		kbd: { content: "inline" },
		video: { content: "none", attributes: s.object({ src: s.string() }) },
	},
} satisfies Markdown.Options;
```

`content` says what the tag contains, which is the one question the parser asks before reading
what follows the opening tag:

| `content`            | The tag's children                                 | Example     |
| -------------------- | -------------------------------------------------- | ----------- |
| `"blocks"` (default) | parsed as block markdown — paragraphs, lists, tags | `<callout>` |
| `"inline"`           | parsed as inline markdown only                     | `<kbd>`     |
| `"none"`             | none; the tag is written self-closing              | `<video />` |

```text
<callout type="warning">
Deleting a workspace also deletes its **history**, permanently.
</callout>

Press <kbd>Cmd</kbd> then <kbd>K</kbd> to open search.

<video src="/demo/tour.mp4" />
```

A tag's children are markdown all the way down, so `**history**` arrives as a `strong` node.
Supply the components where the document is rendered:

```tsx
toRemix(document, { components: { callout: Callout, kbd: Kbd, video: Video } });
```

A tag with no component renders its children and nothing else, so a missing component drops
the chrome and keeps the content.

### Attribute Values

A tag and an annotation take the same values. A quoted string is written as-is; everything
else goes in braces, and braces hold data and names, never code:

| Written                                            | Reads as                                |
| -------------------------------------------------- | --------------------------------------- |
| `title="Plans"`                                    | the string                              |
| `wide`                                             | `true`                                  |
| `count={3}`, `open={false}`, `empty={null}`        | the number, boolean or `null`           |
| `src={$cdn}`                                       | a `variable` node, filled in per render |
| `price={$plan.price}`, `first={$items.0}`          | a `variable` node with a dotted path    |
| `data={[1, 2, $three]}`                            | an array                                |
| `options={{ stacked: true, "max-width": $width }}` | an object                               |

Arrays and objects nest, take a trailing comma, and may span lines. An object whose `type` is
`"variable"` is a parse error, since that is the shape of a variable node.

A tag's schema runs at parse time on literal attributes. When any attribute holds a variable,
the check waits for the value: the [`variables`](#sdxc-markdownpluginvariables) visitor runs it
once the names are filled in, and fails at the tag's position. `toHTML` writes a structured
annotation value into its `data-` attribute as JSON, and a variable nobody filled in as the
braced spelling the source used.

## Pattern: Variables Resolved Per Render

`{% $name %}` in text and `{$name}` in an attribute value parse to a `variable` node carrying
that name. A name may continue as a dotted path — `{% $plan.price %}`, `{$items.0}` — whose
segments are names or array indexes, and the node keeps the path exactly as written. Nothing is
substituted at parse time, so one parsed document serves every render, and filling it is a walk:

```typescript
import { variables } from "@sdxc/markdown/plugin/variables";

let result = Markdown.walk(
	cachedDocument,
	variables({ product: "Acme", plan: team.plan, cdn: env.CDN_URL }, MARKDOWN_OPTIONS),
);
```

A dotted path is filled by walking the value one segment at a time: a name reads an object's
own property and a number indexes an array. A path that runs off its data at any segment is a
missing variable, and the failure names the full path (`No value for $plan.price`). A path is
data access only: `$a.b[0]` and `$a.b()` stay text, and a trailing dot or empty segment is not
a variable.

What a missing name _means_ is the consumer's: documentation fails loudly on one, which is the
default, and a preview passes `{ missing: "keep" }` to leave the hole for the renderer to show.
A visitor of your own that handles `variable` does the same job for any other policy.

Because variables survive parsing, `Markdown.stringify` round-trips them, so the markdown a
client fetches is the template rather than one tenant's copy.

## Pattern: Allowlisted HTML

Raw HTML stays escaped text unless the document opts an element in. `options.html` names each
element and the attributes it may carry:

```typescript
let options = {
	html: { details: ["open"], summary: [], sup: [], kbd: [], a: ["href", "title"], br: [] },
} satisfies Markdown.Options;
```

```text
<details open>
<summary>What does **retry** mean?</summary>

A failed check runs again before it alerts.
</details>

E = mc<sup>2</sup>, and <kbd>Cmd</kbd> opens search.
```

An allowlisted name parses to an `element` node whose children are markdown, the way a tag's
are, and every renderer draws it as itself. Where it stands comes from the element:

| Element                                                       | Reads as                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `details`, `div`, `section`, `aside`, `figure`, `dl`, `dd`, … | a block alone on its line holding blocks, or its text when written on one line |
| `summary`, `figcaption`, `dt`                                 | a block holding a line of inline content                                       |
| `sup`, `sub`, `kbd`, `abbr`, `mark`, `a`, `span`, `time`, …   | inline content wherever it is written                                          |
| `br`, `img`, `wbr`, `hr`                                      | void, closing slash optional; `hr` alone is a block                            |

Elements markdown already spells — `p`, `h1`, `ul`, `table`, `pre` — and those whose body is
script or raw text cannot be allowlisted. An attribute the allowlist does not name is a parse
error at the opening tag, an `on…` handler is refused even when named, and `href`, `src` and
the other URL attributes take only relative, `http`, `https`, `mailto` and `tel` URLs. A value
may be a variable; the [`variables`](#sdxc-markdownpluginvariables) visitor checks the URL once
it is filled in, given `html`. A registered tag of the same name takes precedence.

## Pattern: Comments

`{/* … */}` is a note for whoever edits the source. Every renderer leaves it out, and
`Markdown.stringify` writes it back, so a document parsed and written by an editor keeps it.

```text
{/*
  Numbers below come from the pricing page; update both together.
*/}

Starter costs $9 a month. {/* TODO: confirm with billing */}
```

On a line of its own it is a `comment` block, and it may span lines, blank ones included; the
line holding `*/}` ends with it. Inside a line it is an inline `comment`. An annotation above a
comment decorates the block after it, so a comment can sit between the two. A comment that
never closes is a parse error at the line it opened on, so a missing `*/}` cannot swallow the
rest of a document. `\{/*` writes the characters themselves.

## Pattern: GitHub Alerts

```text
> [!NOTE]
> Parsing happens once, and rendering happens per request.
```

They parse to an `alert` node carrying `kind`, so a renderer draws them without inspecting the
first line of a block quote, and a custom component can take them over:

```tsx
toRemix(document, { components: { alert: Alert } });
```

## Pattern: Embed Pasted URLs

```tsx
import { embeds, gist, vimeo, x, youtube } from "@sdxc/markdown/plugin/embeds";
import { toRemix } from "@sdxc/markdown/remix";

let result = Markdown.walk(document, embeds([youtube(), vimeo(), gist(), x()]));
if (isFailure(result)) return result;

toRemix(result.data, { components: { youtube: YouTube, vimeo: Vimeo, gist: Gist, x: Post } });
```

Register a component for every provider you pass. A tag with no component renders its
children, and an embed has none, so an embed without a component renders nothing. Leave a
provider out of `embeds` to keep its URLs as links.

## Pattern: Lint Content In CI

Parsing returns positions, so a check reads like a test:

```typescript
import { lint } from "@sdxc/markdown/plugin/lint";

let problems = lint(document, {
	rules: { "single-h1": false },
	custom: {
		"no-todo"(node, report) {
			if (node.type === "text" && node.value.includes("TODO")) report("TODO left in the copy");
		},
	},
});

for (let problem of problems) {
	console.error(`${file}:${problem.position.start.line} ${problem.message} (${problem.rule})`);
}
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
