---
title: Fill markdown templates with variables
description: Write one markdown document with holes for per-render values and fill them per tenant, plan or locale.
section:
    title: Content & feeds
    order: 8
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "How to write one markdown document with holes for per-render values"
    - "How to fill the values per tenant, plan or locale and decide what a missing one means"
    - "When a tag's schema checks a filled value"
---

Onboarding pages, plan summaries and transactional copy say the same thing to every reader
with a few values changed: the product's name, the plan a workspace pays for, the link to its
billing page. [`@sdxc/markdown`](/api/markdown) keeps each variable as a node in the tree, and
the `variables` plugin fills them in when a page renders, so one parsed document serves every
reader. This guide builds on
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline).

```bash
npm add @sdxc/markdown @sdxc/result remix
```

## Write the holes into the document

A variable is a name after a `$`, inside `{% … %}` in text and inside braces in an attribute
value. A dotted path reads a field (`$plan.seats`) or an array index (`$plans.0`).

```text {% title="resources/content/onboarding/welcome.md" %}
Welcome to {% $product %}. Your {% $plan.name %} plan includes {% $plan.seats %} seats.

<pricing plans={$plans} current={$plan.id} />

Invoices and receipts live on <a href={$links.billing}>your billing page</a>.

{/* The seat count comes from the plan; never write it down here. */}
```

A tag's attribute schema describes the values it receives once filled, so `plans` is an array of
plan objects even though the source writes a variable:

```typescript {% title="app/services/content/schema.ts" %}
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

`variables(values, options)` returns a visitor for `Markdown.walk`. Pass the options the
document was parsed with, so the plugin can run the checks that were waiting on these values:

```typescript {% title="app/services/content/onboarding.ts" %}
import { Markdown } from "@sdxc/markdown";
import { variables } from "@sdxc/markdown/plugin/variables";

import { MARKDOWN_OPTIONS } from "~/app/services/content/schema";

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

A parsed document is plain JSON, so you can cache it by file and fill it per request. A text
hole takes a string, a number or a boolean; a list, an object or `null` there fails the walk.

> [!NOTE]
> Fill variables before the other [markdown plugins](/docs/content-and-feeds/markdown-plugins)
> run, in a walk of its own, so the passes after it read the final text and URLs.

A tag's schema runs at parse time when every attribute is literal. When an attribute holds a
variable, `variables` runs the schema once the names are filled in, and a value that fails it
fails the walk at the tag's position, with a `MarkdownParseError` carrying the schema's issues
as the failure's `cause`.

> [!NOTE]
> Allowlisted elements are held to the same rules at fill time. An `href` or `src` filled from a
> variable takes only relative, `http`, `https`, `mailto` and `tel` URLs, so a value of
> `javascript:alert(1)` fails the walk at the `<a>` the way it would fail the parse had the author
> written it.

## Decide what a missing value means

A name with no value fails the walk by default, with an error naming the full path
(`No value for $plan.name`), which suits pages a reader sees. An editor's preview passes
`missing: "keep"` instead, and the variable stays in the tree:

```typescript
Markdown.walk(
	document,
	variables(draftValues, { ...MARKDOWN_OPTIONS, missing: "keep" }),
);
```

A kept hole renders as its source spelling, so a preview shows the holes still open.

## Test it

Test that a workspace's values land in the text and that a hole with no value fails:

```typescript {% title="app/services/content/onboarding.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { fillOnboarding } from "~/app/services/content/onboarding";
import { MARKDOWN_OPTIONS } from "~/app/services/content/schema";

const WORKSPACE = { slug: "acme", plan: { id: "team", name: "Team", seats: 10 } };

function parse(source: string) {
	return unwrap(Markdown.parse(source, MARKDOWN_OPTIONS)).document;
}

test("fills the workspace's plan into the text", () => {
	let document = parse(
		"Your {% $plan.name %} plan includes {% $plan.seats %} seats.",
	);

	let filled = unwrap(fillOnboarding(document, WORKSPACE));

	expect(toPlainText(filled)).toContain("Your Team plan includes 10 seats.");
});

test("fails on a hole with no value", () => {
	let filled = fillOnboarding(parse("Your plan is {% $plan.color %}."), WORKSPACE);

	expect(isFailure(filled) && filled.error.message).toContain(
		"No value for $plan.color",
	);
});
```

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the loader and
  route a filled document renders through.
- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — the passes to
  run after the values are in.
- [`@sdxc/markdown`](/api/markdown) — the attribute grammar and the variable node in full.
