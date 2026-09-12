# ADR-058: First-Party Markdown Parsing

## Status

**Accepted** - 2026-09-12

## Background

`@sdxc/markdown` parses with Markdoc. It is the last third-party format parser in the
content pipeline: ADR-042 took syntax highlighting, ADR-046 took frontmatter, ADR-047
took YAML, ADR-050 and ADR-055 took HTML, ADR-051 and ADR-052 took the feed formats,
and ADR-056 took the sitemap. Every one of them replaced a dependency that read a format
this repository writes daily with a package named after the format.

Markdown is the format the most content is written in, and it is the one still read by
someone else's parser.

## Context

### The dependency is used for three things

Across the whole repository the Markdoc surface in use is `Markdoc.parse`,
`Markdoc.transform`, and the `Tag` constructor, plus four types. There is no call to
`validate`, `renderers`, `Ast`, or `Tokenizer`.

Every one of the six `new Markdown(...)` sites passes a frontmatter schema and nothing
else. No consumer registers a tag, a variable, a function, or a partial. The `markdoc`
config option exists, is documented, and has never been used.

### The content agrees

Across the thirty-six content files in the repository — 450 KB of uptime documentation,
blog content, and the book sample — there is not one `{%` annotation. The census reads:
twenty-five files with tables, twenty-seven with fences, fourteen with ordered lists,
five with block quotes, one nested list, one autolink, and zero images, raw HTML blocks,
reference definitions, task lists, footnotes, math spans, or emoji shortcodes.

The only Markdoc syntax the repository has ever used is the fence annotation that
`@sdxc/highlight` reads for `path` and `title`, and that appears solely in the two
package READMEs that document it.

### What the content wants is not what Markdoc offers

Markdoc is a template language that happens to read markdown: variables, functions,
conditionals, partials, and a `transform` stage whose reason for existing is to resolve
them. The content here wants the opposite trade — a richer _markdown_, not a template
language over a poorer one:

| Wanted                               | Markdoc                | GitHub |
| ------------------------------------ | ---------------------- | ------ |
| Alerts (`> [!NOTE]`)                 | No                     | Yes    |
| Task lists, strikethrough, autolinks | No                     | Yes    |
| Footnotes                            | No                     | Yes    |
| `<callout>` with markdown children   | `{% callout %}` only   | No     |
| Attributes on a heading              | Yes, `{% %}`           | No     |
| Variables                            | Yes, at transform time | No     |

Neither parser is the one the content is written for. GitHub Flavored Markdown is the
dialect every author already knows, every editor already previews, and every README in
this repository is already written in — and it is the dialect a reader of a `.md` file in
a text editor sees correctly without a renderer.

### What it weighs

```
@markdoc/markdoc bundled      149.2 KB minified / 49.2 KB gzipped
@sdxc/markdown/server total   181.1 KB minified / 59.0 KB gzipped
```

Markdoc is 82% of the server entry. ADR-047 cited that 180 KB figure as the reason YAML
needed its own package; the remainder of it is this.

### The tree has no type

`Markdoc.transform` produces a shape designed for React's `createElement`, in a
repository with no React. `content` is typed `unknown` from the parse boundary through
the payload to the view, and the renderer recovers the shape by testing
`$$mdtype === "Tag"` and coercing attributes one at a time. A first-party AST is a
discriminated union the compiler checks.

### ADR-047 wrote a serializer with no consumer

`@sdxc/yaml`'s `stringify` shipped because a format package owes both halves, and nothing
has called it since. Writing frontmatter back out is its first real caller.

## Decision

`@sdxc/markdown` parses and serializes GitHub Flavored Markdown itself, over a
first-party AST, and Markdoc is removed.

The package has four entry points. The root is the format; each of the others is one
thing you do _with_ a parsed document, named for what it produces:

```ts
// @sdxc/markdown — the format, no rendering runtime
class Markdown {
	private constructor();

	static parse(source, options?): Result<Markdown.Parsed<FM>, MarkdownParseError>;
	static frontmatter(source, options?): Result<Markdown.Frontmatter<FM>, MarkdownParseError>;
	static stringify(document, options?): Result<string, MarkdownStringifyError>;
	static walk<N, V>(node: N, visitor: V): Markdown.Walked<V, N>; // Result, or Promise<Result>
}

// @sdxc/markdown/plain — plain text
toPlainText(node, options?): string;

// @sdxc/markdown/html — static HTML
toHTML(node, options?): string;

// @sdxc/markdown/remix — Remix UI nodes (needs the UI runtime)
toRemix(document, options?): RemixNode;
```

Highlighting is not among them. It is a `Markdown.walk` visitor, and it belongs to
`@sdxc/highlight` — see below.

### The class is a namespace, not an object

`Markdown` is a class with a **private constructor** and only static methods. Nothing is
ever instantiated: `new Markdown()` is a compile error, so the class is a namespace the
compiler enforces rather than a shape someone might try to construct.

It merges with `namespace Markdown`, so one name carries both halves — `Markdown.parse()`
is the method and `Markdown.Document` is the type it returns:

```ts
import { Markdown } from "@sdxc/markdown";

let result = Markdown.parse(source, options); // value
let doc: Markdown.Document = result.data.document; // type
```

`export const Markdown = { parse, stringify }` merges with a type-only namespace too, so
that is not the deciding argument. The class wins on two points: the private constructor
states in the type system that there is nothing to construct, and `@sdxc/sitemap` already
reads its format through the static `Sitemap.parse` and `Sitemap.fetch`, so the shape of
the entry is one a reader here already knows — even though that class also has instances
and this one never does.

The cost is that a bundle calling only `Markdown.parse` still carries `Markdown.stringify`
and the serializer behind it, because the class references every static. ADR-047 declined
an exported `YAML` object for exactly this reason, at 2.9 KB. The trade is different here:
the entry points already keep the parser and the renderer apart,
so everything under `Markdown` is server-side either way, and the weight lands on a Worker
bundle rather than on bytes a reader downloads. Call-site clarity is worth those kilobytes;
client bundles are unaffected.

Only the format lives on `Markdown`: reading a document, writing one, and transforming
one. Everything a consumer does _with_ a document is a free function behind its own
entry point.

For `/remix` that split is load-bearing — putting `toRemix` on the class would drag the
UI runtime into every bundle that parses, undoing the separation the entry points exist
for. `/plain` and `/html` need nothing, and are their own entries for symmetry and for
room to grow: each has options of its own today and will grow more, and none of them
belong on the surface of the format.

`/html` is the renderer for a response that carries markup rather than a component tree —
a feed item, a syndicated body, a page served to a client with no UI runtime. It emits
plain semantic elements and adds a `md-` class only where HTML has no element that says
what the node is: `md-alert` with its kind, `md-code`, `md-table`, `md-task`,
`md-footnotes`, `md-variable`. Styling is the consumer's, through those classes and
through the `id` and `class` an annotation writes, which the renderer passes into the
markup. Raw HTML is escaped here exactly as it is in `/remix`, which is what makes the
output safe to serve for content the renderer did not vet.

It is a separate renderer from the HTML printer the conformance suite carries. That one
follows the specification, where raw HTML passes through untouched; this one follows this
package's own rule, where nothing raw ever becomes markup. Sharing them would mean one of
the two lying about what it is for.

The rule that falls out is worth stating, because the next capability will have to obey
it: `Markdown` is the format, an entry point is named for what it produces, and importing
one is how a bundle pays for what it needs.

