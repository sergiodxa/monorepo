# ADR-124: Markdown Comments and Attribute Expressions

## Status

**Accepted** - 2026-10-08

## Background

`@sdxc/markdown` (ADR-058) reads GitHub Flavored Markdown plus two dialect extensions: the
`{% … %}` annotation that decorates a block and the registered `<tag>` that creates one. A
document holds `{% $name %}` holes in text, filled by a walk at render time, so one parse
serves every render.

Measured against MDX, three gaps stood out for authors writing component-heavy content:

- There was no way to leave a note in the source. `<!-- … -->` is raw HTML, and raw HTML
  renders escaped, so the note showed up on the page.
- An attribute value could only be a literal string, number or boolean. A tag could not take
  a per-render value (`<video src={% $cdn %} />` failed with _Expected a value for "src"_),
  and a component that needs structured input — a chart's rows, a list of options — had no
  way to receive it.
- Every consumer wrote its own walk to fill variables.

MDX solves the first two with JavaScript: `{/* … */}` is a JS comment inside an expression,
and `{expr}` evaluates arbitrary code. Running author code is what this package exists to
avoid — a parsed document is plain data that can be cached, sent over the wire, and written
back to markdown.

## Decision

### Comments use MDX's spelling and stay in the tree

`{/* … */}` is a comment. Authors who know MDX already type it, and it does not collide with
anything GFM reads: `{` is literal text in CommonMark, and `\{/*` escapes it.

A comment is a `comment` node in both `Markdown.Block` and `Markdown.Inline`, like `tag`:

- On a line of its own, outside a paragraph, it is a block. It may span lines, blank ones
  included, and ends on the line holding `*/}`. It does not interrupt a paragraph, mirroring
  how an inline construct behaves at a line start inside one.
- Inside a line it is inline.
- An unclosed comment is a parse error at its opening, so a missing `*/}` cannot hide the
  rest of a document. Text after `*/}` on the closing line of a multi-line block comment is
  a parse error, so a comment never swallows content.
- An annotation above a comment decorates the block after it.

Comments stay in the tree rather than being dropped at parse time. Every renderer
(`toHTML`, `toRemix`, `toPlainText`) leaves them out, and `Markdown.stringify` writes them
back, so an editor that parses and writes a document keeps the author's notes. The cost is
that an exhaustive switch over node types needs one more case.

### Braced attribute values are data with variable leaves

A braced value holds a small grammar: string, number, `true`, `false`, `null`, `$name`, and
arrays and objects of those, nested, with trailing commas and line breaks allowed. There are
no calls, operators, or member access, so a document stays data and nothing in it executes.
Tags and annotations share the one reader.

```text
<chart data={[1, 2, $three]} options={{ stacked: true, "max-width": $width }} />
## Pricing {% plan={$plan} %}
```

`$name` reads as the same `Variable` node text holes produce, carrying its own position, so
one visitor fills both and a failure points at the place the name was written.

`Markdown.Attributes` becomes `Record<string, AttributeValue>`, where `AttributeValue` is the
union above. An object literal whose `type` is `"variable"` is a parse error, which keeps a
variable node and an object literal distinguishable without a side table.

### A variable defers its tag's schema check

A schema cannot be checked against a value that does not exist yet. A tag whose attributes
hold no variable is validated at parse time as before. A tag holding one keeps its
attributes as written, and the check runs once the value is known.

### `@sdxc/markdown/plugin/variables` fills them

`variables(values, options)` returns a `Markdown.walk` visitor that fills text holes and
attribute values, runs any deferred schema with `options.tags` (keeping what it coerced), and
either fails (default) or keeps a variable it has no value for. A text hole whose value is a
list, object or `null` is a failure.

Plugins without dependencies of their own live under `@sdxc/markdown/plugin/*`; a plugin
that brings a capability with its own weight (highlighting, math, emoji data) ships as its
own package with a `/markdown` subpath, the way `@sdxc/highlight/markdown` does.

## Consequences

### Positive

- Authors keep notes in the source that survive an edit round trip and never render.
- A tag takes per-render values and structured data without the document gaining code.
- A schema check still names the tag's line, whether it runs at parse time or after filling.
- Every consumer fills variables with the same visitor.

### Negative

- `comment` is a new member of both node unions, and `Attributes` values are wider, so
  consumers that switch exhaustively or assume scalar attributes need updating
  (`@sdxc/mail` and `@sdxc/messaging` did).
- A tag whose attributes hold a variable is only checked if the caller runs the `variables`
  visitor with `tags`; rendering it unfilled skips the check.

### Neutral

- `toHTML` writes a structured annotation value into its `data-` attribute as JSON, and an
  unfilled variable as its braced source spelling.

## Alternatives Considered

### 1. Drop comments at parse time

Simpler for every visitor, but `parse` then `stringify` would delete them, which breaks the
package's round-trip guarantee for any editor built on it.

### 2. Validate deferred tags with placeholders

Running the schema with each variable swapped for a placeholder only catches unknown or
missing keys, and reports type errors that the real value would not have.

### 3. Refuse variables in tags that declare a schema

Simplest, but the tags most likely to need a per-render value are exactly the ones with a
schema.

### 4. Record variable paths in a separate field

Attributes stay literal-only and a `bindings` map lists which paths are variables. No
reserved object shape, but every consumer reads two places to know a value.

## Notes

### Open questions

- An allowlist that renders vetted HTML elements (`<details>`, `<sup>`, `<kbd>`) as elements
  rather than escaped text. Inline HTML arrives as separate opening and closing nodes, so this
  belongs in the parser — allowlisted names becoming element nodes — rather than in each
  renderer.
- Inline `$x$` math needs a parser change, because emphasis parsing runs before any visitor.
  ` ```math ` fences and ``$`x`$`` can be handled by a visitor.
