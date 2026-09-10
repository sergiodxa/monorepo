# @sdxc/html

Read a served page: fetch or parse HTML, then query it by role and accessible name.

A response body is already in hand after an HTTP call, and the questions asked of it —
does a heading with this name exist, what is the `og:title`, what does this table cell
say — are answerable from the markup alone. This package requests the page, or takes a
body you already hold, and answers them in the same process, so its answers describe
the page exactly as the server sent it.

Addressing an element by role and accessible name is what keeps a query stable: it
survives a renamed class and fails when a button is relabelled, which is the change a
person reading the page would notice too. Roles follow
[HTML-AAM](https://www.w3.org/TR/html-aam-1.0/) and names follow
[AccName](https://www.w3.org/TR/accname-1.2/), so `aria-labelledby`, a `<label>`
associated by `for` or by containment, and an `alt` all resolve the way a browser
resolves them.

Every read a live page supports works here: find by role and name, read a value or an
attribute, count matches, pair a term with its definition. Every match is a scope in
turn, so a lookup narrows to a section and then reads what is inside it. A question
whose answer comes from layout — what is scrolled into view — belongs to a browser.

## Installation

```bash
npm add @sdxc/html
```

Every lookup reports its outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside
this package and is where `isFailure` and `isSuccess` come from.

## Usage

### Get A Page

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/portfolios");
if (isFailure(page)) throw page.error;

let doc = page.data;
```

`HTML.fetch` asks for `text/html` and reads the response when that is what arrived, so
a login redirect or a JSON error page comes back as an `HTMLFetchError` naming what the
server sent. Markup you already hold goes through `HTML.parse(source)` instead, and
both answer with the same document.

### Read The Head

```typescript
doc.title; // "Invest your money"
doc.meta("description"); // success("A page about investing")
doc.meta("og:title"); // success("Invest your money")
doc.link("canonical"); // success("https://example.com/portfolios")
```

### Address An Element

```typescript
let signIn = doc.query({ role: "button", name: "Sign in" });
if (isFailure(signIn)) throw signIn.error;

signIn.data.tag; // "button"
signIn.data.disabled; // false
signIn.data.attributes; // { type: "submit" }

doc.queryAll({ role: "link" }).length; // 7
doc.query({ role: "heading", nameContaining: "Portfolio" });
```

### Read A Form, A Table And A Definition List

```typescript
doc.field("tip"); // the input named "tip"
doc.field("cadence", { value: "annual" }); // one radio of the group
doc.field("intent", { value: "save" }); // the submit-intent button
doc.cell({ row: 1, column: 2 }); // second cell of the first body row
doc.definition("Total"); // the <dd> paired with the <dt> "Total"
```

### Narrow To A Section

Every match is a scope: the five lookups run again over the element's own descendants,
so a name only has to be unique inside the section you narrowed to.

```typescript
let form = doc.query({ role: "form", name: "Donate" });
if (isFailure(form)) throw form.error;

form.data.field("tip"); // the input named "tip", inside this form
form.data.query({ role: "button", name: "Save" });
form.data.queryAll({ role: "checkbox" }).length; // 3
form.data.definition("Total"); // the <dd> of a <dl> this form carries
```

### Choose Among Several Matches

```typescript
doc.query({ role: "link", name: "Profile" });
// failure: 2 matches for a link named "Profile": #1 <a> "Profile", #2 <a> "Profile"

doc.query({ role: "link", name: "Profile", at: "first" });
doc.query({ role: "link", name: "Profile", at: 2 });
doc.query({ role: "link", name: "Profile", at: "last" });
```

## Matching Rules

These semantics belong to the package, so every caller's lookup answers the same way.

1. **Names match exactly**, on the whitespace-normalized accessible name: runs of
   whitespace — U+00A0 and the other Unicode spaces included — collapse to one ASCII
   space and the ends are trimmed. Comparison is case-sensitive; `nameContaining` asks
   for a substring.
2. **Several matches is a failure**, carrying every candidate with its position.
   `at: "first"`, `at: "last"` and an ordinal choose one; ordinals count from 1.
3. **Visibility is markup-level.** `hidden`, `aria-hidden="true"`, a `<template>`, an
   `<input type="hidden">`, and `display: none` or `visibility: hidden` in an inline
   `style` attribute hide an element. Visibility comes from the markup alone, so a
   class-based `.sr-only` remains visible here; `includeHidden: true` reaches the rest.
4. **`field` addresses any element carrying a `name` attribute** — input, textarea,
   select, button — and `value` narrows a group sharing one name, which is how a radio
   group and a submit-intent button are addressed.
5. **Rows and columns count from 1 over body rows**, header rows joining the count
   only under `includeHeader: true`. Columns count the cells the row carries.
6. **`meta` matches `name` or `property`**, so `description` and `og:title` are one
   lookup, and **`link` matches one token of `rel`**, since `rel` is a token list.

## API

### `HTML.parse(source: string): Result<HTML, HTMLParseError>`

Parses a full page or a fragment of one. A fragment is given the document skeleton it
lacks, so a partial response is queried the same way a full page is. A source carrying
no markup and no text is the failure.

### `HTML.fetch(input, init?): Promise<Result<HTML, HTMLFetchError | HTMLParseError>>`

Requests a page and parses it. `input` and `init` are what
[`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch) takes — a URL,
a string, or a `Request` — and an `Accept` header of your own is kept, `text/html`
standing in otherwise.

The body is parsed when the response arrives `ok` and its content type is `text/html`.
A rejected request, an error status, and a body served under another content type each
come back as an `HTMLFetchError` naming what arrived, so a caller holds a parsed page
or the reason it could not be read.

### `doc.title`

The `<title>` text, normalized, `undefined` when the page carries no title.

### `doc.text`

The text a reader would see, drawn from the elements markup keeps visible. Block
boundaries become a space and an inline element stays inside its sentence, so
`<p>Hello <strong>world</strong>!</p>` reads as `Hello world!`.

### `doc.meta(name: string): Result<string, HTMLNotFoundError>`

The `content` of the meta tag whose `name` or `property` is `name`.

### `doc.link(rel: string): Result<string, HTMLNotFoundError>`

The `href` of the first link carrying `rel` as one of its tokens.

### `doc.query(selector?: HTML.Selector): Result<HTML.Element, HTMLQueryError>`

One element addressed by role and name.

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

### `doc.field(name, options?): Result<HTML.Element, HTMLQueryError>`

The control carrying that `name` attribute, narrowed by `options.value` when a group
shares one name. `options` also takes `at` and `includeHidden`.

### `doc.cell(selector: HTML.CellSelector): Result<HTML.Element, HTMLQueryError>`

The cell at `selector.row` and `selector.column`, both counted from 1.
`includeHeader` counts header rows, and `at` chooses among several tables.

### `doc.definition(term, options?): Result<HTML.Element, HTMLQueryError>`

The definition paired with the term whose text matches exactly.

### `HTML.Element`

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

	query(selector?: HTML.Selector): Result<HTML.Element, HTMLQueryError>;
	queryAll(selector?: HTML.Selector): HTML.Element[];
	field(name: string, options?: HTML.FieldOptions): Result<HTML.Element, HTMLQueryError>;
	cell(selector: HTML.CellSelector): Result<HTML.Element, HTMLQueryError>;
	definition(term: string, options?: HTML.Options): Result<HTML.Element, HTMLQueryError>;
}
```

`attributes` and `value` carry the markup's own spelling: the `value` attribute of an
input, the text of a textarea, and the value of the option a select marks as selected.
`name` and `text` are normalized, and `position` is the element's 1-based position
among the matches the lookup considered.

The five lookups are the document's own, run again over the element's descendants:
every match is a scope. They take the same selectors, follow the same matching rules,
and fail the same way, and a failure's `available` lists what the scope holds.

### Errors

`HTMLParseError` is a source carrying no markup.

`HTMLFetchError` is a page that arrived as something else: a rejected request, an error
status, or a body served under another content type. Its message names what came back.

`HTMLQueryError` is a lookup that produced no single answer. Its `available` lists the
identities the document does hold under the same lookup — the accessible names under a
role, the field names, the meta tags, the terms — so a report can name them. Two
subclasses say which case it was: `HTMLNotFoundError`, where nothing answered, an
ordinal past the last match included, and `HTMLAmbiguousMatchError`, where several did,
carrying each of them with its position in `candidates`.

## Pattern: Naming The Ambiguity In A Failure Report

`HTMLAmbiguousMatchError` carries what a person needs to fix the query, so a report
prints the candidates with their positions.

```typescript
import { HTML, HTMLAmbiguousMatchError } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/portfolios");
if (isFailure(page)) throw page.error;

