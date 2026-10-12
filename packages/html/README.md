# @sdxc/html

Read a served page: fetch or parse HTML, then query it by role and accessible name.

The answers describe the markup exactly as the server sent it, before any script runs. Roles
follow [HTML-AAM](https://www.w3.org/TR/html-aam-1.0/) and names follow
[AccName](https://www.w3.org/TR/accname-1.2/), so `aria-labelledby`, a `<label>` and an `alt`
resolve the way a browser resolves them, and a query keeps working when a class is renamed.

## Installation

```sh
npm add @sdxc/html
```

Every lookup answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
which installs alongside and provides `isFailure` and `isSuccess`.

## Usage

### Get a page

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/pricing");
if (isFailure(page)) throw page.error;

let doc = page.data;

let fragment = HTML.parse("<p>Hello <strong>world</strong>!</p>"); // markup already in hand
```

`HTML.fetch` asks for `text/html` and parses the body only when that is what arrived, so a
JSON error page served in its place comes back as an `HTMLFetchError`. A fragment parses like a full page.

### Read the head and the text

```typescript
doc.title; // "Pricing"
doc.text; // "Pricing Plans Starter $9 ..."
doc.meta("description"); // success("Plans for every team")
doc.meta("og:title"); // success("Pricing"), name or property
doc.link("canonical"); // success("https://example.com/pricing")
```

### Address an element by role and name

```typescript
let signIn = doc.query({ role: "button", name: "Sign in" });
if (isFailure(signIn)) throw signIn.error;

signIn.data.tag; // "button"
signIn.data.disabled; // false
signIn.data.attributes; // { type: "submit" }

doc.query({ role: "heading", nameContaining: "Plan" });
doc.queryAll({ role: "link" }).length; // 7

doc.query({ role: "link", name: "Profile" }); // failure when two links share the name
doc.query({ role: "link", name: "Profile", at: "last" }); // "first", "last" or a 1-based ordinal
```

Names match the whole whitespace-normalized accessible name, case-sensitively. Several matches
are a failure listing every candidate, until `at` picks one.

### Read forms, tables and definition lists

```typescript
doc.field("email"); // the control with name="email"
doc.field("plan", { value: "annual" }); // one radio of the group
doc.field("intent", { value: "cancel" }); // one submit button of several
doc.cell({ row: 1, column: 2 }); // second cell of the first body row
doc.cell({ row: 1, column: 1, includeHeader: true }); // the header row counts too
doc.definition("Total"); // the <dd> paired with the <dt> "Total"
```

### Narrow to a section

Every match is a scope: the same five lookups run over its descendants, so a name only has to be
unique inside the section.

```typescript
let form = doc.query({ role: "form", name: "Checkout" });
if (isFailure(form)) throw form.error;

form.data.field("email");
form.data.query({ role: "button", name: "Pay" });
form.data.queryAll({ role: "checkbox" }).length; // 3
```

## API

### `HTML.parse(source: string): Result<HTML, HTMLParseError>`

Parses a full page or a fragment. A source with no markup and no text is the failure.

### `HTML.fetch(input: URL | RequestInfo, init?: RequestInit): Promise<Result<HTML, HTMLFetchError | HTMLParseError>>`

Requests a page with the arguments
[`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch) takes, sending
`Accept: text/html` unless `init` sets its own. A rejected request, a non-`ok` status and a
content type other than `text/html` each answer an `HTMLFetchError` naming what arrived.

### `HTML.sanitize(source: string, policy?: HTML.SanitizePolicy): Result<string, HTMLParseError>`

Re-emits markup through an allow-list so it is safe to render inside your own origin:

- Article elements (paragraphs, headings, lists, quotes, code, inline text, links, images,
  figures, `time` and tables) are kept. Scripts, styles, forms and their controls, embedded
  objects, `svg` and `math` are dropped with their content. Every other element, such as `div`,
  is unwrapped and its children kept.
- Attributes are kept per element: `href` and `title` on `a`, `src`, `alt`, `width` and
  `height` on `img`, `colspan`/`rowspan` (capped at 64) on cells, `datetime` on `time`, `cite`,
  and list numbering. Everything else, `on*`, `style`, `class` and `id` included, is dropped.
- URLs resolve against `policy.baseUrl` and survive only as `http:` or `https:` (plus `mailto:`
  outside `src`); an unacceptable URL drops the attribute and keeps the element.
- Links gain `target="_blank" rel="noopener noreferrer nofollow"`; images gain
  `referrerpolicy="no-referrer" loading="lazy"`, and an image declaring a side of 2px or less is
  removed.
- A YouTube or Vimeo `iframe` becomes a link to the video (with its thumbnail for YouTube); any
  other `iframe` is removed.

`policy.report` receives an `HTML.SanitizeReport` once the pass completes.

### `doc.title: string | undefined`

The normalized `<title>` text.

### `doc.text: string`

The visible text, with block boundaries read as spaces and inline elements kept in their
sentence.

### `doc.meta(name: string): Result<string, HTMLNotFoundError>`

The `content` of the first meta tag whose `name` or `property` is `name`.

### `doc.link(rel: string): Result<string, HTMLNotFoundError>`

The `href` of the first `<link>` carrying `rel` as one of its tokens.

### `doc.query(selector?: HTML.Selector): Result<HTML.Element, HTMLQueryError>`

The single element matching the selector: `role` (implicit or explicit), `name` (the whole
accessible name), `nameContaining`, `value`, `at` and `includeHidden`.

### `doc.queryAll(selector?: HTML.Selector): HTML.Element[]`

Every match in document order.

### `doc.field(name: string, options?: HTML.FieldOptions): Result<HTML.Element, HTMLQueryError>`

The input, textarea, select or button with that `name` attribute; `options.value` narrows a
group sharing the name.

### `doc.cell(selector: HTML.CellSelector): Result<HTML.Element, HTMLQueryError>`

The cell at `row` and `column`, both from 1 over body rows; `includeHeader` counts header rows
(those in `<thead>` or made only of `<th>`), and `at` chooses among several tables.

### `doc.definition(term: string, options?: HTML.Options): Result<HTML.Element, HTMLQueryError>`

The `<dd>` paired with the `<dt>` whose normalized text is exactly `term`.

### `HTML.Element`

A match: `tag`, `role`, `name` and `text` (normalized), `value`, `attributes` (as the markup
spells them), `disabled` (including through a disabled `<fieldset>`) and `position`, its 1-based
place among the matches. `value` is an input's `value` attribute, a textarea's text, or the
selected option's value. It carries `query`, `queryAll`, `field`, `cell` and `definition`, scoped
to its descendants.

### `parseDocument(source: string): Result<DOMDocument, HTMLParseError>` from `./document`

The parsed tree, for code that walks a document instead of querying it, sharing the parser the
rest of the package uses. `DOMAttribute`, `DOMNode`, `DOMParent`, `DOMElement` and `DOMDocument`
type it independently of the consumer's DOM globals.

### Errors

- `HTMLParseError`: the source carried no markup.
- `HTMLFetchError`: the request failed, or answered an error status or another content type.
- `HTMLQueryError`: a lookup produced no single answer. `available` lists what the scope holds
  under the same lookup (names under the role, field names, meta keys, terms), and the message
  names them.
- `HTMLNotFoundError`: nothing matched, or `at` pointed past the last match.
- `HTMLAmbiguousMatchError`: several matched; `candidates` holds each as an `HTML.Element`.

### Types

`HTML.Selector`, `HTML.FieldOptions`, `HTML.CellSelector` and `HTML.Options` are the lookup
inputs; every one takes `at` (`HTML.Position`: `"first"`, `"last"` or an ordinal from 1) and
`includeHidden`. Hidden means hidden in the markup: `hidden`, `aria-hidden="true"`,
`<template>`, `<input type="hidden">`, or an inline `display: none` or `visibility: hidden`;
class-based hiding stays visible. `HTML.SanitizePolicy` holds `baseUrl` and `report`;
`HTML.SanitizeReport` counts `removedElements`, `removedAttributes`, `droppedUrls` and `pixels`,
plus `durationMs`.

## Pattern: Checking A Page As Served

An SEO or no-JavaScript requirement is about the markup the server sent, so assert on it
directly.

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/pricing");
if (isFailure(page)) throw page.error;

let doc = page.data;
let problems: string[] = [];

for (let key of ["description", "og:title", "og:image"]) {
	let tag = doc.meta(key);
	if (isFailure(tag)) problems.push(tag.error.message);
	// No meta tag "og:image" in the document. Present: description, og:title.
}

if (isFailure(doc.link("canonical"))) problems.push("Missing canonical link");
if (isFailure(doc.query({ role: "heading", name: "Pricing" }))) problems.push("Missing heading");
```

## Pattern: Pulling Records Out Of A Section

Narrow to a region once, then read its rows and figures against that scope.

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/portfolio");
if (isFailure(page)) throw page.error;

let panel = page.data.query({ role: "region", name: "Holdings" });
if (isFailure(panel)) throw panel.error;

let holdings: { ticker: string; share: string }[] = [];

for (let row of panel.data.queryAll({ role: "row" })) {
	let [ticker, share] = row.queryAll({ role: "cell" });
	if (ticker && share) holdings.push({ ticker: ticker.text, share: share.text });
}

let total = panel.data.definition("Total");
if (isFailure(total)) throw total.error; // the message lists the terms the panel carries

total.data.text; // "$12,400"
```

A `<section>` takes the `region` role when it has an accessible name, such as one from
`aria-labelledby`.

## Pattern: Reporting A Lookup That Missed

Both failures say what the page offered instead, so a report can suggest the fix.

```typescript
import { HTML, HTMLAmbiguousMatchError, HTMLNotFoundError } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = HTML.parse(source);
if (isFailure(page)) throw page.error;

let result = page.data.query({ role: "link", name: "Profile" });

if (isFailure(result)) {
	if (result.error instanceof HTMLAmbiguousMatchError) {
		let options = result.error.candidates.map(
			(candidate) => `at: ${candidate.position} → ${candidate.attributes.href}`,
		);
		throw new Error(`Pick one link: ${options.join(", ")}`);
	}

	if (result.error instanceof HTMLNotFoundError) {
		throw new Error(`No "Profile" link. Links present: ${result.error.available.join(", ")}`);
	}
}
```

## Pattern: Rendering Someone Else's Article

Sanitize fetched markup before rendering it beside your own content, resolving its relative URLs
against the page it came from; `report` counts what the pass removed without exposing the document.

```typescript
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let url = "https://publisher.com/posts/one";
let response = await fetch(url);

let report: HTML.SanitizeReport | undefined;

let clean = HTML.sanitize(await response.text(), {
	baseUrl: response.url || url,
	report: (counts) => (report = counts), // { removedElements, removedAttributes, droppedUrls, pixels, durationMs }
});
if (isFailure(clean)) throw clean.error;

clean.data; // '<h1>Title</h1><p>A <a href="https://publisher.com/about" target="_blank" ...>link</a>.</p>'
```

Serve the page that renders it with a Content-Security-Policy as a second line of defense.

## Pattern: Walking The Tree

`./document` hands over the parsed tree for work that visits every node, such as collecting
links.

```typescript
import { parseDocument } from "@sdxc/html/document";
import { isFailure } from "@sdxc/result";

let document = parseDocument(source);
if (isFailure(document)) throw document.error;

let hrefs = Array.from(document.data.body.querySelectorAll("a[href]")).map(
	(anchor) => new URL(anchor.getAttribute("href") ?? "", "https://example.com/").href,
);
```

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
		"@sdxc/html": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
