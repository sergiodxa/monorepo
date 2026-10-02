---
title: A markdown content pipeline
description: Parse posts with typed frontmatter and custom tags, transform them in one walk, and render them in a Remix route.
section:
    title: Content & feeds
    order: 7
order: 1
lastUpdated: 2026-09-29
---

This guide builds the path a post takes from a `.md` file in your repository to a rendered
page: frontmatter validated against a schema, a small vocabulary of custom tags checked at
parse time, one tree walk that highlights code and anchors headings, and a Remix v3 route that
renders the result through components you own. It combines
[`@sdxc/markdown`](/api/markdown), [`@sdxc/highlight`](/api/highlight) and
[`@sdxc/ui`](/api/ui), with `remix/data-schema` for the schema.

Every step answers with a `Result`, so a post with a typo in its frontmatter becomes a 404 and
a log line naming the line to fix, not an exception halfway through a render.

```bash
npm add remix @sdxc/markdown @sdxc/highlight @sdxc/ui @sdxc/result @sdxc/http
```

## Describe what a post may contain

Start with the two things a post file is allowed to say: the fields its frontmatter carries,
and the tags its body may use. Both are schemas, and both go in one options object that every
read of a post shares.

```typescript {% title="app/content/schema.ts" %}
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
} satisfies Markdown.Options;
```

The frontmatter schema is what types the parse. `publishedAt` arrives as a `Date` because
`coerce.date()` converts the YAML string, and a post missing its `title` fails with the line the
block starts on. Any [Standard Schema](/docs/conventions/standard-schema-validation) works here;
`remix/data-schema` is the one the rest of a Remix app already uses.

A tag is an element the parser knows by name. Only registered names become tags, so an
unregistered `<div>` stays raw HTML and renders as escaped text. Registering one with an
attribute schema moves a whole class of mistakes to parse time: `<callout type="tip">` is a
parse error with a line number rather than a box that renders without a colour. `content`
decides what the parser reads inside the tag: blocks by default, `"inline"` for a tag inside a
sentence, and `"none"` for a self-closing one. A post then reads:

```text
<callout type="warning">
Deleting a workspace also deletes its **history**.
</callout>

<video src="/media/tour.mp4" />
```

## Transform the tree in one walk

`Markdown.walk` is the only transform. A visitor is a plain object with one handler per node
type, so visitors merge by spread and a whole preparation runs as a single pass. `highlight`
from [`@sdxc/highlight/markdown`](/api/highlight) is exactly such an object, holding one `code`
handler that attaches the painted tokens to each fence.

```typescript {% title="app/content/prepare.ts" %}
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";

const SITE_ORIGIN = "https://example.com";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function preparePost(document: Markdown.Document) {
	let taken = new Map<string, number>();

	return Markdown.walk(document, {
		...highlight,
		heading(node) {
			if (typeof node.attributes.id === "string") return;
			let base = slugify(toPlainText(node));
			let seen = taken.get(base) ?? 0;
			taken.set(base, seen + 1);
			let id = seen === 0 ? base : `${base}-${seen}`;
			return { ...node, attributes: { ...node.attributes, id } };
		},
		link(node) {
			if (!node.href.startsWith("/")) return;
			return { ...node, href: new URL(node.href, SITE_ORIGIN).href };
		},
	});
}
```

What a handler returns decides the node's fate: a node replaces it, `null` removes it, and
returning nothing leaves it alone. A heading an author already gave an id with
`{% #install %}` keeps it, and a repeated heading gets a suffix so every one stays linkable.
Absolute links matter once the same document is rendered into a feed, where a reader resolves
`/posts/…` against the wrong origin.

Every handler here is synchronous, so the walk answers with a `Result` rather than a promise.
A handler that throws lands on the failure branch with the node's position attached, which is
how a check you add later (a code block with no language, say) reports the line it found.

## Load and parse inside the request

Keep the files as raw strings and parse per request. A Worker rejects an upload whose global
scope does real work, and a lazy glob means a page pays for the one post it renders.

```typescript {% title="app/content/posts.ts" %}
import { Markdown } from "@sdxc/markdown";
import { isFailure, success } from "@sdxc/result";

import { preparePost } from "~/app/content/prepare";
import { MARKDOWN_OPTIONS } from "~/app/content/schema";

export const POSTS = import.meta.glob<string>("../../content/posts/*.md", {
	query: "?raw",
	import: "default",
});

export async function readPost(slug: string) {
	let load = POSTS[`../../content/posts/${slug}.md`];
	if (!load) return null;

	let parsed = Markdown.parse(await load(), MARKDOWN_OPTIONS);
	if (isFailure(parsed)) return parsed;

	let prepared = preparePost(parsed.data.document);
	if (isFailure(prepared)) return prepared;

	return success({ frontmatter: parsed.data.frontmatter, document: prepared.data });
}
```

