# ADR-058: First-Party Markdown Parsing

## Status

**Proposed** - 2026-09-11

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
reference definitions, task lists, or footnotes.

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

`YAML.stringify` shipped because a format package owes both halves, and nothing has
called it since. Writing frontmatter back out is its first real caller.

## Decision

`@sdxc/markdown` parses and serializes GitHub Flavored Markdown itself, over a
first-party AST, and Markdoc is removed.

The package has three entry points. The root is the format; each of the others is one
thing you do _with_ a parsed document, named for what it produces:

```ts
// @sdxc/markdown — the format, no rendering runtime
class Markdown {
	private constructor();

	static parse(source, options?): Result<Markdown.Parsed<FM>, MarkdownParseError>;
	static frontmatter(source, schema?): Result<Markdown.Frontmatter<FM>, MarkdownParseError>;
	static stringify(document, options?): Result<string, MarkdownStringifyError>;
	static walk<V>(node, visitor: V): Markdown.Walked<V>; // Result, or Promise<Result>
}

// @sdxc/markdown/plain — plain text
toPlainText(node, options?): string;

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
reads its format through `Sitemap.parse` and `Sitemap.fetch`, so a reader who knows one
package knows this one.

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
for. `/plain` needs nothing, and is its own entry for symmetry and for room to grow:
plain-text extraction has its own options today and will grow more, and none of them
belong on the surface of the format.

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

`frontmatter` is typed from the schema. Without a schema it is `unknown`, as
`@sdxc/yaml` read it.

`Markdown.frontmatter` stops after the block and never builds the AST. An index page over
a hundred posts reads a hundred titles without parsing a hundred bodies.

### The AST is plain data

Every node is a plain JSON-serializable object with a `type` discriminator, its own
fields, and a `position`. No classes, no symbols, no `$$mdtype`. That is what lets a
parsed document be cached in KV, sent in a payload, or diffed in a test.

```ts
export namespace Markdown {
	export interface Document {
		type: "document";
		children: Block[];
	}

	export interface Heading {
		type: "heading";
		level: 1 | 2 | 3 | 4 | 5 | 6;
		/** From a `{% %}` annotation; `{}` when the heading carries none. */
		attributes: Attributes;
		children: Inline[];
		position: Position;
	}

	export interface Fence {
		type: "fence";
		language?: string;
		content: string;
		attributes: Attributes;
		/** Attached by a highlighting visitor. Derived, so `Markdown.stringify` re-emits `content`. */
		tokens?: Token[];
		position: Position;
	}

	export interface Tag {
		type: "tag";
		name: string;
		attributes: Attributes;
		/** Parsed as markdown, so a tag's children are nodes, not a string. */
		children: Array<Block | Inline>;
		position: Position;
	}