### There is no component

`MarkdownView` is removed rather than renamed. It wraps `renderToRemix` in a fragment and
adds nothing else, and every consumer in the repository already composes the rendered
nodes into markup it owns — a heading above, an `<article>` around:

```tsx
import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";

export function PostBody({ props }: Handle<PostBody.Props>) {
	return () => <article>{toRemix(props.markdown)}</article>;
}

export namespace PostBody {
	export interface Props {
		markdown: Markdown.Document;
	}
}
```

Dropping it also settles the naming question it raised. A component named `Markdown` would
collide with the format class — a file importing both entry points gets
`TS2300: Duplicate identifier` — and a component named anything else re-introduces the
`View` suffix in a new spelling. With only `toRemix` exported from `/remix`, a view imports
the type from the root and the renderer from `/remix`, and the two names never meet.

`toRemix` returns nodes from data and holds no props or reactive state, so calling it
inside a render closure is not a component called as a function; it is the same shape as
any other value the closure computes.

### One pass produces both halves

`Markdown.parse` reads the frontmatter block, validates it against the schema, and parses the
remaining body into an AST, in a single traversal of the source:

```ts
let result = Markdown.parse(source, { frontmatter: Frontmatter });
if (isFailure(result)) throw result.error;

let { frontmatter, document } = result.data;
```

`Markdown.frontmatter` takes the same `Options`, reads only the schema from it, and stops
after the block without building the AST. An index page over a hundred posts reads a
hundred titles without parsing a hundred bodies. One options object serves both calls, so
an app hoists it once.

What the frontmatter half yields depends on two things, whether the file opens with a
block and whether the options carry a schema:

| Block   | Schema | `frontmatter` is                                                       |
| ------- | ------ | ---------------------------------------------------------------------- |
| present | yes    | the schema's output, or a failure carrying its issues and the position |
| present | no     | the YAML value as read, typed `unknown`                                |
| absent  | yes    | the schema run against `{}`, so a required field fails at line 1       |
| absent  | no     | `{}`                                                                   |

A block the YAML parser rejects is a failure, not an empty object: the error carries the
YAML error as its `cause` and a position offset into the file, so a stray tab in the
frontmatter names its line. That is the quiet failure the current path has, made loud.

### The AST is plain data

Every node is a plain JSON-serializable object with a `type` discriminator, its own
fields, and a `position`. No classes, no symbols, no `$$mdtype`. That is what lets a
parsed document be cached in KV, sent in a payload, or diffed in a test.

```ts
export namespace Markdown {
	/** 1-based line and column, 0-based offset, all into the source as written, frontmatter included. */
	export interface Point {
		line: number;
		column: number;
		offset: number;
	}

	export interface Position {
		start: Point;
		end: Point;
	}

	/**
	 * Literal values only. `#id` writes `id`, `.a .b` writes `class: "a b"`, a bare key
	 * writes `true`, and `{42}` and `{true}` write the number and the boolean.
	 */
	export type Attributes = Record<string, string | number | boolean>;

	export interface Document {
		type: "document";
		children: Block[];
		position: Position;
	}

	/** Every block carries `attributes`, because an annotation may sit above any block. */
	export interface Heading {
		type: "heading";
		level: 1 | 2 | 3 | 4 | 5 | 6;
		attributes: Attributes;
		children: Inline[];
		position: Position;
	}

	/** Fenced or indented. Indented code has no `language` and empty `attributes`. */
	export interface Code {
		type: "code";
		language?: string;
		content: string;
		attributes: Attributes;
		position: Position;
	}

	export interface InlineCode {
		type: "inlineCode";
		value: string;
		position: Position;
	}

	export interface Table {
		type: "table";
		align: Array<"left" | "center" | "right" | null>;
		attributes: Attributes;
		children: TableRow[];
		position: Position;
	}

	export interface Tag {
		type: "tag";
		name: string;
		attributes: Attributes;
		/** Parsed as markdown, so a tag's children are nodes, not a string. */
		children: Block[] | Inline[];
		position: Position;
	}

	export interface Alert {
		type: "alert";
		kind: "note" | "tip" | "important" | "warning" | "caution";
		attributes: Attributes;
		children: Block[];
		position: Position;
	}

	export type Node = Document | Block | Inline;
	export type Parent = Extract<Node, { children: unknown[] }>;
}
```

The full union. `document` is the root and belongs to neither column, so a `Block[]` can
never hold a nested document:

| Blocks                                                                                                                                               | Inline                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `heading` `paragraph` `code` `list` `listItem` `blockquote` `alert` `table` `tableRow` `tableCell` `thematicBreak` `html` `footnoteDefinition` `tag` | `text` `emphasis` `strong` `strikethrough` `inlineCode` `link` `image` `softBreak` `hardBreak` `inlineHtml` `footnoteReference` `variable` `tag` |

Every `type` names exactly one interface. Code spans are `inlineCode` and inline HTML is
`inlineHtml`, so `Extract<Node, { type: K }>` always narrows to one shape — which is what
makes a visitor handler's argument typed without a second `switch`. The one name in both
columns is `tag`, and it is one interface: a tag is block-level or inline depending on
where it is written, and its `children` say which.

Two node types for one construct is a cost, so there is one block `code` node for fenced
and indented code alike, and there is no `autolink`: `<https://example.com>` and a bare
URL both parse to a `link` whose text equals its `href`, which is also how the serializer
knows to write one back in angle brackets.

Two CommonMark constructs exist in the source and not in the tree. A link reference
definition is consumed at parse time and every reference to it becomes a `link`, so a
document serializes back with inline links. Footnotes keep both halves — a
`footnoteDefinition` block and a `footnoteReference` inline — because a renderer draws
them in two places, and `toRemix` collects the definitions into a trailing list on a
second pass.

The AST is closed to the parser and open to visitors. A package that attaches data to a
node declares the field itself, through the namespace the class already merges with:

```ts
declare module "@sdxc/markdown" {
	namespace Markdown {
		interface Code {
			tokens?: Token[];
		}
	}
}
```

`@sdxc/markdown` never sees that type, and `Markdown.stringify` never writes it: the
serializer emits only the fields the parser produces, so anything a visitor attaches is
derived data that survives a round trip through the document and not through the text.

### `Markdown.walk` is the only transform mechanism

There is no `transform` stage and no plugin config. Everything that changes a parsed
document — highlighting, variable resolution, link rewriting, section stripping —
is a `Markdown.walk`, and it never mutates:

```ts
Markdown.walk<N extends Markdown.Node, V extends Markdown.Visitor>(node: N, visitor: V): Markdown.Walked<V, N>;
```

#### The visitor is an object, not a function

It is a plain object with one **optional** handler per node type, keyed by the type's
name. What a handler may return is typed by the category of the node it handles, so a
`paragraph` handler cannot splice inline nodes into a block slot:

```ts
export namespace Markdown {
	/** The category a node of type `K` belongs to; `tag` belongs to both. */
	type Category<K extends Node["type"]> =
		| (K extends Block["type"] ? Block : never)
		| (K extends Inline["type"] ? Inline : never)
		| (K extends "document" ? Document : never);

	export type Visited<K extends Node["type"]> = Category<K> | Category<K>[] | null | undefined;

	export type Visitor = {
		[K in Node["type"]]?: (
			node: Extract<Node, { type: K }>,
			parent: Parent | null,
		) => Visited<K> | Promise<Visited<K>>;
	};

	/** A `Result` when no handler can return a promise; a `Promise` of one otherwise. */
	export type Walked<V extends Visitor, N extends Node = Document> = [
		Extract<ReturnType<NonNullable<V[keyof V]>>, Promise<unknown>>,
	] extends [never]
		? Result<N, MarkdownWalkError>
		: Promise<Result<N, MarkdownWalkError>>;
}
```

