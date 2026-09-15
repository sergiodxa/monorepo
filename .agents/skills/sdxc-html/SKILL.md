---
name: sdxc-html
description: "@sdxc/html reads a served page: `HTML.fetch` or `HTML.parse` gives a document you query by ARIA role and accessible name — `query`, `queryAll`, `field`, `cell`, `definition`, `meta`, `link` — every lookup answering with a `Result`. Use when asserting on server-rendered markup before hydration, checking SEO tags or headings on a deployed page, scraping a table or a section into records, or turning an ambiguous match into a report naming every candidate."
---

# @sdxc/html

A response body is already in hand after an HTTP call, and the questions asked of it — does a heading with this name exist, what is the `og:title`, what does this table cell say — are answerable from the markup alone. `HTML.fetch(input, init?)` requests a page and parses it, `HTML.parse(source)` takes markup you already hold, and both answer with the same document. Addressing an element by role and accessible name is what keeps a query stable: roles follow HTML-AAM and names follow AccName, so `aria-labelledby`, a `<label>` associated by `for` or by containment, and an `alt` all resolve the way a browser resolves them. It runs on any fetch runtime, in-process, with no browser.

Full API, options and examples: [packages/html/README.md](packages/html/README.md)

## When to reach for it

- Asserting on the markup a server actually sent, which is what an SEO or no-JavaScript requirement is about.
- Checking a deployed page's headings, canonical link and Open Graph tags without launching a browser.
- Pulling a table or a labelled section out of a response body and into records.
- Reading a form's controls — a radio group, a submit-intent button — by the `name` attribute and value the markup spells.
- Producing a failure report that names the candidates, or the identities the document does hold, when a lookup found the wrong number of matches.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/html": "workspace:*" } }
```

```ts
import { HTML } from "@sdxc/html";
import { isFailure } from "@sdxc/result";

let page = await HTML.fetch("https://example.com/portfolios");
if (isFailure(page)) throw page.error;

let doc = page.data;

let signIn = doc.query({ role: "button", name: "Sign in" });
if (isFailure(signIn)) throw signIn.error;

signIn.data.tag; // "button"
signIn.data.attributes; // { type: "submit" }
```

## Suggestions

- Narrow before you read. Every match is a scope: the five lookups (`query`, `queryAll`, `field`, `cell`, `definition`) run again over an element's own descendants, so address the section once and a plain name like `Total` is already unique inside it — and a miss names only what that scope holds.
- Several matches is a failure, not a silent first-match. Resolve it with `at: "first"`, `at: "last"` or a 1-based ordinal, or tighten the name.
- Names match exactly on the whitespace-normalized accessible name and comparison is case-sensitive; `nameContaining` is the substring form.
- Visibility here is markup-level only — `hidden`, `aria-hidden="true"`, `<template>`, `<input type="hidden">`, and inline `display: none`/`visibility: hidden`. A class-based `.sr-only` still counts as visible; `includeHidden: true` reaches the rest.
- `HTML.fetch` parses only when the response is `ok` and its content type is `text/html`, so a login redirect or a JSON error page comes back as an `HTMLFetchError` naming what arrived rather than as an empty document. An `Accept` header of your own is kept.
- Branch on `HTMLNotFoundError` versus `HTMLAmbiguousMatchError` to tell "nothing answered" from "several did"; the latter carries every `candidate` with its `position`, and both carry `available`.
- Anything whose answer comes from layout — what is scrolled into view — belongs to a browser, not here.

## Related

- `@sdxc/result` — every lookup answers with a `Result`, and is where `isFailure`/`isSuccess` come from; skill `sdxc-result`
