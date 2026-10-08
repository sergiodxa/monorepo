---
title: Fill markdown templates with variables
description: Write one markdown document with holes for per-render values, fill them per tenant, plan or locale, and keep the template round-tripping through an editor.
section:
    title: Content & feeds
    order: 7
order: 9
lastUpdated: 2026-10-08
---

Onboarding pages, plan summaries and transactional copy say the same thing to every reader
with a few values changed: the product's name, the plan a workspace pays for, the link to its
billing page. [`@sdxc/markdown`](/api/markdown) reads those values as variables. The parser
keeps each one as a node in the tree, and the `variables` plugin fills them in when a page
renders, so one parsed document serves every reader and the file an author edits stays the
template.

This guide builds on [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline),
which covers the options object, the loader and the route.

```bash
npm add remix @sdxc/markdown @sdxc/result
```

## Write the holes into the document

A variable is a name after a `$`. In text it sits inside `{% … %}`, and in an attribute value
inside braces. A name may continue as a dotted path whose segments are property names or array
indexes, so `$plan.seats` reads a field and `$plans.0` the first item of a list.

```text {% title="content/onboarding/welcome.md" %}
Welcome to {% $product %}. Your {% $plan.name %} plan includes {% $plan.seats %} seats.

<pricing plans={$plans} current={$plan.id} />

Invoices and receipts live on <a href={$links.billing}>your billing page</a>.

{/* The seat count comes from the plan; never write it down here. */}
```

An attribute value takes any data a braced value can hold, variables included at any depth:

| Written                                            | Reads as                                 |
| -------------------------------------------------- | ---------------------------------------- |
| `title="Plans"`                                    | the string                               |
| `wide`                                             | `true`                                   |
| `count={3}`, `open={false}`, `empty={null}`        | the number, boolean or `null`            |
| `src={$cdn}`, `price={$plan.price}`                | a variable, filled when the page renders |
| `data={[1, 2, $three]}`                            | an array                                 |
| `options={{ stacked: true, "max-width": $width }}` | an object                                |

Arrays and objects nest, take a trailing comma and may span lines. Braces hold data and names
alone: `$a.b[0]` and `$a.b()` stay text, and so does a path ending in a dot.

The tag and the allowlisted element in that file are declared the usual way. A tag's attribute
schema describes the values it receives once filled, so `plans` is an array of plan objects
even though the source writes a variable:

```typescript {% title="app/content/schema.ts" %}
import type { Markdown } from "@sdxc/markdown";

import * as s from "remix/data-schema";

const PLAN = s.object({ id: s.string(), name: s.string(), price: s.number() });

export const MARKDOWN_OPTIONS = {
	tags: {
		pricing: {
			content: "none",
			attributes: s.object({ plans: s.array(PLAN), current: s.string() }),
		},
	},
	html: { a: ["href"] },
} satisfies Markdown.Options;
```

## Fill the values per render

`variables(values, options)` returns a visitor for `Markdown.walk`. A text hole becomes a
`text` node holding the value, and an attribute takes the value itself, arrays and objects
included. Pass the options the document was parsed with, so the plugin can run the checks that
were waiting on these values:

```typescript {% title="app/content/onboarding.ts" %}
import { Markdown } from "@sdxc/markdown";
import { variables } from "@sdxc/markdown/plugin/variables";

import { MARKDOWN_OPTIONS } from "~/app/content/schema";

interface Workspace {
	slug: string;
	plan: { id: string; name: string; seats: number };
}

const PLANS = [
	{ id: "starter", name: "Starter", price: 9 },
	{ id: "team", name: "Team", price: 29 },
];

export function fillOnboarding(document: Markdown.Document, workspace: Workspace) {
	return Markdown.walk(
		document,
		variables(
			{
				product: "Acme",
				plan: { ...workspace.plan },
				plans: PLANS,
				links: { billing: `/w/${workspace.slug}/billing` },
			},
			MARKDOWN_OPTIONS,
		),
	);
}
```