A node whose type has no handler is passed through untouched, so a visitor names only the
types it cares about. What a handler returns decides what happens to that node:

| Returns                       | Effect                                        |
| ----------------------------- | --------------------------------------------- |
| a node                        | replaces the node                             |
| an array of nodes             | splices them in its place                     |
| `null`                        | removes the node                              |
| nothing                       | leaves the node alone, children still visited |
| a promise of any of the above | makes the whole walk asynchronous             |

The walk is top-down: a handler sees a node before its children, and the children of
whatever it returned are walked next. **No handler runs on a replacement node itself** —
neither the one that produced it nor another in the same visitor — only on its children.
So a `code` handler returning a `code` terminates rather than looping, a `variable`
handler's `text` is not handed to a `text` handler in the same walk, and a removed node's
children are not visited at all.

The root is exempt from removal and splicing. A handler on the node the walk started from
may return a replacement of the same category or nothing; `null` or an array there is a
`MarkdownWalkError`, because a walk over a document has to hand back a document. The
return type is generic on the input, so walking a `heading` gives back a `heading`.

Subtrees no handler touched are reused by reference, so a walk that changes one heading
copies one spine and nothing else.

Keying by type rather than taking one function over every node is what makes the handler's
argument typed: inside `link(node)`, `node.href` exists and the compiler knows it, with no
narrowing to write.

Being an object also makes a visitor a **value** — it can be named, exported from another
package, and merged. That is the whole mechanism behind the highlighter's `highlight`:

```ts
// @sdxc/highlight/markdown
export const highlight = {
	code(node) {
		let language = normalizeLanguage(node.language ?? "plain");
		return { ...node, language, tokens: tokenize(node.content, language) };
	},
} satisfies Markdown.Visitor;
```

```ts
// `anchors` is another visitor — the consumer's own, or another package's.
Markdown.walk(document, { ...highlight, ...anchors });
```

An exported visitor is declared with `satisfies`, never with a type annotation. `const
highlight: Markdown.Visitor = …` would widen every handler's return type to the full
`Visited<K> | Promise<Visited<K>>`, and `Walked` would then read the walk as asynchronous.
`satisfies` checks the shape and keeps the literal's own return types, which is what the
sync-or-async decision below reads.

#### A visitor that throws is a failure, not an exception

A handler is arbitrary code — it resolves a name, parses a URL, reads a token map — and
any of that can throw. The walk catches it and answers with a `Result`, the way every
other entry point in the repository does, so a caller handles a bad document the same way
whether the parser rejected it or a visitor did.

`MarkdownWalkError` carries the thrown value as its `cause` and the `position` of the node
being visited, which is the part a bare `throw` loses: the failure names the line the
visitor was standing on.

The trade is that a bug in a handler — a `TypeError` on a field that was never there —
arrives on the same branch as a document the handler rejected on purpose. A caller that
discards failures wholesale, `if (isFailure(result)) return null`, discards its own bugs
with them. The cause is always the original value, so a caller that throws on an
unfamiliar `cause` and handles a familiar one keeps both.

#### A visitor may be asynchronous

A handler can return a promise, and then the walk returns one. The promise wraps the
`Result`, so awaiting gives back the same shape a synchronous walk returns directly:

```ts
let painted = Markdown.walk(doc, highlight); // Result<Document, …>
let enriched = await Markdown.walk(doc, {
	async link(node) {
		return { ...node, title: await fetchTitle(node.href) };
	},
}); // Result<Document, …>
```

A rejected promise is caught exactly as a throw is, so an async handler reports its
failure through the same `Result` rather than past it.

`unwrap` from `@sdxc/result` already overloads on `Result` and `Promise<Result>`, so
`unwrap(Markdown.walk(doc, visitor))` reads the same either way and the async case needs
one `await` at the front.

The decision is made twice, by the same information. At the type level `Walked<V>` reads
the visitor's handler return types: if any includes a promise the walk is typed
asynchronous, otherwise synchronous, so a highlighting pass inside a render path is never
awaited. At run time the walk starts synchronously and switches to a promise chain the
moment a handler returns a thenable, finishing the traversal inside it. The two agree as
long as the visitor's types are honest; a handler typed synchronous that returns a promise
through an `any` hands the caller a promise typed as a `Result`, which is the ordinary
hazard of `any` and not one the walk can close.

That is what keeps a highlighting pass usable inside a render path while a pass that
fetches link titles, reads image dimensions, or resolves a transclusion from KV is
possible at all.

One mechanism either way. Without it the choice is a second `walkAsync` beside the first,
or making every caller await a pass that never waits for anything.

### Annotations decorate, tags create

Two syntaxes, because they do two different things.

An **annotation** attaches attributes to a block that already exists. It is
`{% key="value" %}`, it supports `#id` and `.class` shorthands, and it goes on the same
line for blocks with a single-line opener — a heading, a fence — and on its own line above
for the rest. A blank line between the annotation and its block is allowed, because
`vp fmt` inserts one. Every block carries `attributes`, so any block can be annotated; an
annotation with no block after it is a parse error at its own line, and two annotations
above one block merge, the lower one winning a repeated key.

The same delimiters carry one more thing: `{% $name %}` is a **variable**, described
below. The `$` is what tells the two apart at the first character inside the braces — an
annotation's contents are attributes, and a bare `wide` there is the boolean attribute
`wide`, so a variable needs a mark no attribute can start with.

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

Attribute values are literals — `key="string"`, `key={42}`, `key={true}`, and a bare
`key` for `true` — in annotations and tags alike. A variable is never an attribute value,
because a tag's attribute schema runs at parse time and a value that is not yet known
cannot be validated then; keeping variables in text keeps validation where the position is.

A **tag** creates a node that has no markdown syntax. It is written as an element,
because that is the syntax the content already reaches for and the one an author reading
the raw file understands:

```md
<callout type="warning">
**Heads up** — a tag's children are parsed as Markdown, so this is a `strong` node.
</callout>

Press <kbd>Cmd</kbd> then <kbd>K</kbd> to search.

<video src="/demo.mp4" autoplay />
```

Only **registered** names become tags. An unregistered `<div>` stays raw HTML under
CommonMark's own HTML block and inline HTML rules, exactly as GitHub treats it, so the
departure from CommonMark is scoped to names the app opted into. Registering a tag declares
its attribute schema, which is what makes a bad attribute a parse error with a line number
instead of a rendering surprise:

```ts
const options = {
	frontmatter: Frontmatter,
	tags: {
		callout: { attributes: s.object({ type: s.picklist(["info", "warning"]) }) },
		kbd: { content: "inline" },
		video: { content: "none", attributes: s.object({ src: s.string() }) },
	},
} satisfies Markdown.Options;
```

#### A tag declares what it contains, and nothing else

`content` is one field with three values, not a pair of `inline` and `void` booleans:

