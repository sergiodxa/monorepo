---
name: sdxc-highlight
description: "@sdxc/highlight is syntax highlighting that returns `Token[]` rather than markup, with `tokenize`, `highlight`, `scan`, `compose`, a markdown walk visitor filling `Markdown.Code.tokens`, and a stylesheet keyed to the token types. Use when rendering code blocks as components rather than an injected markup string, painting a parsed markdown document, theming through `--highlight-<type>` properties, or writing a `Grammar` for a language it does not ship."
---

# @sdxc/highlight

A highlighter's real output is a sequence of runs, each labelled with what it is. This package returns those runs as `Token[]` from `tokenize(code, language)`, so a renderer building a component tree maps them like anything else; `highlight(code, language)` is the same thing rendered to escaped `<span class="token …">` markup for callers that need a string. A grammar is a plain value a module exports — no global registry, no import order — and `scan`, `compose` and the `Grammar`/`Rule` types are what a language of your own is written against. It runs anywhere JavaScript does; the root entry has no dependencies.

Full API, options and examples: [packages/highlight/README.md](packages/highlight/README.md)

## When to reach for it

- Rendering a code block as elements rather than injecting a markup string into the DOM.
- Painting every fenced code block of a parsed markdown document, in the same pass that rewrites its links.
- Highlighting inside an email or anywhere there is no stylesheet to load, where the colour has to be inline and keyed by `Token.Type`.
- Theming code colours without overriding selectors — the stylesheet reads one custom property per token type.
- Adding a language the shipped grammars do not cover, or building one on top of another with `compose`.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/highlight": "workspace:*" } }
```

```ts
import { tokenize } from "@sdxc/highlight";

let tokens = tokenize("let x = 1;", "ts");
// [
//   { type: "keyword", value: "let" },
//   { type: "plain", value: " x " },
//   { type: "operator", value: "=" },
//   { type: "plain", value: " " },
//   { type: "number", value: "1" },
//   { type: "punctuation", value: ";" },
// ]
```

### Entry points

- `@sdxc/highlight` — `tokenize`, `highlight`, `normalizeLanguage`, `scan`, `compose`, the `languages` registry, and the `Token`, `Rule` and `Grammar` types.
- `@sdxc/highlight/markdown` — a `Markdown.Visitor` whose `code` handler paints each block, filling the `tokens` field it declares on `Markdown.Code`.
- `@sdxc/highlight/styles.css` — the selector layer: one rule per token type, each reading `--highlight-<type>`, with light and dark defaults.

## Suggestions

- Pass the language exactly as an author wrote it on the fence. `tokenize` resolves aliases itself: `ts`, `js`, `sh`, `yml`, `jsonc` and `gql` land on the grammar that serves them, and `text`, `txt` and `dotenv` land on `plain`. A language with no grammar yields one `plain` token holding the whole input, so nothing throws.
- The visitor's handlers are all synchronous, so `Markdown.walk` answers with a `Result` rather than a promise — a painting pass inside a render path is never awaited. Visitors merge, so spread it alongside your own handlers and one walk both paints and rewrites.
- Key an inline palette by `Token.Type` rather than by string: the compiler then checks it covers every member, which is what keeps a type added upstream from silently rendering unpainted.
- The stylesheet sets colour and nothing else. Padding, border, radius, and any weight or face a theme spends on a role belong to your own rules on the same classes.
- Writing a grammar: rule order is priority, every `match` carries the sticky flag, nesting is a mode pushed with `push` and left with `pop`, and anything no rule claims accumulates into a `plain` run — so a grammar is complete from its first rule. Keep patterns linear, and prefer the nearest existing token type (`builtin`, `property`, `constant`) over a twenty-first one.
- `tokens` is derived data: it survives a round trip through the document object and not through the text, since a serializer writes the fields a parser produced.

## Related

- `@sdxc/markdown` — the document the `/markdown` visitor walks, and where `Markdown.Code` is declared; skill `sdxc-markdown`
- `@sdxc/result` — what `Markdown.walk` reports its outcome as; skill `sdxc-result`
