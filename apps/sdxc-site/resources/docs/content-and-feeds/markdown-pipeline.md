---
title: A markdown content pipeline
description: Parse posts with typed frontmatter and custom tags, transform them in one walk, and render them in a Remix route.
section:
    title: Content & feeds
    order: 8
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "How to parse posts with typed frontmatter and custom tags using `@sdxc/markdown`"
    - "How to transform the tree in one walk and read it without changing it"
    - "How to render a post in a Remix route and as HTML or plain text elsewhere"
---

This guide builds the path a post takes from a `.md` file in your repository to a rendered
page: frontmatter validated against a schema, a small vocabulary of custom tags and HTML
elements checked at parse time, one tree walk that highlights code, anchors headings and
resolves links, and a Remix v3 route that renders the result through components you own.
It combines [`@sdxc/markdown`](/api/markdown), [`@sdxc/highlight`](/api/highlight) and
[`@sdxc/ui`](/api/ui), with `remix/data-schema` for the schema.

Every step answers with a `Result`, so a post with a typo in its frontmatter becomes a 404 and
a log line naming the line to fix.

```bash
npm add @sdxc/highlight @sdxc/http @sdxc/markdown @sdxc/result @sdxc/ui remix
```

## Describe what a post may contain

A post file may say three things: the fields its frontmatter carries, the tags its body may
use, and the HTML elements it may write directly. All three go in one options object.

```typescript {% title="app/services/content/schema.ts" %}
import type { Markdown } from "@sdxc/markdown";

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

const FRONTMATTER = s.object({
	title: s.string(),
	description: s.string(),
	publishedAt: coerce.date(),
	tags: s.defaulted(s.array(s.string()), []),
	draft: s.defaulted(s.boolean(), false),
});

export type Frontmatter = s.InferOutput<typeof FRONTMATTER>;

export const TAGS = {
	callout: {
		attributes: s.object({ type: s.enum_(["info", "warning", "danger"]) }),
	},
	video: { content: "none", attributes: s.object({ src: s.string() }) },
} satisfies Record<string, Markdown.TagDefinition>;

export const MARKDOWN_OPTIONS = {
	frontmatter: FRONTMATTER,
	tags: TAGS,
	html: { details: ["open"], summary: [], kbd: [], sup: [], sub: [] },
} satisfies Markdown.Options;
```

The frontmatter schema types the parse: `publishedAt` arrives as a `Date`, and a post missing
its `title` fails with the line the block starts on.

Only registered names become tags, and each tag's attribute schema moves mistakes to parse
time: `<callout type="tip">` is a parse error with a line number. `content: "none"` makes a tag
self-closing. `html` allowlists plain HTML elements and the attributes each may carry; any other
raw HTML renders as escaped text. A post then reads:

```text
<callout type="warning">
Deleting a workspace also deletes its **history**.
</callout>

<video src="/media/tour.mp4" />
```

## Transform the tree in one walk

`Markdown.walk` is the only transform. A visitor is a plain object with one handler per node
type, and `Markdown.compose` merges several so the whole preparation runs as a single pass.
`highlight` from [`@sdxc/highlight/markdown`](/api/highlight) is one such visitor:

```typescript {% title="app/services/content/prepare.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { headings } from "@sdxc/markdown/plugin/headings";
import { links } from "@sdxc/markdown/plugin/links";

const SITE_ORIGIN = "https://example.com/";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(
		document,
		Markdown.compose(highlight, headings(), links({ base: SITE_ORIGIN })),
	);
}
```

`headings()` gives every heading an `id` from its text, using GitHub's slugs, and
`links({ base })` resolves every relative URL, which matters once the same document goes into a
feed. A handler returns a node to replace, `null` to remove, or nothing to leave it alone;
[Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) covers the other
plugins and the order to list them in.

## Load and parse inside the request

Keep the files as raw strings behind a lazy glob, so a page pays for the one post it renders.

> [!WARNING]
> Parse inside the request, never at module scope. A Worker rejects an upload whose global scope
> does real work, and a local build or a dry run passes without showing it.

```typescript {% title="app/services/content/posts.ts" %}
import { Markdown } from "@sdxc/markdown";
import { isFailure, success } from "@sdxc/result";

import { preparePost } from "~/app/services/content/prepare";
import { MARKDOWN_OPTIONS } from "~/app/services/content/schema";

export const POSTS = import.meta.glob<string>("/resources/content/posts/*.md", {
	query: "?raw",
	import: "default",
});

export async function readPost(slug: string) {
	let load = POSTS[`/resources/content/posts/${slug}.md`];
	if (!load) return null;

	let parsed = Markdown.parse(await load(), MARKDOWN_OPTIONS);
	if (isFailure(parsed)) return parsed;

	let prepared = preparePost(parsed.data.document);
	if (isFailure(prepared)) return prepared;

	return success({ frontmatter: parsed.data.frontmatter, document: prepared.data });
}
```

An index page, a feed or a sitemap needs only titles and dates, so `listPosts` reads each file
with `Markdown.frontmatter`, which takes the same options and stops after the block, and answers
the published posts newest first:

```typescript {% title="app/services/content/list-posts.ts" %}
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

import type { Frontmatter } from "~/app/services/content/schema";

import { POSTS } from "~/app/services/content/posts";
import { MARKDOWN_OPTIONS } from "~/app/services/content/schema";

export async function listPosts() {
	let posts: Array<Frontmatter & { slug: string }> = [];

	for (let [path, load] of Object.entries(POSTS)) {
		let read = Markdown.frontmatter(await load(), MARKDOWN_OPTIONS);
		if (isFailure(read) || read.data.frontmatter.draft) continue;
		let slug = path.slice(path.lastIndexOf("/") + 1, -".md".length);
		posts.push({ ...read.data.frontmatter, slug });
	}

	return posts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
```

