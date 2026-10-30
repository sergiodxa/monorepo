---
title: Render TeX math
description: Turn TeX formulas in markdown and in components into MathML the browser draws natively, with broken formulas caught at build time.
section:
    title: Content & feeds
    order: 8
order: 30
lastUpdated: 2026-10-25
outcomes:
    - "How to convert TeX formulas into MathML with `@sdxc/math`"
    - "How to find the math in markdown and draw it in a route"
    - "How to catch broken formulas at build time and render to HTML for feeds and email"
---

Browsers draw MathML Core on their own, with no stylesheet, web font or script, but authors
write TeX. This guide converts one into the other on the server wherever a formula appears: in a
markdown post, in a string you render for a feed, and in a `remix/component` view, using
[`@sdxc/math`](/api/math) with [`@sdxc/markdown`](/api/markdown).

```bash
npm add @sdxc/highlight @sdxc/markdown @sdxc/math @sdxc/result remix
```

Every formula keeps its TeX source as an annotation, which screen readers and copy-paste read
back.

## What it looks like

Every formula on this page is drawn the way this guide describes. Euler's identity,
$`e^{i\pi} + 1 = 0`$, sits inline in a sentence, while a display formula, such as the quadratic
formula, gets a line of its own:

```math
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
```

The source of each is the TeX inside a `math` fence, as the next sections show.

## Convert a formula

`toMathML` takes TeX without its surrounding `$` or `\[` and answers with a `Result` holding
the markup. `display: true` makes it a block formula, which also sets the limits of big
operators like `\sum` under and over the symbol instead of beside it:

```typescript {% title="app/services/content/formula.ts" %}
import { toMathML } from "@sdxc/math";
import { isFailure } from "@sdxc/result";

export function sumFormula(): string {
	let result = toMathML("\\sum_{i=1}^n i = \\frac{n(n+1)}{2}", { display: true });
	if (isFailure(result)) {
		let { reason, line, column } = result.error;
		return `<code>${reason} at ${line}:${column}</code>`;
	}
	return result.data; // '<math xmlns="…" display="block"><semantics>…'
}
```

The string is safe to place in HTML as it is. TeX outside the supported subset, which
[`@sdxc/math`](/api/math) lists, fails with a `MathError` carrying the `line` and `column`.

## Find the math in markdown

Authors write math in markdown the way GitHub reads it: a `math` fence for a display formula,
and inline code wrapped in dollar signs inside a sentence.

```text
The sum of the first $`n`$ integers is:

~~~math
\sum_{i=1}^n i = \frac{n(n+1)}{2}
~~~
```

`math` from `@sdxc/math/markdown` is a walk visitor. It turns each form into a `math` tag
carrying `tex` and `display` attributes and leaves every other code block alone, so it composes
with a highlighter in one walk:

```typescript {% title="app/services/content/prepare.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { math } from "@sdxc/math/markdown";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(document, Markdown.compose(math, highlight));
}
```

List `math` first: a `math` fence becomes a tag, and every other block reaches the highlighter
as the code node it was.

A formula that does not convert fails the walk, with the `position` in the document and the
`MathError` as its `cause`, so a check script fails the build on a broken post:

```typescript {% title="scripts/check-posts.ts" %}
import { Markdown } from "@sdxc/markdown";
import { MathError } from "@sdxc/math";
import { math } from "@sdxc/math/markdown";
import { isFailure } from "@sdxc/result";

export function checkMath(path: string, source: string): string | null {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return `${path}: ${parsed.error.message}`;

	let walked = Markdown.walk(parsed.data.document, math);
	if (!isFailure(walked)) return null;

	let line = walked.error.position?.start.line ?? 0;
	let cause = walked.error.cause;
	let reason = cause instanceof MathError ? cause.reason : walked.error.message;
	return `${path}:${line}: ${reason}`;
}
```

> [!WARNING]
> A walk with `math` fails on the first formula that does not convert. For content you do not
> control, such as comments, build the visitor with `createMathVisitor({ invalid: "keep" })`, which
> leaves such a formula as the code its author wrote.

## Draw the tags in a route

`MathTag` from `@sdxc/math/ui` takes the attributes the visitor writes, so it goes straight
into `toRemix`'s `components` map:

```tsx {% title="app/services/content/render-post.tsx" %}
import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";
import { MathTag } from "@sdxc/math/ui";

export function renderPost(document: Markdown.Document) {
	return toRemix(document, { components: { math: MathTag } });
}
```

`MathFormula` draws a formula outside markdown, in any view, from the same `tex` and `display`:

```tsx {% title="resources/components/pricing-note.tsx" %}
import type { Handle } from "remix/component";

import { MathFormula } from "@sdxc/math/ui";

export function PricingNote(handle: Handle) {
	return () => (
		<p>
			A plan billed yearly costs <MathFormula tex="12 \times p \times 0.8" /> in
			total.
		</p>
	);
}
```

## Render to HTML for feeds and email

A feed item or an email body wants a string. `renderMath` is the tag renderer for `toHTML`:

```typescript {% title="app/services/content/render.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { toHTML } from "@sdxc/markdown/html";
import { renderMath } from "@sdxc/math/markdown";

export function renderHTML(document: Markdown.Document): string {
	return toHTML(document, { tags: { math: renderMath } });
}
```

## Test it

Test the visitor order, which decides who sees a fence first, and the check that fails a broken
post:

```typescript {% title="app/services/content/prepare.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { preparePost } from "~/app/services/content/prepare";

test("turns math fences into tags and highlights the rest", () => {
	let { document } = unwrap(
		Markdown.parse("~~~math\nx^2\n~~~\n\n~~~ts\nlet a = 1;\n~~~\n"),
	);

	let [formula, code] = unwrap(preparePost(document)).children;

	expect(formula).toMatchObject({
		type: "tag",
		name: "math",
		attributes: { tex: "x^2" },
	});
	expect(code).toMatchObject({ type: "code", tokens: expect.any(Array) });
});
```

```typescript {% title="scripts/check-posts.test.ts" %}
import { expect, test } from "vitest";

import { checkMath } from "./check-posts";

test("names the line of a formula that does not convert", () => {
	expect(checkMath("sums.md", "# Sums\n\nThe sum is $`\\frac{1}`$.\n")).toBe(
		"sums.md:3: Expected an argument",
	);
});
```

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the parse, walk
  and render this guide plugs math into.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — serve the HTML
  `renderMath` produces as each item's body.
- [`@sdxc/math`](/api/math) — the full TeX subset and the MathML tree it produces.