let result = page.data.query({ role: "link", name: "Profile" });

if (isFailure(result) && result.error instanceof HTMLAmbiguousMatchError) {
	for (let candidate of result.error.candidates) {
		console.log(candidate.position, candidate.tag, candidate.attributes.href);
	}
}
```

## Pattern: Asserting On The Page As Served

Parsing the response body answers what an SEO or no-JavaScript requirement is actually
about: the markup the server sent, before any hydration.

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/portfolios");
if (isFailure(page)) throw page.error;

let doc = page.data;

let heading = doc.query({ role: "heading", name: "Portfolios" });
let canonical = doc.link("canonical");
let image = doc.meta("og:image");

if (isFailure(image)) {
	console.log(image.error.message);
	// No meta tag "og:image" in the document. Present: description, og:title.
}
```

## Pattern: Reading A Table From The Response Body

Row and column addressing counts the rows a reader counts, so a summary table is
assertable straight from the response body.

```typescript
let share = doc.cell({ row: 2, column: 2 });
if (isFailure(share)) throw share.error;
share.data.text; // "60%"

let header = doc.cell({ row: 1, column: 1, includeHeader: true });
let total = doc.definition("Total");
```

## Pattern: Pulling Data Out Of A Section

Narrowing first is how a page becomes records: address the section once, then read its
rows and its figures against that scope, where a plain name like `Total` is already
unique.

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/portfolios");
if (isFailure(page)) throw page.error;

let panel = page.data.query({ role: "region", name: "Holdings" });
if (isFailure(panel)) throw panel.error;

let holdings: { ticker: string; share: string }[] = [];

for (let row of panel.data.queryAll({ role: "row" })) {
	let [ticker, share] = row.queryAll({ role: "cell" });
	if (ticker && share) holdings.push({ ticker: ticker.text, share: share.text });
}

holdings; // [{ ticker: "VTI", share: "60%" }, { ticker: "BND", share: "40%" }]

let total = panel.data.definition("Total");
if (isFailure(total)) throw total.error;

total.data.text; // "$12,400"
```

A scoped lookup reports its scope, so a miss on that last line names the terms the
panel itself carries.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/html": "2026.9.10"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