| `content`            | The tag's children                                 | Example     |
| -------------------- | -------------------------------------------------- | ----------- |
| `"blocks"` (default) | parsed as block markdown — paragraphs, lists, tags | `<callout>` |
| `"inline"`           | parsed as inline markdown only                     | `<kbd>`     |
| `"none"`             | none; the tag is written self-closing              | `<video />` |

Two booleans would offer four states to describe three, and leave `{ inline: false, void:
false }` and `{ inline: true, void: true }` to be read as a pair before either means
anything. One field names the parser's behaviour directly, and each value is the answer to
the only question the parser has to ask before it reads what follows the opening tag.

Placement is not declared, because the source decides it, by the rules below.

#### How a tag is read

This is the one place the dialect leaves CommonMark, so it gets the same treatment the
spec gives an HTML block: rules with examples, each of which is a test.

1. **A registered opening tag alone on its line opens a block tag.** Whitespace around it
   is allowed; anything else on the line, and the tag is inline. This is CommonMark's own
   rule for an HTML block of type 7, applied to a registered name.

   ```md
   <callout type="info">
   A block tag: its children are blocks.
   </callout>

   A paragraph with <callout type="info">an inline callout</callout> in it.
   ```

   The first `callout` is a block whose children are one paragraph. The second is an
   inline tag whose children are inline nodes, and its `content` is `"blocks"`, so it is
   a parse error naming the line: a tag whose children are blocks has nowhere to put them
   inside a line. An `"inline"` tag written alone on a line is a block-level tag whose
   children parse as inline — `<kbd>Cmd</kbd>` on its own line is not wrapped in a
   paragraph.

2. **A block tag is a container block, like a block quote.** Its children run to a
   closing tag alone on its line at the same container level. Inside a list item or a
   block quote every child line carries the container's prefix, and so does the closing
   line:

   ```md
   > <callout type="note">
   > Quoted, and inside the quote.
   > </callout>
   ```

   The closer's position is found after block structure is known, which settles the
   hard cases without a special rule for each. A fenced code block inside the tag is
   opaque, so a `</callout>` written in it is code, not a closer. Tags nest by name, so
   an inner `<callout>` claims the first `</callout>` and the outer keeps the second.

3. **An inline tag closes in the same paragraph.** `<kbd>Cmd</kbd>` opens and closes
   within a line or across soft breaks of one paragraph; a paragraph ending with an
   inline tag still open is a parse error at the opener.

4. **The written form has to agree with `content`.** A `"none"` tag is written
   self-closing, `<video … />`; the same name written with a closing tag is a parse error
   at the opener. A `"blocks"` or `"inline"` tag written self-closing yields the tag with
   no children, which is legal and occasionally useful.

5. **An unclosed block tag is a parse error at its opener.** Reaching the end of the
   file, or the end of the enclosing container, with a tag still open never silently
   swallows the rest of the document as its children.

6. **Attributes read like JSX, and are validated before the children are parsed.**
   `key="string"`, `key={42}`, `key={true}`, and a bare `key` for `true`. The declared
   schema runs on the opening tag, so a bad attribute is reported at the opener even when
   the children are long.

Inside a tag's children, markdown parses normally — which is the whole point, and the one
place this dialect deliberately leaves CommonMark, where an HTML block swallows its
content as text.

### Variables are a visitor, not a feature

`{% $name %}` in text parses to a `variable` node carrying that name. The name is a
letter or underscore followed by letters, digits, or underscores; whitespace inside the
braces is free. It is always inline — alone on its own line it is a paragraph holding one
variable, never an annotation — and inside a code span or a fence nothing is a variable.
A bare `$` anywhere is prose, so `$5/month` and `US$100` need no thought and no escape.
Parsing stops there: nothing is substituted, so one parsed document serves every render,
and resolution is a `Markdown.walk` the caller writes.

The delimiters are the ones Markdoc authors already write for a variable, which is the
syntax this content was nominally written in until now, and they make a variable
impossible to read as anything else: `{%` never begins prose, so a reader of the raw file
sees a hole where a value will go.

There is no variables option anywhere in the package. The values are the caller's own
object, and the visitor is how they meet the document:

```ts
// Whatever the caller already has — a row, a config, a translation map.
let variables: Record<string, string | number> = { product: "Uptime", plan: team.plan };

let result = Markdown.walk(parsed.document, {
	variable(node) {
		let value = variables[node.name];
		if (value === undefined) return; // leave it, and let the caller decide
		return { type: "text", value: String(value), position: node.position };
	},
});
```

A caller who wants an unresolved name to be fatal throws from the handler instead, and the
walk turns it into the failure branch with the node's position attached:

```ts
let result = Markdown.walk(parsed.document, {
	variable(node) {
		if (!(node.name in variables)) throw new Error(`Unresolved variable ${node.name}`);
		return { type: "text", value: String(variables[node.name]), position: node.position };
	},
});

if (isFailure(result)) throw result.error; // names the variable and the line it sits on
```

The package supplies the node type and the traversal; what a variable _means_ is the
consumer's. Documentation should fail loudly on an unresolved name, a marketing page
should probably render the literal, and a preview should show the name itself — one
policy baked into the package would be wrong for two of the three.

Because variables survive parsing, `Markdown.stringify` round-trips them and a cached
document can be rendered per tenant, per locale, or per plan from one parse.

### Highlighting belongs to the highlighter

```ts
import { Markdown } from "@sdxc/markdown";
import { highlight } from "@sdxc/highlight/markdown";

let result = Markdown.walk(parsed.document, highlight);
```

`highlight` is the visitor shown above — an object with one `code` handler, returning the
node with `tokens` attached. It ships from `@sdxc/highlight`, not from this package, and so
does the `tokens` field: the highlighter declares it on `Markdown.Code` through the module
augmentation shown earlier, so `@sdxc/markdown` has no highlighting entry point, no
dependency on the highlighter, and no field in its own source that knows fences can be
painted. An indented code block reaches the handler with no `language`, and is painted as
plain.

The arrow was always this way round. `@sdxc/highlight` exports a Markdoc node schema from
`@sdxc/highlight/markdoc` today, because Markdoc is the parser it adapts to; it will export
a walk visitor from `@sdxc/highlight/markdown` instead, because this is. The migration is a
rename and a change of shape, and this package loses a dependency rather than gaining an
entry point.

That also makes `Markdown.walk` a real extension point rather than a private mechanism. A
visitor is a value another package can export, and visitors merge by spread, so a consumer
runs one pass instead of three:

```ts
let result = Markdown.walk(parsed.document, {
	...highlight,
	link(node) {
		return { ...node, href: canonical(node.href) };
	},
});
```

`Markdown.stringify` ignores `tokens` because it emits only what the parser produces, and
the code block still carries its `content`, so a highlighted document serializes back to
the markdown it came from.

### GitHub Flavored Markdown is the baseline

If GitHub renders it in a `.md` file, this parses it: everything in CommonMark, plus the
GFM spec's tables, task lists, strikethrough, and literal autolinks, plus two of GitHub's
documented extensions — alerts and footnotes.

Alerts are a node, not a styled block quote, so a renderer can draw one without pattern
matching on its first line:

```md
> [!WARNING]
> Deleting a monitor also deletes its history.
```

Three GitHub behaviours are deliberately not the parser's:

- **Math.** The census has zero `$…$` spans, and GitHub's delimiter rules — no space
  after the opener, none before the closer, no digit after it — are a second inline
  grammar over the most common currency character in prose. A visitor over `text` nodes
  can add it for content that wants it.
