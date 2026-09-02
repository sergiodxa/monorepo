# ADR-042: First-Party Syntax Highlighting

## Status

**Proposed** - 2026-09-02

## Background

`prismjs` highlights fenced code in two places. `@pkg/markdown/server`'s `fence` node
highlights to an HTML string, which `@pkg/markdown/client`'s `Fence` component injects
with `innerHTML`; that path renders the blog's posts, the books sample chapter, the
uptime docs, and every tenant-authored markdown field `@pkg/blog-engine` draws.
`@pkg/mail/markdown`'s `CodeBlock` tokenizes instead and paints each run with an inline
style, because an inbox has no stylesheet.

Both are server-only: no app imports Prism into a client bundle. The dependency review
recorded in ADR-041 left `prismjs` as the largest third-party runtime dependency in the
markdown path, and the largest one with a published alternative to writing it here.

## Context

### The library

`1.30.0` is the latest version on npm, published 2025-03-10. It follows `1.29.0` from
2022-08-23, a gap of two and a half years, and nothing has been published in the eighteen
months since. No `2.x` exists on the registry, under any dist-tag. The GitHub advisory
database lists six advisories against the package; the most recent, CVE-2024-53382, is
patched only in `1.30.0`, which is what the two-and-a-half-year gap meant in practice.
Types come from `@types/prismjs`, a second dependency on a second release cadence.

### What it costs the Workers that carry it

Measured with `bun build --minify --target=browser`, once whole and once with `prismjs`
external:

| Entry                  | With     | Without  | Prism's share              |
| ---------------------- | -------- | -------- | -------------------------- |
| `@pkg/markdown/server` | 317.2 KB | 260.0 KB | 57.1 KB min / 20.8 KB gzip |
| `@pkg/mail/markdown`   | 197.6 KB | 155.1 KB | 42.5 KB min / 16.3 KB gzip |

Prism's core is 19.8 KB minified on its own; the fifteen grammars `@pkg/markdown`
registers bring the import to 57.7 KB minified, 19.1 KB gzipped. That rides in the SSR
bundle of `blog`, `books` and `uptime`, and in `r3-auth` through mail.

### Two Markdoc pipelines, and neither shares its fence handling

Every surface that highlights reaches Prism through one of two packages, and both of them
drive Markdoc:

| Surface                        | Package              | Fence handling                  |
| ------------------------------ | -------------------- | ------------------------------- |
| blog posts, blog MCP pages     | `@pkg/markdown`      | `fence` node, at transform time |
| books sample chapter           | `@pkg/markdown`      | `fence` node, at transform time |
| uptime docs                    | `@pkg/markdown`      | `fence` node, at transform time |
| blog-engine tenant post fields | `@pkg/markdown`      | `fence` node, at transform time |
| uptime mail, r3-auth mail      | `@pkg/mail/markdown` | `pre` tag, at render time       |

`@pkg/markdown` registers a `fence` node in its Markdoc config, normalizes the language,
highlights, and emits a `Fence` tag. `@pkg/mail` calls
`Markdoc.transform(Markdoc.parse(source))` with no config at all, so a fence arrives as a
default `pre` tag carrying `data-language`, and `CodeBlock` highlights the text it reads
back out of the tree while rendering. Mail keeps that pipeline deliberately — importing
`@pkg/markdown` would pull the dependency its own subpath exists to contain — and pays
for it with a second alias table of its own.

The two also want different output, and neither wants the shape Prism returns.
`@pkg/markdown` wants markup and gets it. `@pkg/mail` wants tokens, and has to undo a
tree to get them: `tokenText` flattens a token's content to whatever depth the grammar
nested it, and `bucket` collapses dozens of token types into the six an email needs. The
tree is built and discarded on every render.

Nothing caches or serializes either tree. Both pipelines parse, transform and render
inside a single request, and no app hydrates a component with the result, so the tag's
payload is an in-process value and nothing more.

### Grammar registration is a global mutation with an implicit order

A grammar registers itself by side effect when its file is imported, and grammars extend
each other through the same global object. Both packages listed those imports
alphabetically, which put `prism-tsx.js` ahead of `prism-typescript.js`.
`prism-tsx.js` opens with `Prism.util.clone(Prism.languages.typescript)`, so it received
`undefined` and registered `tsx` as a copy of `jsx` with a tag-pattern fix. Nothing threw
and nothing warned.

