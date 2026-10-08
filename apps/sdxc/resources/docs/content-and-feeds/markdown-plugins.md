---
title: Anchor, polish and lint markdown
description: Give headings anchors and a table of contents, rewrite links, set typographic punctuation, turn pasted URLs into embeds, and check content in CI.
section:
    title: Content & feeds
    order: 7
order: 8
lastUpdated: 2026-10-08
---

A parsed document is a tree, and [`@sdxc/markdown`](/api/markdown) ships the passes most sites
run over that tree as plugins: anchors and a table of contents for headings, link rewriting,
typographic punctuation, embeds made from pasted URLs, and a linter that reports what an
author got wrong with the line to fix. Each one is a visitor for `Markdown.walk`, built by a
function you call with its options, so a plugin composes with the visitors you write yourself
and with [`@sdxc/highlight`](/api/highlight).

This guide picks up where [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline)
leaves off: posts are parsed per request with a shared `MARKDOWN_OPTIONS`, and a
`preparePost` function walks the tree before a route renders it.

```bash
npm add @sdxc/markdown @sdxc/highlight @sdxc/result
```

## Run the plugins in order

Every plugin lives at its own subpath, so a page imports only the passes it runs:

| Plugin         | Import                             | Handles                                               |
| -------------- | ---------------------------------- | ----------------------------------------------------- |
| `embeds()`     | `@sdxc/markdown/plugin/embeds`     | `paragraph`                                           |
| `headings()`   | `@sdxc/markdown/plugin/headings`   | `document`, `heading`                                 |
| `links()`      | `@sdxc/markdown/plugin/links`      | `link`, `image`, `element`                            |
| `typography()` | `@sdxc/markdown/plugin/typography` | `paragraph`, `heading`, `tableCell`, `tag`, `element` |
| `lint()`       | `@sdxc/markdown/plugin/lint`       | reads a document and returns its problems             |

Visitors whose node types are disjoint spread into one object and run as a single pass. Two
visitors that handle the same type take a walk each, because a spread keeps only the last
handler for a key. That gives a post three walks, in this order:

```typescript {% title="app/content/prepare.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { embeds, gist, vimeo, youtube } from "@sdxc/markdown/plugin/embeds";
import { headings } from "@sdxc/markdown/plugin/headings";
import { links } from "@sdxc/markdown/plugin/links";
import { typography } from "@sdxc/markdown/plugin/typography";
import { isFailure } from "@sdxc/result";

const SITE_ORIGIN = "https://example.com/";

export function preparePost(document: Markdown.Document) {
	let embedded = Markdown.walk(document, embeds([youtube(), vimeo(), gist()]));
	if (isFailure(embedded)) return embedded;

	let anchored = Markdown.walk(embedded.data, {
		...highlight,
		...headings(),
		...links({ base: SITE_ORIGIN }),
	});
	if (isFailure(anchored)) return anchored;

	return Markdown.walk(anchored.data, typography());
}
```

Embeds go first, so a pasted video URL becomes a tag before anything else reads it as a link.
Headings take their ids before typography curls the quotes in their text, so a heading's id is
the slug of what the author typed, which is also what the linter resolves `#fragment` links
against. Every plugin is synchronous, so each walk answers with a `Result` you check and pass
on.

## Anchor headings and build a table of contents

`headings()` gives every heading an `id` from its plain text, using the slugs GitHub writes, so
a link copied from a README rendered on GitHub lands on the same heading on your site. An
author who names a heading keeps that name, and the walk reserves every id written anywhere in
the document before it generates one, so a slug never takes an id an author wrote further
down. A repeated heading takes the first free `-1`, `-2` suffix, and a heading of punctuation
alone stays without an id.

```text
## Install {% #setup %}

## Configure

## Configure
```

The three headings above get `setup`, `configure` and `configure-1`. Two options shape the
ids: `levels` limits which headings get a generated one, and `slug` replaces GitHub's slug with
your own function, still numbered when two results repeat.