- **Emoji shortcodes.** GitHub replaces only names it knows, so parsing `:tada:` means
  shipping the table of roughly eighteen hundred names, which is the weight this ADR
  exists to remove. A visitor over `text` nodes from another package can add them.
- **Heading anchors.** GitHub derives an `id` from the heading text at render time. That is
  a renderer's or a visitor's decision — the table of contents in the usage below slugifies
  in the caller — so the parser attaches only the `id` an annotation writes.

Raw HTML is parsed as CommonMark says — an `html` block or an `inlineHtml` node holding
the source text — and `toRemix` renders both **as text**, escaped, so a stray `<div>` shows
as written rather than becoming an element. That makes GFM's tagfilter, which is a
render-time rule about `<script>` and friends, unnecessary here: nothing raw ever becomes
markup. `Markdown.stringify` writes both back verbatim.

### The parser follows the reference strategy

First-party does not mean novel. The parser takes the two-phase strategy the CommonMark
specification describes in its appendix: block structure first, line by line, opening and
closing container blocks and collecting the lines of each leaf; then inline parsing over
each leaf's text with the delimiter stack for emphasis, links, and code spans. Every
hand-written markdown parser is wrong first at emphasis delimiter runs, link destinations,
backtick spans, and list continuation, and every one of those has a published algorithm
in that appendix and a few hundred examples in the spec that check it.

A block tag is a container block in the first phase, which is what gives rules 2 and 5
above for free: fences inside it are opaque because fences are leaves the first phase
already closed, and nesting by name is the container stack doing what it does for block
quotes.

### The round trip is the contract

`Markdown.stringify` normalizes. It does not reproduce the source byte for byte, because doing so
means storing the bullet character, the indent width, the fence character and length, `*`
against `_`, ATX against setext, and the author's line wrapping — a concrete syntax tree,
not an AST, at twice the node shapes for a guarantee nothing here needs.

What holds instead is idempotency:

```ts
Markdown.stringify(Markdown.parse(Markdown.stringify(Markdown.parse(src)))) ===
	Markdown.stringify(Markdown.parse(src));
```

The property has to hold for a **transformed** document too, not only a parsed one, and
that is where the serializer earns its keep: a `text` node is whatever a visitor put in
it. So the serializer escapes, in text, every character that would otherwise begin a
construct — CommonMark's set, `*` `_` `` ` `` `[` `]` `\` and the line-leading `#`, `>`,
`+`, `-`, `=`, and `digit.`, plus `|` inside a table cell — and the two this dialect
adds: `{%` and `<`. Escaping `<` unconditionally is what lets the serializer know nothing
about which tag names are registered, and escaping `{%` covers annotations and variables
at once. A variable resolved to the text `{% $9 %}` writes as `\{% $9 %}`, and a text
node holding `<callout>` writes as `\<callout>`, so the next parse reads the same tree.

Two normalizers never agree by accident, and the repository already has one: `vp fmt`
formats every content file. So the serializer's output is a fixed point of the formatter,
and that is a test, not a claim — formatting `Markdown.stringify(Markdown.parse(file))`
for each of the thirty-six files changes nothing. A file written back through this package
and then formatted by the repository stays written.

Given `{ frontmatter }`, `Markdown.stringify` writes the block through `@sdxc/yaml`'s
`stringify` and prepends it, so a document read, transformed, and written back comes out
whole. That branch is the only one that can fail — a frontmatter value YAML cannot write —
and it is why the method returns a `Result`; a document alone always serializes.

### The suite lands first

The present safety net is twenty-eight tests, twenty-one of them for `toPlainText`. The
engine cannot be swapped under that, so the parser lands behind these, in this order, and
no consumer moves until the fourth is green:

1. **Conformance.** The CommonMark spec's `spec.json` and the GFM spec's examples, vendored
   under `docs/vendor`, run as one table-driven test. The examples compare HTML, so the
   test suite carries a small HTML printer over the AST that exists for this purpose and
   is never exported. The pass count is asserted, so it can only go up.
2. **Pathological inputs.** The CommonMark repository's list of inputs that make careless
   parsers quadratic — nested brackets, unclosed emphasis runs, backtick strings — with a
   time bound on each.
3. **The dialect.** Every numbered rule above and every example in this document is a
   test, including the failure positions.
4. **The corpus.** The current pipeline's rendered output for the thirty-six content files
   is snapshotted before any consumer changes. The new pipeline renders the same files
   through `toRemix` and the snapshots are diffed; a difference is either a bug or an
   intended gain, and either is written down. The same files run the idempotency property
   and the formatter fixed point.
5. **Weight.** The built root entry has a size budget asserted in CI, measured the way the
   numbers in the Context were. The estimate here was 45 KB, against a guess that a parser,
   a serializer and a walker of this scope land between 30 and 60 KB. Measured, the entry
   is **66.2 KB minified / 20.8 KB gzipped**, so the budget is set at 66 KB — a ratchet just
   above what shipped rather than a target to grow into. Roughly two thirds of it is the
   block and inline phases; the rest is the serializer, the walk, and the YAML reader and
   writer the class's statics keep reachable. The saving below is net of the real figure.

### Out of scope

- **Repository-context autolinking.** `@mention`, `#123`, and bare commit SHAs need a
  repository to resolve against. An app that wants them adds a `Markdown.walk` over `text` nodes;
  the parser does not guess.
- **Rendering a fence's language.** A `mermaid` or `geojson` fence parses as a code block
  with that language. Drawing it is the renderer's job, through `components`.
- **Markdoc's template language.** Functions, conditionals, partials, and slots. No
  consumer has ever used one, and `Markdown.walk` covers the cases that motivated them.
- **Math, emoji shortcodes, and derived heading anchors.** See the baseline above.
- **A concrete syntax tree.** See the round trip above.

## Usage

### Parse a document and render it

The whole path, replacing what the docs controller does today:

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

export default createAction(routes.docs.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

	let result = Markdown.parse(await readDoc(slug), { frontmatter: Frontmatter });
	if (isFailure(result)) throw result.error;

	let { frontmatter, document } = result.data;

	let highlighted = Markdown.walk(document, highlight);
	if (isFailure(highlighted)) throw highlighted.error;

	return ctx.render(<DocView title={frontmatter.title} document={highlighted.data} />);
});
```

The view receives a typed document rather than `unknown`:

```tsx
import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";

export default function DocView({ props }: Handle<DocView.Props>) {
	return () => (
		<article>
			<h1>{props.title}</h1>
			{toRemix(props.document)}
		</article>
	);
}
```

### Read the frontmatter of a hundred posts without parsing a hundred bodies

```ts
import { Markdown } from "@sdxc/markdown";

const options = { frontmatter: Frontmatter } satisfies Markdown.Options;

let entries = await Promise.all(
	slugs.map(async (slug) => {
		let result = Markdown.frontmatter(await readDoc(slug), options);
		if (isFailure(result)) throw result.error; // a bad file is a build error, not a missing post
		return { slug, ...result.data.frontmatter };
	}),
);
```

### Write a document back, frontmatter and all

Reading, changing one field, and serializing — the round trip ADR-047's serializer was
waiting for:

```ts
import { Markdown } from "@sdxc/markdown";
import { isFailure, unwrap } from "@sdxc/result";

let { frontmatter, document } = unwrap(Markdown.parse(source, { frontmatter: Frontmatter }));