`tsx` is the second most common fence language in this repository's own markdown, 1,884
of 7,282 fences, and every one of them highlighted without the TypeScript half of the
grammar: `interface U { id: string }` left `string` unpainted where `typescript` marks it
a `builtin`. Both packages now import TypeScript first, and a test asserts the painted
output, which is the whole of what keeps the order correct — the ordering is load-bearing,
undeclared, and invisible in the source until it breaks.

The same object makes the defect non-local: `Prism.languages` is process-global, so what
one package highlights depends on which grammars every other package in the same Worker
registered, and in which order. `uptime` imports both packages and gets the union;
`r3-auth` imports only mail and gets ten grammars.

### The HTML string is the contract, and two branches escape it

`fence.transform` produces markup, and `Fence` draws it with `innerHTML`, so every branch
that assembles that string owes the same escaping. Prism registers `plain`, `plaintext`,
`text` and `txt` as empty grammars, so those fences take the highlight path and Prism
escapes them; a language with no grammar at all takes a second path, and that one escaped
nothing. Parsing

````markdown
```hcl
<img src=x onerror=alert(1)>
```
````

and rendering it through `MarkdownView` produced a live `<img>` element inside the
`<code>` — reachable content, since `@pkg/blog-engine` renders tenant-authored fields
through that component, and 113 fences in this repository name a language with no
grammar: `hcl`, `toml`, `capnp`, `go`, `dockerfile`, `mermaid` and nine others.

The node now escapes that branch itself, so the two agree. What the fix cannot do is
remove the obligation: the contract is a string of markup, the escaping is spread across
Prism and the node, and the seam is invisible because both branches return the same type.

### One set of class names, five stylesheets

The `token` classes are a contract, and every renderer restates it:

| Location                                          | Lines | Consumer                      |
| ------------------------------------------------- | ----- | ----------------------------- |
| `apps/blog/resources/css/prism.css`               | 348   | blog                          |
| `apps/books/resources/css/prism.css`              | 145   | books                         |
| `packages/blog-engine/src/assets/prism-css.ts`    | 42    | served at `/assets/prism.css` |
| `packages/markdown/styles/prism-{light,dark}.css` | 265   | exported, imported by nobody  |
| `packages/mail/src/markdown.tsx`                  | —     | six inline colors             |

The two the package exports are vendored GitHub themes, and the README tells readers to
load one. No app does.

## Decision

Highlighting moves to `@pkg/highlight`, a new package with no runtime dependencies.
`prismjs` and `@types/prismjs` are removed from `@pkg/markdown` and `@pkg/mail`.

Two entry points, because the callers divide that way. `@pkg/highlight` knows nothing
about markdown: it takes source and a language name and returns tokens.
`@pkg/highlight/markdoc` is the Markdoc node both pipelines register, and it depends on
Markdoc where the core does not.

### Tokens are the primitive

```typescript
export namespace Token {
	export type Type =
		| "attr-name"
		| "attr-value"
		| "boolean"
		| "builtin"
		| "class-name"
		| "comment"
		| "constant"
		| "deleted"
		| "function"
		| "inserted"
		| "keyword"
		| "number"
		| "operator"
		| "plain"
		| "property"
		| "punctuation"
		| "regex"
		| "string"
		| "tag"
		| "variable";
}

export interface Token {
	type: Token.Type;
	value: string;
}

export function tokenize(code: string, language: string): Token[];
export function highlight(code: string, language: string): string;
export function normalizeLanguage(language: string): string;
```

The list is flat, not a tree: it is what `@pkg/mail` already reduces Prism's output to,
and what a `<span>` per token needs. `Token.Type` is closed, so mail's palette is a
record the compiler checks for exhaustiveness rather than a lookup with an `undefined`
arm.

`highlight` renders the same list to `<span class="token …">` markup, escaping every
value, `plain` included. It is the form for anything that needs markup instead of a
component tree; after the migration nothing in this repository does, and it costs the few
lines it takes to walk the list the renderers already walk.

An unknown language yields one `plain` token covering the whole input, so a fence in a
language with no grammar is a token the renderer escapes like any other, rather than a
branch that has to remember to.