```typescript {% title="app/content/anchors.ts" %}
import { headings } from "@sdxc/markdown/plugin/headings";

export const ANCHORS = headings({
	levels: [2, 3, 4],
	slug: (text) => text.toLowerCase().replaceAll(/\s+/g, "_"),
});
```

The visitor remembers the ids it handed out within a walk, and each walk of a whole document
starts fresh. When you walk separate parts of a document one at a time, call `headings()` once
per part, so a slug taken in one part is free again in the next.

`tableOfContents` reads the walked document back as a tree. Each entry carries `id`, `text`,
`level` and `children`, where the children are the deeper headings that follow until the next
heading at the same level or shallower, so a skipped level (`##` then `####`) nests under the
nearest shallower heading:

```typescript {% title="app/content/outline.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { tableOfContents } from "@sdxc/markdown/plugin/headings";

export function outline(document: Markdown.Document) {
	return tableOfContents(document, { levels: [2, 3, 4] });
}
```

It lists levels 2 and 3 by default and leaves out any heading with no id, which is why it reads
the document `headings()` already walked.

## Rewrite the URLs a document points at

`links()` rewrites a link's `href`, an image's `src`, and the `href` and `src` of an allowlisted
HTML element. `base` resolves every relative URL the way a browser resolves it against the
page: `./`, `../` and root-relative paths all resolve, and their query and fragment come along.
Absolute URLs, `mailto:` and `tel:` links, and `#fragment` links that point inside the page keep
what the author wrote.

`rewrite` runs on every URL after `base` has resolved it, absolute ones included, beside the
node that holds it. It returns the URL to write, or `undefined` to keep the one it was given.
Documentation written as a folder of `.md` files that link to each other is the usual case:
the links work on GitHub as written, and the rewrite maps each one to the route that renders
it, while images move to a CDN.

```typescript {% title="app/content/docs-links.ts" %}
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
`https://example.com/docs/reference/cli#flags`. A `base` that is no absolute URL fails the walk
at the first relative URL it meets, with that node's position, and a URL held by a variable
stays as written until [the variable is filled](/docs/content-and-feeds/markdown-variables).

## Set prose in typographic punctuation

`typography()` turns straight quotes into curly ones, `--` into an en dash, `---` into an em
dash and `...` into an ellipsis. It changes `text` nodes alone, so code blocks, inline code,
attribute values, and `code`, `kbd`, `samp` and `var` elements keep their ASCII, and a command
in backticks stays one a reader can copy.

Each paragraph, heading, table cell, and block-level tag or element is set as one run, so a
quote is decided by the characters around it even across formatting: in `"**Ship it**"` the
first quote opens before the bold text and the second closes after it. A `'` inside a word (`don't`) or ahead of
an elided year (`'90s`) is an apostrophe.

A locale that writes other marks passes them as pairs, and each of the three rules can be turned
off on its own:

```typescript {% title="app/content/typography.ts" %}
import { typography } from "@sdxc/markdown/plugin/typography";

export const SPANISH = typography({
	quotes: { double: ["«", "»"], single: ["“", "”"] },
	ellipses: false,
});
```

The apostrophe stays `’` whatever quote marks a locale sets.

## Turn pasted URLs into embeds

`embeds()` takes a list of providers and turns a URL an author pasted on a line of its own into
a block tag. A paragraph qualifies when it holds one link that shows its own URL, written bare,
in angle brackets or as a `www.` autolink; a link with its own label, or a URL inside a
sentence, stays a link. The first provider that recognises the URL names the tag.

```text
Here is the walkthrough:

https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s
```

| Provider    | Recognises                                                              | Attributes     |
| ----------- | ----------------------------------------------------------------------- | -------------- |
| `youtube()` | watch, `shorts`, `embed` and `live` pages, `youtu.be`, nocookie         | `id`, `start?` |
| `vimeo()`   | `vimeo.com/ID`, `vimeo.com/ID/HASH`, `player.vimeo.com/video/ID?h=HASH` | `id`, `hash?`  |
| `gist()`    | `gist.github.com/USER/ID`                                               | `user`, `id`   |
| `x()`       | `x.com/USER/status/ID` and `twitter.com/USER/status/ID`                 | `user`, `id`   |