The values are read when the walk runs, so the same parsed document is filled again for the
next workspace, and a block holding no variable is handed back as the same object. A parsed
document is plain JSON, which makes it a value you can cache by file and fill per request.

A dotted path is filled one segment at a time: a name reads an object's own property and a
number indexes an array, so `$plan.seats` reads `10` from the plan above. A text hole takes a
string, a number or a boolean; a list, an object or `null` there fails the walk, since none of
them has a text form.

Fill variables before the other [markdown plugins](/docs/content-and-feeds/markdown-plugins)
run. `variables` handles nearly every block type, so it takes a walk of its own, and the passes
after it then read the final text and URLs: `links()` resolves the billing link once it is a
URL, and `typography()` sets the quotes in a product name that holds one.

## Let the schemas wait for their values

A tag's schema runs at parse time when every attribute is literal. When an attribute holds a
variable, anywhere inside an array or object included, the check waits: `variables` runs the
schema once the names are filled in, and the tag keeps the schema's output, coercions included.
A value that fails it fails the walk at the tag's position, with a `MarkdownParseError` carrying
the schema's issues as the failure's `cause`.

Allowlisted elements are held to the same rules at fill time. An `href` or `src` filled from a
variable takes only relative, `http`, `https`, `mailto` and `tel` URLs, so a value of
`javascript:alert(1)` fails the walk at the `<a>` the way it would fail the parse had the author
written it.

```typescript {% title="app/content/onboarding-page.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { MarkdownParseError } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

import { fillOnboarding } from "~/app/content/onboarding";

export function onboardingPage(
	document: Markdown.Document,
	workspace: Parameters<typeof fillOnboarding>[1],
) {
	let filled = fillOnboarding(document, workspace);
	if (isFailure(filled)) {
		let { cause, position } = filled.error;
		let issues = cause instanceof MarkdownParseError ? cause.issues : undefined;
		return { ok: false as const, line: position?.start.line, issues };
	}
	return { ok: true as const, document: filled.data };
}
```

## Decide what a missing value means

A name with no value fails the walk by default, at the variable's position, and the error names
the full path: `No value for $plan.name`. A path that runs off its data at any segment counts as
missing the same way. That suits pages a reader sees, where a hole left open is a bug.

An editor's preview wants the opposite, so it passes `missing: "keep"` and the variable stays in
the tree for the renderer to show:

```typescript
Markdown.walk(
	document,
	variables(draftValues, { ...MARKDOWN_OPTIONS, missing: "keep" }),
);
```

A kept text hole renders as its source spelling: `toHTML` writes it as
`<span class="md-variable">{% $plan.name %}</span>`, so a stylesheet can mark the holes still
open, and `toRemix` as the text `{% $plan.name %}`. A kept attribute value is written as the
braced spelling the author used. A visitor of your own that handles `variable` nodes covers any
other policy, such as filling a default.

## Serve the template, not one reader's copy

Variables survive parsing, so `Markdown.stringify` writes them back as the author wrote them,
comments included. An editing API can parse a file, change its frontmatter, and save it without
filling a value or dropping a note:

```typescript {% title="app/content/save.ts" %}
import { Markdown } from "@sdxc/markdown";
import { isFailure, success } from "@sdxc/result";

import { MARKDOWN_OPTIONS } from "~/app/content/schema";

export function touch(source: string) {
	let parsed = Markdown.parse(source, MARKDOWN_OPTIONS);
	if (isFailure(parsed)) return parsed;

	let written = Markdown.stringify(parsed.data.document, {
		frontmatter: { updatedAt: new Date().toISOString() },
	});
	if (isFailure(written)) return written;

	return success(written.data);
}
```

The output still reads `{% $plan.name %}` and `plans={$plans}`, so the markdown a client fetches
is the template every workspace is filled from.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the loader and
  route a filled document renders through.
- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — the passes to
  run after the values are in.
- [`@sdxc/markdown`](/api/markdown) — the attribute grammar and the variable node in full.