`normalizeLanguage` moves the alias table out of both packages: 24 entries in
`@pkg/markdown`, 7 in `@pkg/mail`, one table here, `txt` included since only `text` is
aliased today.

### Grammars are values

```typescript
interface Rule {
	type: Token.Type;
	match: RegExp; // sticky, applied at the cursor
	push?: string; // enter a named mode
	pop?: true; // leave it
}

type Grammar = Record<string, Rule[]>; // "main", plus a mode per nesting context
```

The lexer walks the source once, tries the current mode's rules at the cursor, takes the
first that matches, and accumulates anything unmatched into a `plain` token. Modes carry
the nesting Prism handles by re-tokenizing a slice: template literals, JSX children,
embedded CSS and script in markup. Every rule matches at a fixed position, so scanning is
linear in the input.

Grammars are modules that export a value, and one that builds on another imports it:
`tsx` composes `jsx` and `typescript` by name. A missing piece is a type error at build
time instead of a half-registered grammar at runtime, and no order exists to get wrong.

The set is the seventeen languages the two packages resolve today — `plain`, `bash`,
`css`, `diff`, `graphql`, `html`, `http`, `javascript`, `json`, `jsx`, `markdown`,
`python`, `ruby`, `sql`, `tsx`, `typescript`, `yaml` — with `hcl`, `toml`, `go` and
`dockerfile` to follow, since the census says those are the fences rendering unpainted.

### The Markdoc node ships with it

Both pipelines highlight fences, so the fence node belongs to the highlighter rather than
to each caller:

```typescript
import type { Schema } from "@markdoc/markdoc";

/** Registers as `nodes.fence`, emitting a tag the caller's renderer draws. */
export const fence: Schema;
```

It does what `@pkg/markdown`'s node does today — normalize the language, tokenize, emit a
tag — and carries `tokens: Token[]` on that tag instead of a string of markup, with
`language`, `path` and `title` alongside. `@pkg/markdown` composes it into its config and
deletes `src/server/fence.ts`. `@pkg/mail` adds a config to the
`Markdoc.transform(Markdoc.parse(source))` it already calls, and `CodeBlock` reads tokens
off the tag rather than tokenizing the text it recovered from a `pre`.

Tokens on the tag, not markup, because that is the payload both renderers want: mail
needs a `<span>` per token with an inline style, and `@pkg/markdown/client`'s `Fence` can
emit real elements and drop `innerHTML`. Nothing caches or serializes the tree, so the
list costs one request's memory. This supersedes the escaping fix in the fence node: with
tokens there is no HTML string for a branch to forget to escape.

Highlighting at transform time also puts mail's fences where the other pipeline's already
are, so the language alias resolves once per document rather than once per code block
rendered.

### One stylesheet

`@pkg/highlight/styles.css` paints the twenty types through `--highlight-*` custom
properties. Apps override the properties and keep their own `pre`/`code` layout;
`packages/markdown/styles/*` and `packages/blog-engine/src/assets/prism-css.ts` go away,
and `@pkg/mail` maps the same twenty types to inline colors.

### Order of work

1. Record the current output: every fence in `apps/*/resources/content`, `docs/` and the
   package READMEs, highlighted by `prismjs` at the import order in effect, as a golden
   file per language. This is the corpus the replacement answers to, in the same way
   ADR-041 recorded 48 XML inputs before replacing the parser.
2. Build the lexer and the grammars against it. The comparison is token class per source
   range, not bytes: a flat model emits fewer spans than a nested one, and the recorded
   `tsx` output is the degraded grammar, which the replacement deliberately does not
   reproduce.
3. Move the fence node into `@pkg/highlight/markdoc`, register it from `@pkg/markdown`
   and from `@pkg/mail`, and render tokens in `Fence` and `CodeBlock`. The alias tables,
   `tokenText`, `bucket`, `escapeMarkup` and the `pre`/`data-language` branch go with it.
4. Consolidate the stylesheets and update the root README's dependency table.

## Consequences

### Positive

- 57.1 KB minified, 20.8 KB gzipped leaves the SSR bundle of every Worker that renders
  markdown, and 42.5 KB minified leaves the one that sends markdown mail.
- No fence reaches `innerHTML`, because no fence carries markup: the renderers receive
  tokens and emit elements. The escaping the node does today, and the injection it does
  today for a language with no grammar, both stop being possible rather than being
  handled.