let written = Markdown.stringify(document, {
	frontmatter: { ...frontmatter, lastUpdated: new Date() },
});
if (isFailure(written)) throw written.error;

await writeDoc(slug, written.data);
```

Omitting `frontmatter` writes the body alone, which is what a route serving content to an
agent wants.

### Transform a document without mutating it

`Markdown.walk` returns a new document and shares every subtree it did not touch. Rewriting
relative links to absolute ones before serving markdown to an agent:

```ts
import { Markdown } from "@sdxc/markdown";
import { isFailure, unwrap } from "@sdxc/result";

let absolute = Markdown.walk(document, {
	link(node) {
		if (!node.href.startsWith("/")) return;
		return { ...node, href: new URL(node.href, origin).href };
	},
	image(node) {
		return { ...node, src: new URL(node.src, origin).href };
	},
});
if (isFailure(absolute)) throw absolute.error; // a malformed href, named by line

return new Response(unwrap(Markdown.stringify(absolute.data)), {
	headers: { "content-type": "text/markdown; charset=utf-8" },
});
```

Returning nothing from a handler leaves the node alone; `document` is unchanged
throughout, so the HTML response can render the original in the same request.

### Remove nodes, and splice several in for one

Returning `null` removes a node, and returning an array replaces one node with many:

```ts
// Strip every code block from the copy an excerpt is built from.
let prose = unwrap(Markdown.walk(document, { code: () => null }));

// Turn each thematic break into a labelled divider a status page draws.
let sectioned = unwrap(
	Markdown.walk(document, {
		thematicBreak(node) {
			return [
				{ type: "tag", name: "divider", attributes: {}, children: [], position: node.position },
			];
		},
	}),
);
```

### Read the tree without transforming it

A handler that returns nothing changes nothing, which makes `Markdown.walk` a traversal as
well. Its `Result` carries the document back unchanged, so a read-only walk can discard
it:

```ts
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

`toPlainText` accepts any node, not only a document, which is what makes it useful inside a
visitor.

### Custom tags, end to end

Declare the tags where the document is parsed:

```ts
export const options = {
	frontmatter: Frontmatter,
	tags: {
		callout: { attributes: s.object({ type: s.picklist(["info", "warning", "danger"]) }) },
		kbd: { content: "inline" },
		video: {
			content: "none",
			attributes: s.object({ src: s.string(), poster: s.optional(s.string()) }),
		},
	},
} satisfies Markdown.Options;
```

Write them in the content:

```md
<callout type="warning">
Deleting a monitor also deletes its **history**. This cannot be undone.
</callout>

Press <kbd>Cmd</kbd> then <kbd>K</kbd> to open search.

<video src="/demo/flow-monitors.mp4" poster="/demo/flow-monitors.jpg" />
```

Supply the components where the document is rendered:

```tsx
function Callout({ props }: Handle<{ type: string; children: RemixNode }>) {
	return () => (
		<aside mix={css({ borderLeft: "3px solid", padding: "0.75rem 1rem" })} data-type={props.type}>
			{props.children}
		</aside>
	);
}

toRemix(document, { components: { callout: Callout, kbd: Kbd, video: Video } });
```

`**history**` inside the callout arrives as a `strong` node, so it renders as
`<strong>history</strong>` nested inside whatever `Callout` draws. A tag's children are
markdown all the way down, including other tags. A tag with no component renders its
children and nothing else, so a missing component drops the chrome and keeps the content.

### Variables, resolved per render

One parse, many renders. The status page documentation is written once and resolved per
tenant:

```md
# Status page for {% $team %}

Your page is live at {% $domain %}. Visitors on the **{% $plan %}** plan see
{% $retention %} of history.

<callout type="info">
Upgrade to raise the limit above {% $limit %} monitors.
</callout>
```

```ts
import { Markdown } from "@sdxc/markdown";

const variables: Record<string, string | number> = {
	team: team.name,
	domain: team.statusPageDomain,
	plan: team.plan,
	retention: formatDuration(team.retention),
	limit: team.monitorLimit,
};

let document = Markdown.walk(cachedDocument, {
	variable(node) {
		let value = variables[node.name];
		if (value === undefined) throw new Error(`Unresolved variable ${node.name}`);
		return { type: "text", value: String(value), position: node.position };
	},
});
if (isFailure(document)) throw document.error;

return ctx.render(<DocView document={document.data} />);
```

The parsed document goes in the cache once; the variables change every request. A
document that still carries `variable` nodes serializes back with `{% $team %}` intact, so the
markdown an agent fetches is the template, not one tenant's copy.

### GitHub alerts

```md
> [!NOTE]
> Cron monitors bill per check, not per minute.

> [!WARNING]
> Rotating an API key invalidates every client using it.
```

They parse to an `alert` node carrying `kind`, so the renderer draws them without
inspecting the first line of a block quote, and a custom component can take them over:

```tsx
toRemix(document, { components: { alert: Alert } });
```

### Plain text, for excerpts and search

```ts
import { toPlainText } from "@sdxc/markdown/plain";
import { excerpt, wordCount } from "@sdxc/strings";

let text = toPlainText(document);
let summary = excerpt(text, { length: 200 });
let minutes = Math.ceil(wordCount(text) / 200);

// The search index wants the code too.
let indexed = toPlainText(document, { code: true });
```

It takes the AST rather than a source string, so a caller that has already parsed does
not parse twice, and a caller that walked the tree first measures what it actually
renders.

### One document, two renderers

The AST is the contract, so an email renders the same parsed document the page does:

```ts
let { document } = unwrap(Markdown.parse(body, { frontmatter: Frontmatter }));
let highlighted = unwrap(Markdown.walk(document, highlight));

let page = toRemix(highlighted); // @sdxc/markdown/remix
let email = <Markdown document={highlighted} />; // @sdxc/mail/markdown
```

`@sdxc/mail`'s markdown component takes a source string today and parses it itself,
because handing it a Markdoc tree would still make the caller depend on the parser that
produced it. A plain-data AST with a public type dissolves that reason: the component
takes a `Markdown.Document`, stops importing Markdoc and the parser both, and switches its
tag-name checks for a `switch` on `node.type` the compiler can prove exhaustive.

### Lint content in CI

Parsing returns positions, so a check reads like a test:

```ts
let problems: string[] = [];

Markdown.walk(document, {
	heading(node) {
		if (node.level > 3) problems.push(`${file}:${node.position.start.line} heading too deep`);
	},
	link(node) {
		if (node.href.startsWith("http://"))
			problems.push(`${file}:${node.position.start.line} insecure link`);
	},
	code(node) {
		if (node.language === undefined)
			problems.push(`${file}:${node.position.start.line} code block without a language`);
	},
});
```

### What each consumer changes