Every embed tag also carries `url`, the link as written, so a renderer can always fall back to a
plain link, and any annotation the author wrote above the URL. `start` is in seconds, read from
YouTube's `t` or `start` parameter. Matching reads the URL alone, so the walk makes no request.

Each tag renders through the component registered under its name, the way any other tag does:

```tsx {% title="app/components/youtube.tsx" %}
import type { Handle } from "remix/component";

interface YouTubeProps {
	[key: string]: unknown;
	id: string;
	start?: number;
	url: string;
}

export function YouTube(handle: Handle<YouTubeProps>) {
	return () => {
		let src = new URL(
			`https://www.youtube-nocookie.com/embed/${handle.props.id}`,
		);
		if (handle.props.start)
			src.searchParams.set("start", String(handle.props.start));
		return <iframe src={src.href} title="YouTube video" loading="lazy" />;
	};
}
```

```tsx
toRemix(document, { components: { youtube: YouTube, vimeo: Vimeo, gist: Gist } });
```

An embed has no children, so a provider with no component renders nothing; leave a provider out
of `embeds()` to keep its URLs as links. `youtube({ name: "video" })` renames the tag for a
vocabulary that already uses the default name. A provider of your own is an object with the
tag's `name` and a `match` function that returns the tag's attributes, or `null` for a URL that
is someone else's:

```typescript {% title="app/content/codepen.ts" %}
import type { EmbedProvider } from "@sdxc/markdown/plugin/embeds";

export const CODEPEN: EmbedProvider = {
	name: "codepen",
	match(url) {
		if (url.hostname !== "codepen.io") return null;
		let [user, kind, id] = url.pathname.split("/").filter(Boolean);
		if (!user || kind !== "pen" || !id) return null;
		return { user, id };
	},
};
```

## Lint content in CI

`lint()` checks a parsed document and returns its problems as data, each a
`{ rule, message, position }` ordered by where it starts in the source. An empty array means the
document passed. Every rule runs unless you turn it off:

| Rule                | Reports                                                      |
| ------------------- | ------------------------------------------------------------ |
| `code-language`     | a code block with no language, indented code included        |
| `heading-increment` | a heading more than one level deeper than the one before it  |
| `single-h1`         | every level-1 heading after the first                        |
| `image-alt`         | an image, or an `img` element, with empty alternative text   |
| `empty-link`        | a link, or an `a` element, with an empty `href` or no text   |
| `broken-anchor`     | a `#fragment` link that matches no id in the document        |
| `duplicate-id`      | a block whose explicit `id` an earlier block already claimed |

`broken-anchor` resolves a fragment against the ids `headings()` would assign: every id an
author wrote, then a GitHub slug for each heading without one. `ids` adds the ones the page has
outside the document, such as a layout's `#comments`. A rule of your own goes in `custom`, keyed
by its name; it runs once on every node in document order and calls `report` with a message,
and optionally a position narrower or wider than the node's.

A Vitest test over every post makes the check part of CI, and the failure lists each problem with
the file and line to open:

```typescript {% title="app/content/posts.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { lint } from "@sdxc/markdown/plugin/lint";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { MARKDOWN_OPTIONS } from "~/app/content/schema";

const POSTS = import.meta.glob<string>("../../content/posts/*.md", {
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

`single-h1` is off here because the page draws the title from the frontmatter, so a post's body
may open on its own `#` heading. A `{/* TODO */}` comment is a `comment` node rather than text,
so a note an author left for editors passes the `no-todo` rule while one in the prose fails it.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the schema,
  loader and route these passes slot into.
- [Fill markdown templates with variables](/docs/content-and-feeds/markdown-variables) — fill
  per-render values before the other plugins run.
- [`@sdxc/markdown`](/api/markdown) — every option of each plugin and the full AST.