- One fence node serves both pipelines, so mail stops recovering code out of a `pre` tag
  at render time and stops carrying a second alias table to do it.
- `tsx` highlights as TypeScript, and cannot silently stop: grammars compose through
  imported values, so the dependency is checked rather than assumed.
- What a package highlights no longer depends on what else the Worker imported.
- Two alias tables, a token flattener and a bucket function become one table and one
  closed union.
- Five stylesheets become one plus per-app property overrides.
- Two dependencies leave, one of them a separately released type package.

### Negative

- Highlighting quality becomes this repository's to maintain, and grammars are a long
  tail: seventeen now, and every new fence language later. The recorded corpus is the
  guard, and a grammar is one file with no dependencies on the others.
- The first-party grammars will be coarser than Prism's on their edges — nested template
  literals, regex-versus-division, YAML's block scalars. The corpus makes each gap a
  visible diff rather than a surprise.
- Highlighting stays a runtime cost in the Worker. Nothing here changes that.

### Neutral

- The `token` class names stay, so the apps' own stylesheets keep working through the
  migration and the consolidation can land after it.
- `@pkg/mail` gains a Markdoc config where it had none, and `@pkg/highlight/markdoc`
  becomes a dependency of both packages. Markdoc was already a dependency of both.
- `@pkg/markdown` keeps owning frontmatter, validation and the renderer. Only the fence
  leaves it.

## Alternatives Considered

**Ship the core only, and let each package keep its own fence node.** The smaller
package, and it leaves in place the thing that produced two alias tables and two escaping
regimes: two hand-rolled integrations of the same library against the same markdown
parser. Mail would go on highlighting at render time out of a `pre` tag.

**Put the node in `@pkg/markdown` and have `@pkg/mail` depend on that.** One package
fewer. It also inverts the reason `@pkg/mail/markdown` is a subpath at all: mail would
pull frontmatter validation, Standard Schema and the Remix renderer into an email
bundle to reach a fence node. Highlighting is the shared part; the markdown pipeline
around it is not.

**Make the tag's payload configurable, markup or tokens.** A knob on a decision that has
one answer per caller and the same answer for both. Tokens render to markup in a few
lines; markup does not render to tokens at all.

**Swap the two imports, escape the fallback, and stop there.** Both are one line, both
were worth landing without waiting for this ADR, and both have landed. They fix the two
defects and nothing that produced them: the grammar registry stays global and
order-dependent, the escaping obligation stays split across Prism and the node, the two
alias tables stay, the size stays, and the dependency's last release stays eighteen
months old.

**Shiki.** Correct where Prism is coarse, because it runs the same TextMate grammars an
editor does. It also carries a regex engine and per-language grammar JSON; the published
package unpacks to 0.57 MB across 885 files, which is the wrong direction for a Worker
whose entire markdown pipeline is 103 KB gzipped, and it is a heavier dependency than the
one being removed.

**highlight.js, or lowlight over it.** 5.25 MB unpacked across 1,569 files, with the same
per-language import model and the same global registry shape. `lowlight` is small only
because the grammars come from `highlight.js`.

**Vendor Prism's grammars.** ADR-034 set the precedent for vendoring, and it would keep
the grammars' quality while dropping the dependency. It also keeps the registry design,
the load-order hazard and most of the bytes, and it moves fifteen files of upstream regex
here without upstream's tests. Vendoring buys the least of the options that cost the most.

**Highlight ahead of time and store the markup.** Works for content that exists at build
time and for nothing else: `@pkg/blog-engine` renders posts authored through the app, and
mail renders a body assembled per send. It also cannot remove the dependency, only move
where it runs.

**Stop highlighting.** The blog is a programming blog.

## References

- [`@pkg/markdown` README](/packages/markdown/README.md) - the parse, fence and render
  contract this replaces the middle of
- [`@pkg/mail` README](/packages/mail/README.md) - the markdown entry point and its six
  token buckets
- [ADR-041](./ADR-041-in-package-xml-parsing-and-serialization.md) - the same trade for
  `@pkg/xml`, and the record-then-replace order of work
- [ADR-034](./ADR-034-vendoring-the-edgefirst-packages.md) - when vendoring is the answer
  instead