	export interface Alert {
		type: "alert";
		kind: "note" | "tip" | "important" | "warning" | "caution";
		children: Block[];
		position: Position;
	}
}
```

The full union:

| Blocks                                                                                                                                                                  | Inline                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `document` `heading` `paragraph` `fence` `code` `list` `listItem` `blockquote` `alert` `table` `tableRow` `tableCell` `thematicBreak` `html` `footnoteDefinition` `tag` | `text` `emphasis` `strong` `strikethrough` `code` `link` `image` `autolink` `softBreak` `hardBreak` `html` `footnoteReference` `variable` `math` `tag` |

`tag` appears in both, because a tag is block-level or inline depending on where it is
written.

### `Markdown.walk` is the only transform mechanism

There is no `transform` stage and no plugin config. Everything that changes a parsed
document — highlighting, variable resolution, link rewriting, section stripping —
is a `Markdown.walk`, and it never mutates:

```ts
Markdown.walk(node, visitor: Markdown.Visitor): Result<Markdown.Document, MarkdownWalkError>;
```

#### The visitor is an object, not a function

It is a plain object with one **optional** handler per node type, keyed by the type's
name:

```ts
export namespace Markdown {
	export type Visitor = {
		[K in Node["type"]]?: (node: Extract<Node, { type: K }>, parent: Node | null) => Visited;
	};
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
whatever it returned are walked next. A handler is never re-applied to its own output, so
a `fence` handler returning a `fence` terminates rather than looping, and a removed node's
children are not visited at all.

Subtrees no handler touched are reused by reference, so a walk that changes one heading
copies one spine and nothing else.

Keying by type rather than taking one function over every node is what makes the handler's
argument typed: inside `link(node)`, `node.href` exists and the compiler knows it, with no
narrowing to write.

Being an object also makes a visitor a **value** — it can be named, exported from another
package, and merged. That is the whole mechanism behind the highlighter's `fences`:

```ts
// @sdxc/highlight/markdown
export const fences: Markdown.Visitor = {
	fence(node) {
		let language = normalizeLanguage(node.language ?? "plain");
		return { ...node, language, tokens: tokenize(node.content, language) };
	},
};
```

```ts
// `anchors` is another visitor — the consumer's own, or another package's.
Markdown.walk(document, { ...fences, ...anchors });
```

#### A visitor that throws is a failure, not an exception

A handler is arbitrary code — it resolves a name, parses a URL, reads a token map — and
any of that can throw. The walk catches it and answers with a `Result`, the way every
other entry point in the repository does, so a caller handles a bad document the same way
whether the parser rejected it or a visitor did.

`MarkdownWalkError` carries the thrown value as its `cause` and the `position` of the node
being visited, which is the part a bare `throw` loses: the failure names the line the
visitor was standing on.

#### A visitor may be asynchronous

A handler can return a promise, and then the walk returns one. The promise wraps the
`Result`, so awaiting gives back the same shape a synchronous walk returns directly:

```ts
let painted = Markdown.walk(doc, fences); // Result<Document, …>
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

The decision is made by the **visitor**, not by a node: if any handler's declared return
type includes a promise, the whole walk is asynchronous and the return type says so; if
none does, the walk is synchronous and nothing has to be awaited. That is what keeps a
highlighting pass usable inside a render path while a pass that fetches link titles, reads
image dimensions, or resolves a transclusion from KV is possible at all.

One mechanism either way. Without it the choice is a second `walkAsync` beside the first,
or making every caller await a pass that never waits for anything.

### Annotations decorate, tags create

Two syntaxes, because they do two different things.

An **annotation** attaches attributes to a node that already exists. It is
`{% key="value" %}`, it supports `#id` and `.class` shorthands, and it goes on the same
line for blocks with a single-line opener and on its own line above for the rest. A blank
line between the annotation and its block is allowed, because `vp fmt` inserts one:

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

Attributes read like JSX: `key="string"`, `key={42}`, `key={true}`, `key={$variable}`,
and a bare `key` for `true`.

Only **registered** names become tags. An unregistered `<div>` stays raw HTML, exactly as
GitHub treats it, so the departure from CommonMark is scoped to names the app opted into.
Registering a tag declares its attribute schema, which is what makes a bad attribute a
parse error with a line number instead of a rendering surprise:

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

Placement is not declared, because it does not have to be. A tag written inside a line is
an inline node and one written on its own line is a block node — position answers that
without ambiguity. What position _cannot_ answer is how to parse the children, since the
parser has to know before it has finished reading them, which is why `content` is declared
and placement is inferred.

Inside a tag's children, markdown parses normally — which is the whole point, and the one
place this dialect deliberately leaves CommonMark, where an HTML block swallows its
content as text.

### Variables are a visitor, not a feature

`$name` in text and `{$name}` in an attribute parse to a `variable` node carrying that
name. Parsing stops there: nothing is substituted, so one parsed document serves every
render, and resolution is a `Markdown.walk` the caller writes.

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
		if (!(node.name in variables)) throw new Error(`Unresolved $${node.name}`);
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
import { fences } from "@sdxc/highlight/markdown";

let result = Markdown.walk(parsed.document, fences);
```

`fences` is the visitor shown above — an object with one `fence` handler, returning the
node with `tokens` attached. It ships from `@sdxc/highlight`, not from this package, which
is the whole point —
`@sdxc/markdown` has no highlighting entry point, no dependency on the highlighter, and
nothing in it knows that fences can be painted.

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
	...fences,
	link(node) {
		return { ...node, href: canonical(node.href) };
	},
});
```

`Markdown.stringify` ignores `tokens` because the fence still carries its `content`, so a
highlighted document serializes back to the markdown it came from.

### GitHub Flavored Markdown is the baseline

If GitHub renders it in a `.md` file, this parses it: everything in CommonMark, plus the
GFM spec's tables, task lists, strikethrough, literal autolinks, and disallowed raw HTML,
plus GitHub's documented extensions — alerts, footnotes, math, emoji shortcodes, and
heading anchors.

Alerts are a node, not a styled block quote, so a renderer can draw one without pattern
matching on its first line:

```md
> [!WARNING]
> Deleting a monitor also deletes its history.
```

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

Given `{ frontmatter }`, `Markdown.stringify` writes the block through `YAML.stringify` and
prepends it, so a document read, transformed, and written back comes out whole.

### Out of scope

- **Repository-context autolinking.** `@mention`, `#123`, and bare commit SHAs need a
  repository to resolve against. An app that wants them adds a `Markdown.walk` over `text` nodes;
  the parser does not guess.
- **Rendering a fence's language.** A `mermaid` or `geojson` fence parses as a fence with
  that language. Drawing it is the renderer's job, through `components`.
- **Markdoc's template language.** Functions, conditionals, partials, and slots. No
  consumer has ever used one, and `Markdown.walk` covers the cases that motivated them.
- **A concrete syntax tree.** See the round trip above.

## Usage

### Parse a document and render it

The whole path, replacing what the docs controller does today:

```tsx
import { Markdown } from "@sdxc/markdown";
import { fences } from "@sdxc/highlight/markdown";
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

	let highlighted = Markdown.walk(document, fences);
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

let entries = await Promise.all(
	slugs.map(async (slug) => {
		let result = Markdown.frontmatter(await readDoc(slug), Frontmatter);
		if (isFailure(result)) return null;
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
// Strip every fence from the copy an excerpt is built from.
let prose = unwrap(Markdown.walk(document, { fence: () => null }));

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
		<aside mix={[css({ borderLeft: "3px solid", padding: "0.75rem 1rem" })]} data-type={props.type}>
			{props.children}
		</aside>
	);
}

toRemix(document, { components: { callout: Callout, kbd: Kbd, video: Video } });
```

`**history**` inside the callout arrives as a `strong` node, so it renders as
`<strong>history</strong>` nested inside whatever `Callout` draws. A tag's children are
markdown all the way down, including other tags.

### Variables, resolved per render

One parse, many renders. The status page documentation is written once and resolved per
tenant:

```md
# Status page for $team

Your page is live at $domain. Visitors on the **$plan** plan see $retention of history.

<callout type="info">
Upgrade to raise the limit above $limit monitors.
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
		if (value === undefined) throw new Error(`Unresolved $${node.name}`);
		return { type: "text", value: String(value), position: node.position };
	},
});
if (isFailure(document)) throw document.error;

return ctx.render(<DocView document={document.data} />);
```

The parsed document goes in the cache once; the variables change every request. A
document that still carries `variable` nodes serializes back with `$team` intact, so the
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
let indexed = toPlainText(document, { fences: true });
```

It takes the AST rather than a source string, so a caller that has already parsed does
not parse twice, and a caller that walked the tree first measures what it actually
renders.

### One document, two renderers

The AST is the contract, so an email renders the same parsed document the page does:

```ts
let { document } = unwrap(Markdown.parse(body, { frontmatter: Frontmatter }));
let highlighted = unwrap(Markdown.walk(document, fences));

let page = toRemix(highlighted); // @sdxc/markdown/remix
let email = toMail(highlighted); // @sdxc/mail's renderer, over the same union
```

`@sdxc/mail` stops importing Markdoc and switches its tag-name checks for a `switch` on
`node.type` the compiler can prove exhaustive.

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
	fence(node) {
		if (!node.language)
			problems.push(`${file}:${node.position.start.line} fence without a language`);
	},
});
```

### What each consumer changes

| Consumer             | Change                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/uptime` docs   | `new Markdown(...).parse(source)` becomes `Markdown.parse(source, options)`; highlight with `Markdown.walk(doc, fences)` |
| `apps/blog` posts    | Same, plus `<MarkdownView>` becomes `toRemix`, and `content: unknown` becomes `document: Markdown.Document`              |
| `apps/blog` MCP page | One `Markdown.parse` instead of `parse` plus `Markdown.frontmatter`; `Markdown.stringify` for the markdown response      |
| `apps/books` sample  | Same as uptime                                                                                                           |
| `@sdxc/blog-engine`  | `parseMarkdown` returns a typed document instead of `unknown`                                                            |
| `@sdxc/highlight`    | `src/markdoc.ts` becomes `src/markdown.ts`: the Markdoc node schema becomes a `fences` walk visitor                      |
| `@sdxc/mail`         | Renders the first-party union; drops the Markdoc import                                                                  |

The MCP page is the clearest gain: it parses the frontmatter twice today, once through
`parse` and once through the old `Markdown.frontmatter`, because the parser returns a tree but
not the body it came from.

## Consequences

### Positive

- The server entry drops roughly 149 KB minified, 82% of its weight.
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
- Parse errors carry positions, so a bad annotation names a line instead of failing
  quietly the way the current frontmatter path does.
- `YAML.stringify` gets its first caller, closing ADR-047.

### Negative

- A markdown parser is the largest parser in the repository. Emphasis delimiter runs,
  link destinations, backtick spans, and list continuation are where hand-written
  markdown parsers are wrong, and they will be wrong here first.
- The present safety net is twenty-eight tests, twenty-one of them for `toPlainText`.
  The engine cannot be swapped under that, so the test suite has to land before the
  parser does.
- `<tag>` children parsing as markdown departs from CommonMark. It is scoped to
  registered names, but a document is no longer portable to a renderer that does not know
  the tag.
- Every consumer changes at once. The AST is the public shape and there is no adapter
  that makes the old tree and the new one interchangeable.

### Neutral

- The fence annotation stays `{% path="…" title="…" %}`, so existing content and both
  package READMEs are unaffected.
- `Markdown.stringify` normalizes rather than preserving the source, so a file written back
  differs from the file read even when nothing changed. Content in the repository is
  formatted by `vp fmt` already, which normalizes it the same way.
- `@sdxc/markdown` no longer depends on `@sdxc/highlight` at all. Highlighting becomes a
  visitor the highlighter ships, which makes `Markdown.walk` a published extension point
  rather than an internal mechanism.
- `MarkdownView` goes away with no replacement component. Views call `toRemix` and own the
  markup around it, which is what every consumer already does.
- The `Markdown` class stays, but stops being instantiated: its constructor becomes private
  and every operation becomes static. Per-app configuration moves from a constructor
  argument to an options object the app hoists to module scope, so it is data rather than
  an instance.

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
construct. A class with a private constructor says exactly that, and matches how
`@sdxc/sitemap` is already read.

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
highlighter shipping `fences` is only possible in the object form.

### 12. `inline` and `void` booleans on a tag definition

Rejected. Two independent booleans describe four states where only three exist, so
`{ inline: false, void: false }` and `{ inline: true, void: true }` are both writable and
neither says anything a reader can act on without checking the other field. They also
describe the tag rather than the parser: `void: true` is a claim about the element, while
what the parser needs is the answer to one question — what, if anything, comes between the
opening tag and the closing one.

`content: "blocks" | "inline" | "none"` answers exactly that in one field, and placement
drops out of the definition entirely because position already settles it.

### 13. A separate `Markdown.walkAsync`

Rejected. Two names for one traversal, and every caller would have to know which one a
visitor needs before writing it. Deciding from the visitor's own return type puts the
answer where the information already is, and a synchronous pass stays synchronous — a
highlighting walk inside a render path never has to be awaited.

Making the single `walk` always asynchronous was rejected for the same reason from the
other side: it would put an `await` in front of every pass that never waits for anything.

## References

- ADR-042: First-Party Syntax Highlighting
- ADR-046: First-Party Frontmatter Parsing
- ADR-047: YAML Package With a JSON-Shaped Surface
- ADR-050: HTML Named Entities in XML Parsing
- ADR-055: HTML Package
- ADR-056: Sitemap Parsing
- [CommonMark Specification](https://spec.commonmark.org/)
- [GitHub Flavored Markdown Specification](https://github.github.com/gfm/)
- [GitHub: Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
