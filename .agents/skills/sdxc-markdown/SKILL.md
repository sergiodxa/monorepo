---
name: sdxc-markdown
description: "@sdxc/markdown parses GitHub Flavored Markdown into a typed JSON-serializable AST, validates the frontmatter block against a Standard Schema, walks and rewrites the tree, and writes it back — with renderers to HTML, plain text and remix/ui nodes. Use when reading content files, validating frontmatter, transforming or linting a document, or rendering markdown into a response or a view."
---

# @sdxc/markdown

GitHub Flavored Markdown: parse to a typed AST, transform it, write it back. Every node is a plain JSON-serializable object with a `type` discriminator, its own fields and a `position`, so a parsed document can be cached, sent in a payload, diffed in a test and narrowed by the compiler at every hop. `Markdown` is a static-only class merged with a namespace of the same name — `Markdown.parse`, `Markdown.frontmatter`, `Markdown.stringify`, `Markdown.walk` are the methods, `Markdown.Document` and `Markdown.Node` the types. Every entry point reports its outcome as a `Result`. Nothing is runtime-specific.

Full API, options and examples: [packages/markdown/README.md](packages/markdown/README.md)

## When to reach for it

- Content files with a YAML frontmatter block need reading, and a missing or wrong-typed field should fail with the line to open.
- An index over many documents needs each one's title without parsing every body.
- A document needs rewriting before it is rendered — rewriting links, painting code blocks, collecting headings into a table of contents.
- The same document has to render both as HTML in a response and as UI nodes inside a view that owns the markup around them.
- An excerpt, a search index entry or a reading estimate has to be pulled out of already-parsed content.
- Content is linted in CI against rules the document itself can express.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/markdown": "workspace:*" } }
```

```ts
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
```

```ts
import { toHTML } from "@sdxc/markdown/html";

let body = toHTML(document);
```

### Entry points

- `@sdxc/markdown` — `Markdown` (parse, frontmatter, stringify, walk), the AST namespace, and the three error classes.
- `@sdxc/markdown/html` — `toHTML(node, options?)` and the `HTMLTagRenderer` shape.
- `@sdxc/markdown/plain` — `toPlainText(node, options?)`.
- `@sdxc/markdown/remix` — `toRemix(node, options?)` and the `MarkdownComponent` shape.

## Suggestions

- `Markdown.frontmatter` takes the same options object as `parse` and stops after the block, so an index over a hundred documents reads a hundred titles without parsing a hundred bodies.
- Every renderer takes any node, not just a document, which is what makes them usable inside a visitor and lets a caller render a fragment.
- Raw HTML — block and inline alike — renders as escaped text in both `toHTML` and `toRemix`, which keeps a document from any source safe to render. An author who wants an element registers a tag for it through `options.tags` / `options.components`.
- `Markdown.walk` returns a new node sharing every subtree no handler touched, and answers with a `Result` (or a promise of one when a handler is asynchronous), so a transform that fails carries the `position` it failed at.
- `Markdown.stringify` normalizes rather than reproducing the source; what holds is idempotency — parsing the output and serializing again yields the same string.
- Frontmatter is a set of named fields, so a delimited block holding a scalar, a sequence or nothing counts as absent and its lines belong to the body. With a schema and no block, the schema runs against `{}`, so a required field fails at line 1.
- `toRemix` returns nodes from data and holds no props or reactive state, so calling it inside a render closure is not a component called as a function.

## Related

- `@sdxc/yaml` — reads the frontmatter block; skill `sdxc-yaml`
- `@sdxc/highlight` — paints code nodes in a walked document before rendering; skill `sdxc-highlight`
- `@sdxc/result` — the `Result` every entry point answers with; skill `sdxc-result`
