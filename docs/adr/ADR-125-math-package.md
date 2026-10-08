# ADR-125: Math Package

## Status

**Implemented** - 2026-10-08

## Background

Markdown in this repo is parsed, walked and rendered by first-party packages: `@sdxc/markdown`
owns the AST and the renderers, and `@sdxc/highlight` paints code blocks through a walk
visitor. Math has no path at all. GitHub renders a ` ```math ` fence and the inline
``$`…`$`` form, so an author who writes either gets a formula on GitHub and a code block
everywhere this repo renders the same file.

Browsers now render MathML Core natively — Chromium since 109, Firefox and Safari for longer — so
a formula needs a TeX-to-MathML converter and nothing else: no stylesheet, no web font, no client
script. This ADR adds `@sdxc/math`: the converter, a walk visitor for markdown, and renderers for
the nodes the visitor leaves.

## Context

### What a converter has to cover

The formulas technical writing uses are a small slice of TeX: scripts, fractions, roots, Greek
letters, operator and relation symbols, big operators with limits, stretchy fences, upright text,
the four common fonts, spacing and small matrices. Packages like KaTeX and Temml cover all of TeX
math and its macro language, ship hundreds of kilobytes, and emit either HTML with a stylesheet
and fonts (KaTeX) or MathML with workarounds for engines that predate MathML Core (Temml). The
repo replaced its third-party markdown and highlighting parsers with first-party ones for the same
reasons: a dependency that does far more than the repo uses, an API that is not `Result`-shaped,
and output that is a string where a component tree is wanted.

### MathML Core constraints

MathML Core is the subset browsers agree on. Two of its limits shape the output:

- `mathvariant` accepts only `normal`, so bold, italic and double-struck letters must be the
  Unicode Mathematical Alphanumeric Symbols (`𝐯`, `ℎ`, `ℝ`) rather than an attribute.
- A single-character `mi` renders italic and a multi-character one upright, which is exactly
  TeX's convention for variables and function names.

### What markdown gives a visitor

`@sdxc/markdown` parses a ` ```math ` fence as a `code` node with `language: "math"`, and
``$`x`$`` as a `text` node ending in `$`, an `inlineCode` node, and a `text` node starting with
`$`, all within one inline parent. Its walk is top-down: a parent's handler sees its children
before they are walked, and a replacement node is never handed to a handler. A handler reports a
failure by throwing; the walk turns that into a `MarkdownWalkError` carrying the node's position
and the thrown value as `cause`.

The parser registers tags through `Options.tags`, and the renderers draw a tag through
`toHTML`'s `tags` option and `toRemix`'s `components` option, both keyed by tag name.

## Decision

Create `@sdxc/math` with three entry points:

| Entry                 | Exports                                                 | Depends on                        |
| --------------------- | ------------------------------------------------------- | --------------------------------- |
| `@sdxc/math`          | `parseMath`, `toMathML`, `MathError`, the tree types    | `@sdxc/result`                    |
| `@sdxc/math/markdown` | `math`, `createMathVisitor`, `renderMath`               | `@sdxc/markdown` (types and html) |
| `@sdxc/math/ui`       | `MathFormula`, `MathTag` (`remix/component` components) | `remix/component`                 |

### The converter

A tokenizer reads commands, numbers and single characters lazily, skipping whitespace and `%`
comments; it also reads a braced group raw for `\text`, `\operatorname` and environment names. A
recursive-descent parser turns the tokens into a JSON tree of MathML elements
(`{ type: "element", name, attributes, children }` and `{ type: "text", value }`). Symbols live in
tables apart from the grammar, so a new symbol is a table row.

`parseMath(tex, { display })` returns the tree rooted at `<math xmlns display>`, with the formula
in a `semantics` element beside an `annotation encoding="application/x-tex"` holding the source,
which screen readers and copy-paste read back. `toMathML` serializes the same tree with every
value escaped and every element explicitly closed, so HTML and XML parsers read it alike.

Internally, a grammar rule throws a positioned `MathError`; `parseMath` catches it and returns it
on the failure branch, so the public API is `Result`-shaped while the recursion reads as the
grammar. `MathError` carries `reason`, a 0-based `index`, and a 1-based `line` and `column`, and
its message ends in `line:column`.

### The supported subset

