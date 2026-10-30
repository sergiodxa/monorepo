---
title: Anchor, polish and lint markdown
description: Give headings anchors and a table of contents, rewrite links, set typographic punctuation, turn pasted URLs into embeds, and check content in CI.
section:
    title: Content & feeds
    order: 8
order: 8
lastUpdated: 2026-10-25
outcomes:
    - "How to give headings anchors and build a table of contents"
    - "How to rewrite links, set typographic punctuation and turn pasted URLs into embeds"
    - "How to lint content in CI with `@sdxc/markdown/plugin/lint`"
---

A parsed document is a tree, and [`@sdxc/markdown`](/api/markdown) ships the passes most sites
run over that tree as plugins: anchors and a table of contents for headings, link rewriting,
typographic punctuation, embeds made from pasted URLs, and a linter that reports what an
author got wrong with the line to fix. Each one is a visitor for `Markdown.walk`, so plugins
compose with your own visitors and [`@sdxc/highlight`](/api/highlight) into a single walk.

This guide picks up where [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline)
leaves off, with a `preparePost` function that walks the tree before a route renders it.

```bash
npm add @sdxc/highlight @sdxc/markdown @sdxc/result
```

## Run the plugins in order

Every plugin lives at its own subpath. `Markdown.compose` merges visitors into one walk, and
handlers for the same node type run in the order you list the visitors:

```typescript {% title="app/services/content/prepare.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { embeds, gist, vimeo, youtube } from "@sdxc/markdown/plugin/embeds";
import { headings } from "@sdxc/markdown/plugin/headings";
import { links } from "@sdxc/markdown/plugin/links";
import { typography } from "@sdxc/markdown/plugin/typography";

const SITE_ORIGIN = "https://example.com/";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(
		document,
		Markdown.compose(
			embeds([youtube(), vimeo(), gist()]),
			highlight,
			headings(),
			links({ base: SITE_ORIGIN }),
			typography(),
		),
	);
}
```

Embeds go first, so a pasted video URL becomes a tag before anything reads it as a link.
Headings take their ids before typography curls the quotes in their text, so an id is the slug
of what the author typed.

> [!WARNING]
> Merge visitors with `Markdown.compose`. An object spread keeps only the last handler for each
> key, so of two visitors that both handle `paragraph` or `heading`, only the second one runs.

## Anchor headings and build a table of contents

`headings()` gives every heading an `id` from its plain text, using the slugs GitHub writes. An
author who names a heading keeps that name, and a repeated heading takes a `-1`, `-2` suffix.

```text
## Install {% #setup %}

## Configure

## Configure
```

The three headings above get `setup`, `configure` and `configure-1`.

`tableOfContents` reads the walked document back as a tree of entries with `id`, `text`,
`level` and `children`:

```typescript {% title="app/services/content/outline.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { tableOfContents } from "@sdxc/markdown/plugin/headings";

export function outline(document: Markdown.Document) {
	return tableOfContents(document, { levels: [2, 3, 4] });
}
```

It leaves out any heading with no id, which is why it reads the document `headings()` walked.

## Rewrite the URLs a document points at

`links()` rewrites a link's `href` and an image's `src`. `base` resolves every relative URL the
way a browser does, and `rewrite` runs on every URL after that, returning the URL to write or
`undefined` to keep it. Here a folder of `.md` files that link to each other maps each link to
the route that renders it, while images move to a CDN:

```typescript {% title="app/services/content/docs-links.ts" %}
import { links } from "@sdxc/markdown/plugin/links";

const DOCS_ORIGIN = "https://example.com";
const CDN_ORIGIN = "https://cdn.example.com";

export function docsLinks(path: string) {
	return links({
		base: new URL(path, `${DOCS_ORIGIN}/docs/`),
		rewrite(url, node) {
			if (!url.startsWith(DOCS_ORIGIN)) return undefined;
			if (node.type === "image") return url.replace(DOCS_ORIGIN, CDN_ORIGIN);
			return url.replace(/\.md(?=$|[?#])/, "");
		},
	});
}
```

