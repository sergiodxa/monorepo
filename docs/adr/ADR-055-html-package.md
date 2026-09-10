# ADR-055: HTML Package

## Status

**Implemented** - 2026-09-10

## Background

The repo reads several document formats through dedicated packages — `@sdxc/xml`
for element trees, `@sdxc/rss` and `@sdxc/atom` for feeds, `@sdxc/yaml` for
configuration. HTML has no such package, so anything that needs to look inside a
served page either drives a real browser or reaches for a regular expression.

A served page is worth querying without a browser. A response body is already in
hand after an HTTP call, and the questions asked of it — does a heading with this
name exist, what is the `og:title`, what does this table cell say — are answerable
from the markup alone. Driving a browser to answer them costs a process, a profile,
and a page load each time, and it answers a subtly different question: the page
after hydration rather than the page as served.

## Context

### HTML is not XML, so `@sdxc/xml` cannot host it

`@sdxc/xml` parses well-formed documents. HTML's parsing algorithm exists precisely
because documents in the wild are not:

| Construct                           | What a conforming HTML parser does        |
| ----------------------------------- | ----------------------------------------- |
| `<p>one<p>two`                      | closes the first `<p>` implicitly         |
| `<table><tr><td>` with no `<tbody>` | inserts `<tbody>`                         |
| Text directly inside `<table>`      | foster-parents it before the table        |
| `<script>`, `<style>`, `<textarea>` | raw text, no markup interpretation inside |
| `<br/>`, `<img>`                    | void elements, never closed               |
| Unquoted and bare attributes        | valid                                     |

A parser that rejects any of these rejects most real pages. The tree-construction
algorithm is the format, not an error-tolerance layer bolted onto XML.

### Addressing a document by role and accessible name is two specifications

Answering "is there a button named Sign in" requires mapping elements to ARIA roles
(HTML-AAM) and computing accessible names (AccName). Neither is a heuristic:
`aria-labelledby` points at arbitrary other elements, a `<label>` associates by `for`
or by containment, an `<img>` names itself by `alt`, and everything else falls back to
its subtree's text. Getting this wrong produces a query that works on the pages it was
written against and silently misses on others.

### Querying and interacting are separable

A static document supports every read a live page does — find by role and name, read a
value, read an attribute, count matches, pair a term with its definition. It supports
no writes at all: nothing to click, nothing to type into, no layout and therefore no
notion of what is scrolled into view.

## Decision

A new workspace package **`@sdxc/html`**: parse a string of HTML into a document, then
query that document. Read-only, no interaction, no layout.

### Shape

```
let doc = HTML.parse(source)          // Result<Document, ParseError>

doc.title                              // <title> text
doc.meta("og:title")                   // matches name OR property
doc.link("canonical")                  // matches a token of rel

doc.query({ role: "button", name: "Sign in" })
doc.queryAll({ role: "link", name: "Profile" })
doc.field("tip")                        // by name attribute
doc.cell({ row: 1, column: 2 })
doc.definition("Total")                 // the <dd> paired with a <dt>
```

Queries return elements carrying their role, accessible name, value, attributes and
text — enough for a caller to assert on without re-querying.

### Matching rules the package owns

These are the package's semantics, not a caller's convention, so every consumer gets
the same answers.

1. **Names match exactly**, on the whitespace-normalized accessible name: runs of
   whitespace — including U+00A0 and other Unicode spaces — collapse to one ASCII
   space and the ends are trimmed. Comparison is case-sensitive. A substring match is
   requested explicitly.
2. **Several matches is an error**, carrying every candidate with its position, so a
   caller can report them. Positional selection (`first`, `last`, an ordinal) is how a
   caller opts into one of several. Ordinals are 1-based.
3. **Visibility is markup-level.** `hidden`, `aria-hidden="true"`, `<template>`, and
   `display: none` or `visibility: hidden` in an inline `style` attribute hide an
   element. A stylesheet is not consulted, so a class-based `.sr-only` stays visible to
   this package. The gap is stated rather than approximated.
4. **`field` addresses any element with a `name` attribute** — input, textarea, select,
   button — and a `value` narrows a group that shares one name, which is how radio
   groups and submit-intent buttons are addressed.
5. **Table rows and columns are 1-based over body rows**, header rows excluded unless
   the caller asks for them.
6. **`meta` matches `name` or `property`**, so `description` and `og:title` are one
   lookup. `link` matches when the requested value is a token of `rel`, since `rel`
   is a token list.

### Built on a conforming parser, owning the query layer

Tree construction and accessible-name computation are delegated — `linkedom` for the
document, `dom-accessibility-api` for names. The query semantics above live in this
package, so the dependencies stay an implementation choice: a different parser changes
no caller's results.

### Out of scope

Serialization, mutation, CSS selectors, and layout. A package that reads a document to
answer questions about it has no use for the first three, and cannot answer questions
that need the fourth.

## Consequences

### Positive

- A served page is assertable from a response body, with no browser and no process.
- Role-and-name addressing gets one implementation and one set of rules, rather than
  one per consumer.
- Assertions run against the page as served, which is the thing an SEO or
  no-JavaScript requirement is actually about.

### Negative

- The repo takes on `linkedom` and `dom-accessibility-api`, its first dependencies for
  document handling beyond hand-written parsers.
- Class-based hiding is invisible, so a query can match text a person never sees. The
  rule is documented, and a caller that needs the real answer needs a browser.
- Accessible-name computation is a moving target as HTML-AAM evolves; conformance is
  as good as the delegated implementation.

### Neutral

- Every query re-reads the parsed document, so a caller parses once and queries many
  times rather than passing the source string around.

## Alternatives Considered

**Extend `@sdxc/xml`.** Its parser requires well-formed input, and HTML's tree
construction — implied tags, foster parenting, raw-text elements — is the format
itself. Adding it would mean a second parser inside a package named for the other one.

**A CSS-selector API over `cheerio`.** Selectors address markup structure, which is
what role-and-name addressing exists to avoid: a selector breaks when a class is
renamed and passes when a button is relabelled. It also carries no accessible-name
computation, so the useful queries would still need building.

**Write the parser.** The HTML tree-construction algorithm is long, well-specified and
already implemented correctly several times over; a fresh implementation would be a
liability with no differentiator.

## References

- HTML Standard, tree construction — the parsing algorithm this package delegates.
- HTML-AAM and AccName — the role mapping and name computation the queries depend on.
- [ADR-051](./ADR-051-atom-package.md) — the format-package shape this follows.