An index page needs titles and dates, not bodies. `Markdown.frontmatter` takes the same options
and stops after the block, so listing a hundred posts reads a hundred frontmatter blocks and
parses no markdown at all. It reads the same `POSTS` glob the loader above exports:

```typescript {% title="app/content/list-posts.ts" %}
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

import type { Frontmatter } from "~/app/content/schema";

import { POSTS } from "~/app/content/posts";
import { MARKDOWN_OPTIONS } from "~/app/content/schema";

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

A handler that returns nothing changes nothing, so the same walk doubles as a traversal. The
table of contents reads the ids the preparation pass wrote:

```typescript {% title="app/content/toc.ts" %}
import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";

export function tableOfContents(document: Markdown.Document) {
	let entries: Array<{ id: string; text: string; level: number }> = [];

	Markdown.walk(document, {
		heading(node) {
			let id = node.attributes.id;
			if (node.level > 3 || typeof id !== "string") return;
			entries.push({ id, text: toPlainText(node), level: node.level });
		},
	});

	return entries;
}
```

`toPlainText` takes any node, which is what makes it usable inside a visitor. Called on the
whole document it gives you the prose for a word count or a search index; pass
`{ code: true }` to include the bodies of code blocks.

## Render it in a route

`toRemix` from `@sdxc/markdown/remix` turns the tree into `remix/component` nodes, and its
`components` map is where a tag gets its markup. A component receives the tag's attributes as
props, already validated by the schema you registered, plus its rendered `children`:

```tsx {% title="app/components/callout.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import { Alert } from "@sdxc/ui";

const CALLOUT_COLORS = {
	info: "brand",
	warning: "warning",
	danger: "danger",
} as const;

interface CalloutProps {
	[key: string]: unknown;
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

The index signature is what lets `Callout` sit in the `components` map, which hands every
component the node's whole bag of attributes; the named fields are the ones it reads.

The controller is mapped to a `posts.show` route declared as `get("/posts/:slug")` in your
`routes/web.ts`. It reads the slug, handles both kinds of failure the same way, and wraps the output
in `Typeset`, which supplies the sizes, spacing and colours for markup it did not write:

```tsx {% title="app/http/controllers/posts/show.tsx" %}
import { notFound } from "@sdxc/http/response/html";
import { toRemix } from "@sdxc/markdown/remix";
import { isFailure } from "@sdxc/result";
import { Typeset } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Callout } from "~/app/components/callout";
import { readPost } from "~/app/content/posts";
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
			<Typeset preset="reading">
				{toRemix(document, { components: { callout: Callout } })}
			</Typeset>
		</article>,
	);
});
```

A tag with no component renders its children and nothing else, so `video` above shows nothing
until you register one, and a missing component drops the chrome while keeping the content.
The same map takes over built-in nodes when you key it by node type (`code`, `heading`,
`link`, `alert`).

The painted tokens become `<span class="token …">` runs, and the stylesheet that colours them
ships with the highlighter. Link it from your document layout:

```tsx {% title="app/components/document.tsx" %}
import highlightStyles from "@sdxc/highlight/styles.css?url";

<link rel="stylesheet" href={highlightStyles} />;
```

## HTML and plain text for everything else

A feed body, an email or a JSON API wants a string rather than UI nodes. `toHTML` renders any
node as static HTML, with its own `tags` map returning markup for each tag:

```typescript {% title="app/content/render.ts" %}
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

Interpolating `attributes.type` is safe only because its schema allows three fixed words; an
attribute that takes free text has to be escaped before it goes into markup. Raw HTML an author
typed renders as escaped text in both renderers, so neither one writes markup you did not vet.

## Where to go next

- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — serve these
  posts to feed readers, with `toHTML` supplying each item's body.
- [Join the IndieWeb](/docs/content-and-feeds/indieweb) — send a Webmention to every page a
  post links to.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) — the
  components and mixins the page around the article is built from.
- [`@sdxc/markdown`](/api/markdown) — variables, annotations, GitHub alerts and the full AST.