| Consumer             | Change                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/uptime` docs   | `new Markdown(...).parse(source)` becomes `Markdown.parse(source, options)`; highlight with `Markdown.walk(doc, highlight)`        |
| `apps/blog` posts    | Same, plus `<MarkdownView>` becomes `toRemix`, and `content: unknown` becomes `document: Markdown.Document`                        |
| `apps/blog` MCP page | One `Markdown.parse` instead of `parse` plus `Markdown.frontmatter`; `Markdown.stringify` for the markdown response                |
| `apps/books` sample  | Same as uptime                                                                                                                     |
| `@sdxc/blog-engine`  | `parseMarkdown` returns a typed document instead of `unknown`                                                                      |
| `@sdxc/highlight`    | `src/markdoc.ts` becomes `src/markdown.ts`: the Markdoc node schema becomes the `highlight` visitor plus the `tokens` augmentation |
| `@sdxc/mail`         | The markdown component takes a `Markdown.Document` instead of a source string; drops Markdoc and the parser                        |

The MCP page is the clearest gain: it parses the frontmatter twice today, once through
`parse` and once through the old `Markdown.frontmatter`, because the parser returns a tree but
not the body it came from.

### Landing order

All three packages are private, so every consumer can move in one change without breaking
anyone outside the repository. The order still matters for bisecting:

1. The parser, serializer, and walk, with the suite above green and the corpus snapshots
   recorded from the current pipeline.
2. `@sdxc/highlight/markdown`, the visitor and the augmentation, beside the Markdoc entry
   it will replace.
3. `@sdxc/markdown/remix` and `/plain` over the new tree, diffed against the snapshots.
4. The four apps and `@sdxc/blog-engine`.
5. `@sdxc/mail`, then the Markdoc entry of the highlighter, then the dependency itself.

## Consequences

### Positive

- The format entry weighs 66.2 KB minified / 20.8 KB gzipped where the server entry it
  replaces weighed 181.1 KB / 59.0 KB, a saving of **114.9 KB minified and 38.2 KB
  gzipped**, asserted in CI rather than estimated. The parser came in above the 45 KB this
  document guessed at, and still well under what it removed.
- `content: unknown` becomes `document: Markdown.Document`, checked from the parse
  boundary through the payload to the view. The renderer's `$$mdtype` sniffing and
  attribute coercion go away.
- The content gains the dialect its authors already write: alerts, task lists,
  strikethrough, footnotes, autolinks, and the rest of GitHub's markdown.
- Documents become writable. Content can be normalized on save, rewritten for an agent,
  or generated — none of which was possible with a parse-only dependency.
- One mechanism, `Markdown.walk`, covers highlighting, variables, link rewriting, linting,
  and table of contents extraction, replacing a config-driven `transform` stage.
- A visitor may be asynchronous, so a pass can fetch link titles, read image dimensions, or
  resolve a transclusion from KV. A synchronous visitor still returns a document directly,
  so nothing that does not wait has to be awaited.
- Parse errors carry positions, so a bad annotation, an unclosed tag, or an unreadable
  frontmatter block names a line instead of failing quietly the way the current
  frontmatter path does.
- `@sdxc/mail` renders a document it did not have to parse, and stops depending on any
  parser at all.
- `@sdxc/yaml`'s `stringify` gets its first caller, closing ADR-047.

### Negative

- A markdown parser is the largest parser in the repository. Emphasis delimiter runs,
  link destinations, backtick spans, and list continuation are where hand-written
  markdown parsers are wrong, and following the reference strategy and passing the spec
  examples is the mitigation, not a guarantee.
- The suite has to land before the parser does, and the conformance and corpus tests are
  most of the work of the change.
- `<tag>` children parsing as markdown departs from CommonMark. It is scoped to
  registered names, but a document is no longer portable to a renderer that does not know
  the tag.
- Every consumer changes at once. The AST is the public shape and there is no adapter
  that makes the old tree and the new one interchangeable.
- A bug thrown inside a visitor arrives as a `Result` failure, so a caller that discards
  failures discards bugs; the `cause` is preserved for the caller that looks.

### Neutral

- The fence annotation stays `{% path="…" title="…" %}`, so existing content and both
  package READMEs are unaffected.
- `Markdown.stringify` normalizes rather than preserving the source, so a file written back
  can differ from the file read. Its output is a fixed point of `vp fmt`, tested over the
  corpus, so a written file stays put under the repository's own formatting.
- `@sdxc/markdown` no longer depends on `@sdxc/highlight` at all. Highlighting becomes a
  visitor the highlighter ships, plus a field it declares on the code node through module
  augmentation, which makes `Markdown.walk` and the merged namespace published extension
  points rather than internal mechanisms.
- `MarkdownView` goes away with no replacement component. Views call `toRemix` and own the
  markup around it, which is what every consumer already does.
- The `Markdown` class stays, but stops being instantiated: its constructor becomes private
  and every operation becomes static. Per-app configuration moves from a constructor
  argument to an options object the app hoists to module scope, so it is data rather than
  an instance.
- Raw HTML in content renders as visible text. The corpus has none, and an author who
  wants an element registers a tag for it.

## Alternatives Considered

### 1. Keep Markdoc

Rejected. It costs 149 KB to supply a template language no consumer uses, produces a
React-shaped tree in a repository with no React, cannot write markdown back, and does not
parse the GitHub dialect the content is written in. The three functions actually called
are the three functions a first-party parser would expose anyway.

### 2. Keep `{% tag %}` for custom tags

Rejected. `{% callout %}…{% /callout %}` reads as a template directive and its closing
form is easy to get wrong; `<callout>…</callout>` is the syntax authors already write,
and it is what an unregistered name falls back to. Annotations keep `{% %}` because they
decorate a node rather than create one, and the split is the distinction the two
syntaxes are teaching.

### 3. Resolve variables at parse time

Rejected. It collapses parse and render into one step, so a cached document belongs to
one tenant, and `Markdown.stringify` can no longer produce the template it came from.
Resolving in a `Markdown.walk` keeps one parse serving every render, and keeps the policy
for an unresolved name with the caller who knows what it should mean.

### 4. A mutating `Markdown.walk`

Rejected. A visitor that edits in place makes a cached document unsafe to share across
requests, which is exactly what a cached parsed document is for. Structural sharing makes
the immutable form cost about what the mutating one would.

### 5. A concrete syntax tree, for a byte-exact round trip

Rejected. It roughly doubles the node shapes to preserve the bullet character, indent
width, fence style, emphasis delimiter, and line wrapping — for a guarantee no consumer
asked for. Idempotency is the property that matters and normalization provides it.

### 6. `remark` / `unified`

Rejected. It parses GFM correctly and has a mature plugin ecosystem, and it is a larger
dependency graph than Markdoc, in a repository whose last eight ADRs removed format
dependencies. It would also keep the tree someone else's shape, which is the specific
problem with the current one.

### 7. Ship `Markdown.parse` only, and add `Markdown.stringify` when something needs it

Rejected for the reason ADR-047 rejected it: a format package owes both halves, and the
callers arrive as soon as the capability does. Serving markdown to an agent, normalizing
on save, and rewriting links for a feed are all in the usage above and none is possible
without it.

### 8. Free functions, or an object built with `Object.assign`

Rejected. Free functions read worse at the call site once there are five of them —
`parse`, `walk`, and `stringify` are all words a module already uses for something else, and
`import * as Markdown` puts the namespace back with none of the compiler's help.
`export const Markdown = Object.assign({}, { parse, stringify })` does merge with a
type-only `namespace Markdown`, so it is a real option, but `Object.assign` is an
indirection around an object literal and neither form can say that there is nothing to
construct. A class with a private constructor says exactly that, and its static entries
read the way `@sdxc/sitemap`'s already do.

### 9. A `Markdown.resolve` for variables

Rejected. It is six lines of `Markdown.walk` behind a name, and the one thing it adds
beyond the traversal — what to do about an unresolved name — is the part that cannot be
decided in the package. Shipping the `variable` node type and letting the caller write the
visitor keeps the class to what only the package can provide.

The same test applies to anything else proposed for the class: if it is a `Markdown.walk`
with a policy attached, the policy belongs to the caller.

### 10. Naming the traversal `Markdown.map`

Rejected, narrowly. `map` is attractive because the traversal returns a new document and
mutates nothing, which is exactly `Array.prototype.map`'s contract.

Two things break the analogy. A handler here returns `null` to remove a node and an array
to splice several in, so the shape is `flatMap` with a filter, and a reader who expects
`map` semantics would read `return null` as writing a null into the tree. And a visitor
whose handlers return nothing is a read — collecting a table of contents, linting a file —
which is idiomatic for a walker and a smell for a `map` whose result is discarded.

`walk` covers reading and rewriting; `map` would honestly cover only the second.

### 11. A visitor that is one function over every node

Rejected. `walk(doc, (node) => …)` is the shape most tree walkers take, and it costs the
handler's type: every function body opens with a `switch` on `node.type` to narrow before
touching a field, and a visitor interested in one type still runs on every node in the
document.

An object keyed by type narrows for free, runs a handler only where one exists, and is a
value that can be named, exported by another package, and merged with `...`. The
highlighter shipping `highlight` is only possible in the object form.

### 12. `inline` and `void` booleans on a tag definition

Rejected. Two independent booleans describe four states where only three exist, so
`{ inline: false, void: false }` and `{ inline: true, void: true }` are both writable and
neither says anything a reader can act on without checking the other field. They also
describe the tag rather than the parser: `void: true` is a claim about the element, while
what the parser needs is the answer to one question — what, if anything, comes between the
opening tag and the closing one.

`content: "blocks" | "inline" | "none"` answers exactly that in one field, and placement
drops out of the definition entirely because the source settles it by the rules above.

### 13. A separate `Markdown.walkAsync`

Rejected. Two names for one traversal, and every caller would have to know which one a
visitor needs before writing it. Deciding from the visitor's own return type puts the
answer where the information already is, and a synchronous pass stays synchronous — a
highlighting walk inside a render path never has to be awaited.

Making the single `walk` always asynchronous was rejected for the same reason from the
other side: it would put an `await` in front of every pass that never waits for anything.

### 14. A variable as an attribute value

Rejected. A tag's attribute schema runs at parse time so that a bad attribute is an error
with a position, and a variable is a value that does not exist yet at parse time. Either
the schema skips variable-valued attributes, which makes it a partial check, or it runs
again after resolution, which moves validation into every caller's visitor. Variables in
text cover every case the content has asked for, and an attribute that has to vary per
render is a tag the renderer can vary.

### 15. Math and emoji shortcodes in the baseline

Rejected. Inline math is a second delimiter grammar over `$`, the character prose uses
most after punctuation, with rules about neighbouring whitespace and digits that readers
of the raw file cannot see. Emoji shortcodes need a table of roughly eighteen hundred
names to know which `:word:` to replace, which is the kind of weight this ADR removes.
Both are visitors another package can ship over `text` nodes, and neither appears in the
corpus.

### 16. Separate `fence` and `code` block nodes, and an `autolink` beside `link`

Rejected. A fenced and an indented code block are one construct with one rendering, so a
highlighter that handled only fences would leave indented code unpainted for no reason an
author could see. A bare URL and a bracketed link are one construct too; the serializer
knows to write angle brackets when the text equals the destination. One node type per
construct is what keeps `toRemix` and every visitor from having to know two names for one
thing.

### 17. A `tokens` field on the code node, in this package

Rejected. It would make the format's own types name the highlighter's `Token`, and a
package that claims no dependency on the highlighter cannot import one, even as a type.
Module augmentation through the merged namespace lets the highlighter declare the field it
attaches, and the rule that the serializer writes only parser-produced fields makes every
such field derived by definition.

### 18. A bare `$name` for variables

Rejected. It needs an identifier rule to keep `$5/month` and `US$100` as prose, an escape
for the literal case, and it collides with GitHub's math delimiters — in
`live at $domain. Visitors on the **$plan**` GitHub's rules read the second `$` as
closing a math span. `{% $name %}` needs none of that: `{%` never begins prose, the
braces already carry annotations so the serializer already escapes them, and it is the
form Markdoc authors write today. The cost is six more characters per hole, in content
that has written none so far.

## Notes

### What the suite measured

**Conformance.** CommonMark 0.31.2: **648 of 652**. GitHub Flavored Markdown: **658 of 672**.
Both floors are asserted, so they can only go up. Every example still short of one is a
divergence this document chose:

- **One entity example, in each suite.** `entities.ts` ships the three XHTML 1.0 sets,
  253 names packed into a 2.2 KB string, rather than HTML5's roughly eighteen hundred.
  `&Dcaron;` and its neighbours stay literal. That is the weight decision, and it costs
  exactly one example.
- **Three autolink examples, in each suite.** A bare URL and a bare email become links,
  because the dialect is GitHub's. Plain CommonMark expects text, and the GFM extension
  examples expect the links — the same inputs, two right answers, and this package gives
  GitHub's.
- **Nine emphasis examples, in the GFM suite only.** The vendored GFM specification is
  pinned to CommonMark 0.29, which flattened `****foo****` to one `strong` node; 0.31.2
  nests it as two. The parser matches 0.31.2, and every one of those nine inputs passes in
  the CommonMark suite. Spec drift, not a defect.
- **The one `tagfilter` example.** Raw HTML renders as escaped text everywhere, so nothing
  raw ever becomes markup for the filter to catch. The guarantee is stronger than the one
  the extension describes, and it reads differently.

**The corpus.** All thirty-six content files parse, round-trip idempotently, and write back
to a fixed point of `vp fmt`. Against the snapshot of the previous pipeline, the rendered
output is identical for thirty-three of the thirty-six once the one intended markup change
is normalized: a fenced block now renders as `<pre><code class="language-…">` where the
previous parser emitted `<pre data-language="…">`. Of the three that still differ, two are
shapes of the printer used for the comparison — `<hr />` against `<hr>`, and the newline the
specification puts before a list nested in a tight item. The third is a gain: a bare URL in
the flow-monitor documentation is now a link.

**Weight.** Measured above, in "The suite lands first".

### Frontmatter is a mapping

One rule the design did not anticipate, settled while implementing. A file opens with a
frontmatter block only when the delimited text parses as a YAML **mapping**. A block holding
a scalar, a sequence, or nothing is a document that opens on a thematic break, and its lines
belong to the body — which is what lets `---\nFoo\n---\nBar\n---` read as the two setext
headings CommonMark says it is. A block YAML outright rejects is still the loud failure this
document asks for, since a malformed block is one an author meant to write.

With a schema the outcome is unchanged either way: a block that is not a mapping validates
against `{}`, exactly as an absent one does.

## References

- ADR-042: First-Party Syntax Highlighting
- ADR-046: First-Party Frontmatter Parsing
- ADR-047: YAML Package With a JSON-Shaped Surface
- ADR-050: HTML Named Entities in XML Parsing
- ADR-055: HTML Package
- ADR-056: Sitemap Parsing
- [CommonMark Specification](https://spec.commonmark.org/), including Appendix A, "A
  parsing strategy", and the `spec.json` example set
- [GitHub Flavored Markdown Specification](https://github.github.com/gfm/)
- [GitHub: Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
