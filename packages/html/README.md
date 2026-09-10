# @sdxc/html

Parse a string of HTML into a document, then query it by role and accessible name.

## Overview

A response body is already in hand after an HTTP call, and the questions asked of it —
does a heading with this name exist, what is the `og:title`, what does this table cell
say — are answerable from the markup alone. This package answers them without a
browser: no process, no profile, no page load, and the answers describe the page as
served rather than the page after hydration.

Addressing an element by role and accessible name is what keeps a query stable: it
survives a renamed class and fails when a button is relabelled, which is the opposite
of what a CSS selector does. Role mapping follows HTML-AAM and names follow AccName,
so `aria-labelledby`, a `<label>` associated by `for` or by containment, and an `alt`
all resolve the way a browser resolves them.

Reads only. There is nothing to click, nothing to type into, and no layout — so no
notion of what is scrolled into view.

## Usage

### Assert on a served page

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let response = await fetch("https://example.com/portfolios");
let document = HTML.parse(await response.text());
if (isFailure(document)) throw document.error;

let doc = document.data;

doc.title; // "Invest your money"
doc.meta("og:title"); // success("Invest your money")
doc.link("canonical"); // success("https://example.com/portfolios")

let signIn = doc.query({ role: "button", name: "Sign in" });
if (isFailure(signIn)) throw signIn.error;
signIn.data.disabled; // false
```

### Read a form, a table and a definition list

```typescript
doc.field("tip"); // the input named "tip"
doc.field("cadence", { value: "annual" }); // one radio of the group
doc.cell({ row: 1, column: 2 }); // second cell of the first body row
doc.definition("Total"); // the <dd> paired with the <dt> "Total"
```

### Choose among several matches

```typescript
doc.query({ role: "link", name: "Profile" });
// failure(HTMLAmbiguousMatchError): 2 matches for a link named "Profile"

