---
title: Draw diagrams from text
description: Turn Mermaid sequence, class, state and flowchart diagrams in markdown into SVG drawn on the server, with broken diagrams caught at build time.
section:
    title: Content & feeds
    order: 8
order: 31
lastUpdated: 2026-10-25
outcomes:
    - "How to draw Mermaid diagrams as SVG on the server with `@sdxc/diagram`"
    - "How to find the diagrams in markdown and draw them in a route"
    - "How to match your theme and render to HTML for feeds and email"
---

A diagram written as text lives beside the prose it explains: it diffs, it reviews, and it
changes in the same commit as the code it describes. This guide draws those diagrams in your
markdown as SVG on the server with [`@sdxc/diagram`](/api/diagram) and
[`@sdxc/markdown`](/api/markdown).

```bash
npm add @sdxc/diagram @sdxc/highlight @sdxc/markdown @sdxc/result remix
```

The page carries finished SVG, so no script runs to draw it.

## Write a diagram

Diagrams use [Mermaid](https://mermaid.js.org)'s syntax, the one GitHub renders. The first line
names the kind: `sequenceDiagram`, `classDiagram`, `stateDiagram-v2` or `flowchart` with a
direction. Write it inside a fenced block marked `mermaid`:

```text
sequenceDiagram
    actor Reader
    participant Worker
    participant Cache
    Reader->>+Worker: GET /posts/hello
    Worker->>Cache: match(request)
    alt cached
        Cache-->>Worker: response
    else missing
        Worker->>Worker: render the post
        Worker-)Cache: put(request, response)
    end
    Worker-->>-Reader: 200 OK
```

An `alt` annotation on the fence, `{% alt="Posts move from draft to review to live" %}` after
`mermaid`, names the drawing for screen readers. The [package reference](/api/diagram) lists
every statement each kind reads.

## Find the diagrams in markdown

`diagram` from `@sdxc/diagram/markdown` is a walk visitor that turns each `mermaid` fence into a
`diagram` tag and leaves every other code block alone, so it composes with a highlighter:

```typescript {% title="app/services/content/prepare.ts" %}
import { diagram } from "@sdxc/diagram/markdown";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(document, Markdown.compose(diagram, highlight));
}
```

A diagram that does not parse fails the walk. The failure's `position` is where the fence sits,
and its `cause` is the `DiagramError` with the line inside the diagram, so a build check can
point at the statement:

```typescript {% title="scripts/check-posts.ts" %}
import { DiagramError } from "@sdxc/diagram";
import { diagram } from "@sdxc/diagram/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

export function checkDiagrams(path: string, source: string): string | null {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) return `${path}: ${parsed.error.message}`;

	let walked = Markdown.walk(parsed.data.document, diagram);
	if (!isFailure(walked)) return null;

	let fence = walked.error.position?.start.line ?? 0;
	let cause = walked.error.cause;
	if (!(cause instanceof DiagramError))
		return `${path}:${fence}: ${walked.error.message}`;
	return `${path}:${fence + cause.line}: ${cause.reason}`;
}
```

> [!WARNING]
> A walk with `diagram` fails on the first diagram that does not parse. For content you do not
> control, or for posts stored in a database and rendered on request, build the visitor with
> `createDiagramVisitor({ invalid: "keep" })`: a diagram that does not parse then stays the code
> block its author wrote, and the walk succeeds.

## Draw the tags in a route

`DiagramTag` from `@sdxc/diagram/ui` takes the attributes the visitor writes, so it goes
straight into the `components` map of `toRemix`:

```tsx {% title="app/services/content/render-post.tsx" %}
import type { Markdown } from "@sdxc/markdown";

import { DiagramTag } from "@sdxc/diagram/ui";
import { toRemix } from "@sdxc/markdown/remix";

export function renderPost(document: Markdown.Document) {
	return toRemix(document, { components: { diagram: DiagramTag } });
}
```

`Diagram` from the same entry draws one outside markdown, from a `source` prop.

## Match your theme

Lines and text use `currentColor`, so a diagram follows the page into dark mode. Node bodies fill
with `--diagram-fill` and notes with `--diagram-tint`; both fall back to the page background:

```css {% title="resources/styles/prose.css" %}
.prose svg[role="img"] {
	color: var(--text-muted);
	--diagram-fill: var(--surface-raised);
}
```

## Render to HTML for feeds and email

A feed item or an email body wants a string. `renderDiagram` is the tag renderer for `toHTML`:

```typescript {% title="app/services/content/render.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { renderDiagram } from "@sdxc/diagram/markdown";
import { toHTML } from "@sdxc/markdown/html";

export function renderHTML(document: Markdown.Document): string {
	return toHTML(document, { tags: { diagram: renderDiagram } });
}
```

## Test it

Test `checkDiagrams` with a valid diagram and a broken one:

```typescript {% title="scripts/check-posts.test.ts" %}
import { expect, test } from "vitest";

import { checkDiagrams } from "./check-posts";

test("passes a post whose diagrams parse", () => {
	let post = "# Flow\n\n~~~mermaid\nflowchart LR\n  A --> B\n~~~\n";

	expect(checkDiagrams("flow.md", post)).toBeNull();
});

test("points at the statement that does not parse", () => {
	let post = "# Flow\n\n~~~mermaid\nflowchart LR\n  A --> B\n  A B C\n~~~\n";

	expect(checkDiagrams("flow.md", post)).toMatch(/^flow\.md:6: /);
});
```

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the parse, walk
  and render this guide plugs diagrams into.
- [Render TeX math](/docs/content-and-feeds/math) — the same tag-and-renderer approach for
  formulas.
- [`@sdxc/diagram`](/api/diagram) — every statement each diagram kind reads.