Numbers, letters, operator characters and `{}` groups; `^` and `_` with TeX's one-token rule;
`\frac`, `\dfrac`, `\tfrac`, `\binom`, `\sqrt` and `\sqrt[n]`; Greek letters (uppercase set
upright); common operators, relations, arrows and dots; big operators whose limits go under and
over in display mode (`munderover`) and beside inline (`msubsup`), integrals always beside, and
`\limits`/`\nolimits`; named functions followed by function application, with `\lim`, `\max` and
similar taking limits in display mode; `\left … \right` with stretchy delimiters (`.` for none);
`\text`, `\mathrm`, `\mathbf`, `\mathit`, `\mathbb`, `\operatorname`; six accents; TeX spacing;
and the `matrix`, `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix` and `cases` environments.
`&` and `\\` are errors outside an environment, and any other command is a `MathError` naming it.

Macros (`\newcommand`), `\color`, `align`-style environments, `\middle`, `\overbrace` and the
rest of TeX are out of scope until a document needs them.

### Tag nodes and renderers instead of teaching `@sdxc/markdown` about math

The visitor replaces a math fence with a block `tag` node named `math` and an inline formula with
an inline one, each carrying `{ tex, display }` and no children. The renderers that already draw
registered tags then draw these: `renderMath` for `toHTML`'s `tags`, `MathTag` for `toRemix`'s
`components`.

This keeps `@sdxc/markdown` free of a math grammar and a MathML serializer it would carry for
every consumer, and keeps math optional the way highlighting is. A tag also round-trips:
`Markdown.stringify` writes it as `<math tex="…" display />`, which parses back to the same tag
when `math` is registered with `content: "none"`.

The parser does not know a `math` tag, so the visitor builds tag nodes directly; the walk accepts
a tag in either a block or an inline slot.

### Invalid TeX fails the walk by default

`math` throws the `MathError` from the handler, so the walk fails with a `MarkdownWalkError`
whose `cause` is the `MathError` and whose position is the fence or paragraph. A broken formula
stops a build, the way a broken frontmatter field does. `createMathVisitor({ invalid: "keep" })`
leaves the code block or inline code as written instead, for previews that render while an author
types. `renderMath` and `MathFormula` render TeX that does not convert as escaped code, so a
hand-built tree never breaks a page.

### Inline `$x$` without backticks is out of scope

The bare `$x$` form needs the inline parser to treat `$…$` as a code-like span: `$a_1 + b_1$`
otherwise parses its underscores as emphasis before any visitor runs, and the visitor would have
to reassemble TeX from emphasis nodes, losing the characters the emphasis delimiters consumed.
GitHub's ``$`…`$`` form puts the TeX inside inline code, which the parser keeps verbatim, so
the visitor reads it exactly as written.

### The component renders on the server

`MathFormula` builds the MathML with `createElement` from the tree, with no `innerHTML`. Server
markup places the elements in the MathML namespace because the browser's HTML parser does so for
anything inside `<math>`. `remix/component` creates client-side elements in the HTML or SVG
namespace only, so a formula first rendered in the browser draws as unknown HTML elements; the
README states the server-render requirement.

## Consequences

### Positive

- Math written for GitHub renders the same everywhere this repo renders markdown.
- No stylesheet, font or client script: the output is MathML the browser draws.
- One JSON tree feeds the string serializer and the component, so they cannot disagree.
- A broken formula fails CI with its line and column, by default.

### Negative

- The subset is a choice; a formula using an unsupported command fails until the table grows.
- Client-only rendering of `MathFormula` does not produce MathML until `remix/component` creates
  elements in the MathML namespace.
- Engines without MathML Core render the raw characters without layout.

### Neutral

- `@sdxc/markdown` is unchanged; math is an opt-in visitor and two renderer entries.

## Alternatives Considered

### 1. KaTeX or Temml

Complete TeX coverage, at the cost of a large third-party dependency, string-only output, a
stylesheet and fonts (KaTeX), and an exception-based API. Rejected for the reasons the repo
replaced its other parsers.

### 2. A math node type in `@sdxc/markdown`

A `math` node and inline parsing of `$…$` in the markdown parser itself. It would make the bare
form possible, but puts a TeX grammar and MathML output into every markdown consumer and diverges
from what GitHub parses. Rejected in favor of tag nodes.

### 3. Leave invalid TeX as code by default

Quietly renders a broken formula as code in production. Rejected as the default; available as
`invalid: "keep"`.

## References

- [MathML Core](https://www.w3.org/TR/mathml-core/)
- [GitHub: Writing mathematical expressions](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions)
- [Unicode Mathematical Alphanumeric Symbols](https://www.unicode.org/charts/PDF/U1D400.pdf)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Current Progress

- [x] `@sdxc/math`: tokenizer, parser, serializer
- [x] `@sdxc/math/markdown`: visitor and HTML tag renderer
- [x] `@sdxc/math/ui`: `MathFormula` and `MathTag`
- [ ] `bun run release:bootstrap @sdxc/math` and the npm trusted publisher