`docsLinks("guides/setup.md")` resolves `../reference/cli.md#flags` in that file to
`https://example.com/docs/reference/cli#flags`.

> [!NOTE]
> Pass an absolute URL as `base`. Any other value fails the walk at the first relative URL it
> meets, with that node's position.

## Set prose in typographic punctuation

`typography()` turns straight quotes into curly ones, `--` into an en dash, `---` into an em
dash and `...` into an ellipsis. It changes `text` nodes alone, so code keeps its ASCII and a
command in backticks stays one a reader can copy. A locale that writes other marks passes them
as pairs, and each rule can be turned off:

```typescript {% title="app/services/content/typography.ts" %}
import { typography } from "@sdxc/markdown/plugin/typography";

export const SPANISH = typography({
	quotes: { double: ["«", "»"], single: ["“", "”"] },
	ellipses: false,
});
```

## Turn pasted URLs into embeds

`embeds()` takes a list of providers and turns a URL an author pasted on a line of its own into
a block tag; a link with its own label, or a URL inside a sentence, stays a link.

```text
Here is the walkthrough:

https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s
```

The walk makes no request: `youtube()` reads the video `id` and `start` from the URL. Each
tag renders through the component registered under its name, which
[Embed YouTube videos in markdown](/docs/content-and-feeds/youtube-embeds) walks through.

## Test the order

The order of the visitors is what a later edit can break without any one plugin failing, so pin
it with a test:

```typescript {% title="app/services/content/prepare.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { preparePost } from "~/app/services/content/prepare";

test("embeds pasted URLs and anchors headings before setting them", () => {
	let { document } = unwrap(
		Markdown.parse('## "Ship it"\n\nhttps://youtu.be/dQw4w9WgXcQ\n'),
	);

	let [heading, video] = unwrap(preparePost(document)).children;

	expect(heading).toMatchObject({
		attributes: { id: "ship-it" },
		children: [{ type: "text", value: "“Ship it”" }],
	});
	expect(video).toMatchObject({
		type: "tag",
		name: "youtube",
		attributes: { id: "dQw4w9WgXcQ" },
	});
});
```

## Lint content in CI

`lint()` checks a parsed document and returns its problems as data, each a
`{ rule, message, position }`. Every rule runs unless you turn it off (the rule list is in
[`@sdxc/markdown`](/api/markdown)), `ids` adds the ids the page has outside the document, and a
rule of your own goes in `custom`.

A Vitest test over every post makes the check part of CI, listing each problem with its file and
line:

```typescript {% title="app/services/content/posts.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { lint } from "@sdxc/markdown/plugin/lint";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { MARKDOWN_OPTIONS } from "~/app/services/content/schema";

const POSTS = import.meta.glob<string>("/resources/content/posts/*.md", {
	query: "?raw",
	import: "default",
	eager: true,
});

test.each(Object.entries(POSTS))("%s passes the content lint", (file, source) => {
	let { document } = unwrap(Markdown.parse(source, MARKDOWN_OPTIONS));

	let problems = lint(document, {
		rules: { "single-h1": false },
		ids: ["comments"],
		custom: {
			"no-todo"(node, report) {
				if (node.type === "text" && node.value.includes("TODO")) {
					report("TODO left in the copy");
				}
			},
		},
	});

	let lines = problems.map((problem) => {
		return `${file}:${problem.position.start.line} ${problem.message} (${problem.rule})`;
	});
	expect(lines).toEqual([]);
});
```

`single-h1` is off here because the page draws the title from the frontmatter.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the schema,
  loader and route these passes slot into.
- [Fill markdown templates with variables](/docs/content-and-feeds/markdown-variables) — fill
  per-render values before the other plugins run.
- [`@sdxc/markdown`](/api/markdown) — every option of each plugin and the full AST.
