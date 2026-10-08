---
title: Render TeX math
description: Turn TeX formulas in markdown and in components into MathML the browser draws natively, with broken formulas caught at build time.
section:
    title: Content & feeds
    order: 7
order: 30
lastUpdated: 2026-10-08
---

Browsers draw MathML Core on their own: no stylesheet to link, no web font to load and no
script to run after the page arrives. What authors write, though, is TeX. This guide converts
one into the other wherever a formula appears: in a markdown post, in a string you render for
a feed, and directly in a `remix/component` view. It uses [`@sdxc/math`](/api/math) together
with [`@sdxc/markdown`](/api/markdown).

```bash
npm add @sdxc/math @sdxc/markdown @sdxc/result remix
```

The conversion happens on the server, so the page carries finished markup. Every formula
also keeps its TeX source as an annotation, which screen readers and copy-paste read back.

## Convert a formula

`toMathML` takes TeX without its surrounding `$` or `\[` and answers with a `Result` holding
the markup. `display: true` makes it a block formula, which also sets the limits of big
operators like `\sum` under and over the symbol instead of beside it:

```typescript {% title="app/content/formula.ts" %}
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

The string is safe to place in HTML or XHTML as it is: every operator and the annotation are
escaped. TeX outside the supported subset fails with a `MathError` whose message ends in
`line:column`, so it reads on its own in a build log, while `reason`, `index`, `line` and
`column` carry the same place for a tool that points an editor at it.

The subset covers what prose math reaches for: scripts, `\frac` and `\binom`, roots,
Greek letters, relations and arrows, function names and `\operatorname`, big operators with
`\limits` and `\nolimits`, `\left` and `\right` fences, `\text`, the `\mathrm`, `\mathbf`,
`\mathit` and `\mathbb` styles, accents, TeX spacing, and the `matrix`, `pmatrix`, `bmatrix`,
`vmatrix` and `cases` environments.

When you want the structure rather than a string, `parseMath` takes the same arguments and
answers with a JSON tree of MathML elements rooted at `math`. It survives
`JSON.stringify`, so a build can store it and a renderer can draw it later.

## Find the math in markdown

Authors write math in markdown the way GitHub reads it: a fenced block with the `math`
language for a display formula, and inline code wrapped in dollar signs for one inside a
sentence.

````text
The sum of the first $`n`$ integers is:

```math
\sum_{i=1}^n i = \frac{n(n+1)}{2}
```
````

`math` from `@sdxc/math/markdown` is a walk visitor. It turns each form into a `math` tag
carrying `tex` and `display` attributes and leaves every other code block alone. Its handlers
are synchronous, so it spreads into the same single walk as the rest of your preparation and
the walk still answers with a `Result`:

```typescript {% title="app/content/prepare.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { math } from "@sdxc/math/markdown";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(document, {
		...math,
		code(node) {
			let converted = math.code(node);
			if (converted.type !== "code") return converted;
			return highlight.code(converted);
		},
	});
}
```

Both visitors handle fenced code, and a spread keeps only the last `code` handler, so the
walk gets one that runs them in turn: a `math` fence becomes a tag, and every other block
comes back from `math.code` as the same node for the highlighter to paint. The rest of the
math visitor spreads in as it is, covering inline math in paragraphs, headings, table cells,
emphasis and links.

A formula that does not convert fails the walk. The failure's `position` is where the fence
or inline code sits in the document, and its `cause` is the `MathError` with the place inside
the formula, so a broken post fails the build with both:

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

For content you do not control, such as comments or imported notes, build the visitor with
`createMathVisitor({ invalid: "keep" })`. A formula that does not convert then stays the code
block or inline code its author wrote, and the walk succeeds.

## Draw the tags in a route

`MathFormula` from `@sdxc/math/ui` is a `remix/component` component whose props are exactly
the attributes the visitor writes, so it goes straight into the `components` map of `toRemix`:

```tsx {% title="app/content/render-post.tsx" %}
import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";
import { MathFormula } from "@sdxc/math/ui";

export function renderPost(document: Markdown.Document) {
	return toRemix(document, { components: { math: MathFormula } });
}
```

It builds the MathML as element nodes the renderer owns, and the browser's HTML parser places
them in the MathML namespace when the page arrives. A tag whose TeX does not convert, which a
walk with `invalid: "keep"` never produces but a hand-built tag can, renders as the TeX in a
`<code>`, so a reader still sees what the author wrote.

The same component draws a formula outside markdown, in any view:

```tsx {% title="app/components/pricing-note.tsx" %}
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

`display` defaults to inline; pass `display` for a block formula of its own.

## Render to HTML for feeds and email

A feed item or an email body wants a string. `renderMath` is the tag renderer for `toHTML`,
turning each `math` tag into the markup `toMathML` writes, with unconvertible TeX as escaped
`<code>`:

```typescript {% title="app/content/render.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { toHTML } from "@sdxc/markdown/html";
import { renderMath } from "@sdxc/math/markdown";

export function renderHTML(document: Markdown.Document): string {
	return toHTML(document, { tags: { math: renderMath } });
}
```

Feed readers that understand MathML draw the formula, and the `annotation` keeps the TeX in
the item for the ones that show source.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the parse, walk
  and render this guide plugs math into.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — serve the HTML
  `renderMath` produces as each item's body.
- [`@sdxc/math`](/api/math) — the full TeX subset and the MathML tree it produces.
