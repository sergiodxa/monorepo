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

### The two consumers want different things, and neither wants what Prism returns

`@pkg/markdown` wants markup, and gets it. `@pkg/mail` wants tokens, and has to undo the
shape Prism hands back: `tokenize` returns a tree, so `markdown.tsx` carries `tokenText`
to flatten a token's content to whatever depth the grammar nested it, and `bucket` to
collapse dozens of token types into the six an email needs. The tree is built and then
discarded on every render.

### Grammar registration is a global mutation with an implicit order

A grammar registers itself by side effect when its file is imported, and grammars extend
each other through the same global object. Both packages list those imports
alphabetically, which puts `prism-tsx.js` ahead of `prism-typescript.js`.
`prism-tsx.js` opens with `Prism.util.clone(Prism.languages.typescript)`, receives
`undefined`, and registers `tsx` as a copy of `jsx` with a tag-pattern fix. Nothing
throws and nothing warns.

`tsx` is the second most common fence language in this repository's own markdown, 1,884
of 7,282 fences. Highlighting `interface U { id: string }` through the current import
order leaves `string` unpainted; through `typescript`, or through `tsx` with the two
imports swapped, it is a `builtin`. The formatter is not the cause and will not fix it —
`vp fmt` leaves side-effect imports where they are — but nothing keeps the order correct
either.

The same object makes the defect non-local: `Prism.languages` is process-global, so what
one package highlights depends on which grammars every other package in the same Worker
registered, and in which order. `uptime` imports both packages and gets the union;
`r3-auth` imports only mail and gets ten grammars.

### The HTML string is the contract, and the path that skips Prism skips escaping

Prism registers `plain`, `plaintext`, `text` and `txt` as empty grammars, so those fences
still go through `Prism.highlight` and come out escaped. A language with no grammar at
all does not: `fence.transform` passes the fence source through untouched, and `Fence`
hands it to `innerHTML`. Parsing

````markdown
```hcl
<img src=x onerror=alert(1)>
```
````

and rendering it through `MarkdownView` produces a live `<img>` element inside the
`<code>`. `hcl`, `toml`, `capnp`, `go`, `dockerfile`, `mermaid` and nine other names
account for 113 fences in this repository, and `@pkg/blog-engine` renders
tenant-authored fields through this component. Escaping in the working path belongs to
Prism, escaping in the fallback path belongs to nobody, and the seam is invisible because
both branches produce a `string`.

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

`highlight` renders the same list to `<span class="token …">` markup and escapes every
value, `plain` included, so `@pkg/markdown` keeps a string in the Markdoc tag — the
payload that gets cached — and the fence node stops choosing between two escaping
regimes. An unknown language yields one `plain` token covering the whole input, which is
the same escaped-passthrough the `plain` grammar produces today.

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
3. Move `@pkg/markdown`'s fence node and `@pkg/mail`'s `CodeBlock` over, delete the alias
   tables, `tokenText` and `bucket`.
4. Consolidate the stylesheets and update the root README's dependency table.

## Consequences

### Positive

- 57.1 KB minified, 20.8 KB gzipped leaves the SSR bundle of every Worker that renders
  markdown, and 42.5 KB minified leaves the one that sends markdown mail.
- The fallback path escapes, so a fence in a language with no grammar renders as text
  instead of as markup. The surface that renders tenant-authored posts loses the injection
  it has today.
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
- `@pkg/markdown` keeps handing the client an HTML string. Tokens in the Markdoc tag
  would let `Fence` emit real elements and drop `innerHTML`, at the cost of a larger
  cached payload; that trade is open and does not need settling here.

## Alternatives Considered

**Keep `prismjs` and swap the two imports.** One line, and it fixes the `tsx`
degradation. It should land regardless of this ADR, because it is a live rendering
defect and the replacement is not a week's work. It leaves the size, the global registry,
the two alias tables, the unescaped fallback and a dependency whose last release was
eighteen months ago.

**Escape the fallback and stop there.** Also one line, and also worth landing now. It
closes the injection without touching anything else, which is exactly its limit: the seam
that produced it — an HTML string assembled by two branches with different escaping
owners — stays.

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