## Read the tree without changing it

`tableOfContents` reads the ids the preparation pass wrote back as a tree, levels 2 and 3 by
default, each entry with its deeper headings as `children`. It skips a heading with no id, so it
reads the prepared document:

```tsx {% title="resources/components/toc.tsx" %}
import type { TableOfContentsEntry } from "@sdxc/markdown/plugin/headings";
import type { Handle } from "remix/component";

export function TocList(handle: Handle<{ entries: TableOfContentsEntry[] }>) {
	return () => (
		<ol>
			{handle.props.entries.map((entry) => (
				<li>
					<a href={`#${entry.id}`}>{entry.text}</a>
					{entry.children.length > 0 && (
						<TocList entries={entry.children} />
					)}
				</li>
			))}
		</ol>
	);
}
```

A visitor whose handlers return nothing changes nothing, so `Markdown.walk` doubles as a
read-only traversal for anything else you need to collect.

## Render it in a route

`toRemix` from `@sdxc/markdown/remix` turns the tree into `remix/component` nodes, and its
`components` map gives each tag its markup. A component receives the tag's validated attributes
as props, plus its rendered `children`:

```tsx {% title="resources/components/callout.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { Alert } from "@sdxc/ui";

const CALLOUT_COLORS = {
	info: "brand",
	warning: "warning",
	danger: "danger",
} as const;

interface CalloutProps {
	type: keyof typeof CALLOUT_COLORS;
	children: RemixNode;
}

export function Callout(handle: Handle<CalloutProps>) {
	return () => (
		<Alert color={CALLOUT_COLORS[handle.props.type]} live="off">
			<Alert.Content>{handle.props.children}</Alert.Content>
		</Alert>
	);
}
```

The controller answers a `posts.show` route declared as `get("/posts/:slug")`. It turns both
kinds of failure into a 404, and wraps the output in `Typeset`, which styles markup it did not
write:

```tsx {% title="app/http/controllers/posts/show.tsx" %}
import { notFound } from "@sdxc/http/response/html";
import { tableOfContents } from "@sdxc/markdown/plugin/headings";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Callout } from "~/resources/components/callout";
import { TocList } from "~/resources/components/toc";
import { readPost } from "~/app/services/content/posts";
import routes from "~/routes/web";

export default createAction(routes.posts.show, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

	let post = await readPost(slug);
	if (post === null) return notFound("No such post");
	if (isFailure(post)) {
		ctx.log.fail(post.error, {
			slug,
			line: post.error.position?.start.line ?? null,
		});
		return notFound("No such post");
	}

	let { frontmatter, document } = post.data;
	return ctx.render(
		<article>
			<h1>{frontmatter.title}</h1>
			<nav aria-label="On this page">
				<TocList entries={tableOfContents(document)} />
			</nav>
			<Typeset preset="reading">
				{toRemix(document, { components: { callout: Callout } })}
			</Typeset>
		</article>,
	);
});
```

A tag with no component renders only its children, so `video` shows nothing until you register
one. The highlighted code needs the highlighter's stylesheet, imported from your document layout
after the theme, with the [rest of the page's stylesheets](/docs/building-remix-apps/interface-with-remix-ui#the-stylesheets):

```tsx {% title="resources/components/document.tsx" %}
import "@sdxc/highlight/styles.css";
```

## HTML and plain text for everything else

A feed body, an email or a JSON API wants a string. `toHTML` renders any node as static HTML,
with its own `tags` map, and `toPlainText` gives the prose alone:

```typescript {% title="app/services/content/render.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";

export function renderHTML(document: Markdown.Document): string {
	return toHTML(document, {
		tags: {
			callout: ({ attributes, children }) =>
				`<aside class="callout" data-type="${attributes.type}">` +
				`${children}</aside>`,
		},
	});
}

export function summarize(document: Markdown.Document): string {
	return toPlainText(document).slice(0, 160);
}
```

> [!WARNING]
> Interpolating `attributes.type` is safe only because its schema allows three fixed words. Escape
> an attribute that takes free text before it goes into markup.

## Test it

Test the walk, where a post gains its anchors and absolute links, and the route, where a
missing post becomes a 404:

```typescript {% title="app/services/content/prepare.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { preparePost } from "~/app/services/content/prepare";

test("anchors headings and resolves relative links", () => {
	let { document } = unwrap(
		Markdown.parse("## Install it\n\nRead [the setup](/docs/setup).\n"),
	);

	let html = toHTML(unwrap(preparePost(document)));

	expect(html).toContain('<h2 id="install-it">');
	expect(html).toContain('href="https://example.com/docs/setup"');
});
```

```typescript {% title="app/http/controllers/posts/show.test.tsx" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

test("answers 404 for a post that does not exist", async () => {
	let response = await createWebRouter().fetch(
		new URL(
			routes.posts.show.href({ slug: "no-such-post" }),
			"https://example.com",
		),
	);

	expect(response.status).toBe(404);
});
```

## Where to go next

- [Anchor, polish and lint markdown](/docs/content-and-feeds/markdown-plugins) — typographic
  punctuation, embeds from pasted URLs, link rewriting and a content check in CI.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — serve these
  posts to feed readers, with `toHTML` supplying each item's body.
- [`@sdxc/markdown`](/api/markdown) — variables, annotations, GitHub alerts and the full AST.