doc.query({ role: "link", name: "Profile", at: "first" });
doc.query({ role: "link", name: "Profile", at: 2 });
doc.query({ role: "link", name: "Profile", at: "last" });
```

## Matching rules

These are the package's semantics, so every caller gets the same answers.

1. **Names match exactly**, on the whitespace-normalized accessible name: runs of
   whitespace — U+00A0 and the other Unicode spaces included — collapse to one ASCII
   space and the ends are trimmed. Comparison is case-sensitive; `nameContaining` asks
   for a substring.
2. **Several matches is a failure**, carrying every candidate with its position.
   `at: "first"`, `at: "last"` and an ordinal choose one; ordinals count from 1.
3. **Visibility is markup-level.** `hidden`, `aria-hidden="true"`, a `<template>`, an
   `<input type="hidden">`, and `display: none` or `visibility: hidden` in an inline
   `style` attribute hide an element. Stylesheets stay unread, so a class-based
   `.sr-only` remains visible here; `includeHidden: true` reaches the rest.
4. **`field` addresses any element carrying a `name` attribute** — input, textarea,
   select, button — and `value` narrows a group sharing one name, which is how a radio
   group and a submit-intent button are addressed.
5. **Rows and columns count from 1 over body rows**, header rows joining the count
   only under `includeHeader: true`.
6. **`meta` matches `name` or `property`**, so `description` and `og:title` are one
   lookup, and **`link` matches one token of `rel`**, since `rel` is a token list.

## API

### `HTML.parse(source: string): Result<HTML, HTMLParseError>`

Parses a full page or a fragment of one. A fragment is given the document skeleton it
lacks, so a partial response is queried the same way a full page is. A source carrying
no markup and no text is the failure.

### `doc.title: string | undefined`

The `<title>` text, normalized, absent when the page carries no title.

### `doc.text: string`

Everything a reader would see, with what markup hides left out. Block boundaries
become a space and an inline element stays inside its sentence, so `<p>Hello
<strong>world</strong>!</p>` reads as `Hello world!`.

### `doc.meta(name: string): Result<string, HTMLNotFoundError>`

The `content` of the meta tag whose `name` or `property` is `name`.

### `doc.link(rel: string): Result<string, HTMLNotFoundError>`

The `href` of the first link carrying `rel` as one of its tokens.

### `doc.query(selector?: HTML.Selector): Result<HTML.Element, HTMLQueryError>`

One element addressed by role and name.

**Parameters:**

- `selector.role`: The ARIA role, implicit or explicit — `button`, `link`, `textbox`,
  `heading`, `row`, `cell`, `term`
- `selector.name`: The whole accessible name
- `selector.nameContaining`: A part of the accessible name
- `selector.value`: The control's value, as the markup spells it
- `selector.at`: `"first"`, `"last"` or a 1-based ordinal, where several match
- `selector.includeHidden`: Reaches what markup hides

### `doc.queryAll(selector?: HTML.Selector): HTML.Element[]`

Every match, in document order, which is how a caller counts matches or reads a
repeated element.

### `doc.field(name: string, options?: HTML.FieldOptions): Result<HTML.Element, HTMLQueryError>`

The control carrying that `name` attribute, narrowed by `options.value` when a group
shares one name.

### `doc.cell(selector: HTML.CellSelector): Result<HTML.Element, HTMLQueryError>`

The cell at `row` and `column`, both counted from 1. `includeHeader` counts header
rows, and `at` chooses among several tables.

### `doc.definition(term: string, options?: HTML.Options): Result<HTML.Element, HTMLQueryError>`

The definition paired with the term whose text matches exactly.

### Types

#### `HTML.Element`

```typescript
interface Element {
	tag: string;
	role?: string;
	name: string;
	text: string;
	value?: string;
	attributes: Record<string, string>;
	disabled: boolean;
	position: number;
}
```

`attributes` and `value` carry the markup's own spelling; `name` and `text` are
normalized; `position` is the element's 1-based position among the matches the lookup
considered.

### Errors

#### `HTMLParseError`

A source carrying no markup.

#### `HTMLQueryError`

A lookup that produced no single answer. `available` lists the identities the document
does hold under the same lookup — the accessible names under a role, the field names,
the meta tags, the terms — so a report names them.

#### `HTMLNotFoundError`

Nothing answered the lookup, an ordinal past the last match included.

#### `HTMLAmbiguousMatchError`

Several elements answered. `candidates` carries each of them with its position.

## Pattern: naming the ambiguity in a failure report

`HTMLAmbiguousMatchError` carries what a person needs to fix the query, so a report
prints the candidates rather than the count.

```typescript
import { HTML, HTMLAmbiguousMatchError } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let result = doc.query({ role: "link", name: "Profile" });

if (isFailure(result) && result.error instanceof HTMLAmbiguousMatchError) {
	for (let candidate of result.error.candidates) {
		console.log(candidate.position, candidate.tag, candidate.attributes.href);
	}
}
```

## Pattern: checking a page renders without JavaScript

Parsing the response body answers what an SEO or no-JavaScript requirement is actually
about: the markup the server sent.

```typescript
import { HTML } from "@sdxc/html";
import { isSuccess } from "@sdxc/result";

let document = HTML.parse(await response.text());
if (!isSuccess(document)) throw document.error;

let heading = document.data.query({ role: "heading", name: "Portfolios" });
let canonical = document.data.link("canonical");
```

## Related Packages

- [`@sdxc/result`](/packages/result) - Result type for explicit error handling
- [`@sdxc/xml`](/packages/xml) - Parser and serializer for well-formed documents

## Tips

1. **Parse once, query many times** - Every lookup re-reads the document, so hold the
   instance instead of passing the source string around.
2. **Reach for a role before a name alone** - An accessible name belongs to an element
   and to every ancestor whose text it is, so a name-only lookup is usually ambiguous.
3. **Read `available` on a failure** - It lists what the page does carry under the same
   lookup, which turns a miss into the name to use.
4. **A class-based `.sr-only` stays visible** - Stylesheets go unread here; a query
   that needs the rendered answer needs a browser.
5. **`value` reads the markup** - The `value` attribute of an input, the text of a
   textarea, and the option a select marks as selected.
