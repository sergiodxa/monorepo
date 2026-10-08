---
title: Offer posts as EPUB ebooks
description: Turn a markdown post into an EPUB with a nested table of contents and accessibility metadata, refused at build time wherever epubcheck would reject it, and serve it as a download.
section:
    title: Content & feeds
    order: 7
order: 20
lastUpdated: 2026-10-08
---

A long tutorial is the kind of page people want to read away from the browser: on an e-reader,
in a phone's reading app, or sent to a Kindle with their own highlights. EPUB is the format all
of them open, and an `.epub` beside each post costs a reader one click.

An EPUB is a ZIP of XHTML documents, a package document that lists every file, and a navigation
document for the table of contents. Reading systems are strict about it: a chapter that is not
well-formed XML, an image the package does not carry, or a missing modification date makes a
book that some apps refuse and others open broken. [`@sdxc/epub`](/api/epub) writes the whole
container and refuses at build time what epubcheck reports as an error, so a successful
`Result` is a file that opens. [`@sdxc/markdown`](/api/markdown) renders the chapters as XHTML,
and [`@sdxc/http`](/api/http) names the download.

```bash
npm add @sdxc/epub @sdxc/markdown @sdxc/result @sdxc/http remix
```

The posts here are parsed the way
[A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) parses them: a
`readPost(slug)` that answers with the frontmatter and the document.

## Render a chapter body

A chapter's `body` is the XHTML inside `<body>`. `toHTML` writes XHTML when asked with
`syntax: "xhtml"`: every void element is self-closed and every boolean attribute carries a
value, which is what an XML parser accepts. Before rendering, one walk prepares the document for
a file that leaves your site:

- `headings()` gives every heading an `id`, and `tableOfContents` reads them back as the tree
  the book's table of contents nests under the chapter.
- `links({ base })` resolves every relative link against the post's permalink, so a link to
  `/about` still opens your site from inside the book.
- Images become links to the online copy. An EPUB embeds only the files it carries, and an image
  loaded from the web fails the build with `remote-resource`.

```typescript {% title="app/books/chapter.ts" %}
import type { EPUB } from "@sdxc/epub";
import type { TableOfContentsEntry } from "@sdxc/markdown/plugin/headings";

import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { toPlainText } from "@sdxc/markdown/plain";
import { headings, tableOfContents } from "@sdxc/markdown/plugin/headings";
import { links } from "@sdxc/markdown/plugin/links";
import { isFailure, success } from "@sdxc/result";

export function chapterBody(document: Markdown.Document, permalink: string) {
	let walked = Markdown.walk(document, {
		...headings({ levels: [2, 3] }),
		...links({ base: permalink }),
		image(node, parent) {
			let alt = toPlainText(node, { images: true }).trim();
			let label = alt ? `Image: ${alt}` : "Image";
			let text = {
				type: "text",
				value: label,
				position: node.position,
			} as const;
			if (parent?.type === "link") return text;
			return {
				type: "link",
				href: new URL(node.src, permalink).href,
				children: [text],
				position: node.position,
			} as const;
		},
	});
	if (isFailure(walked)) return walked;

	return success({
		body: toHTML(walked.data, { syntax: "xhtml" }),
		sections: toSections(tableOfContents(walked.data)),
	});
}

function toSections(entries: TableOfContentsEntry[]): EPUB.Section[] {
	return entries.map((entry) => ({
		title: entry.text,
		fragment: entry.id,
		sections: toSections(entry.children),
	}));
}
```

An image already inside a link becomes its label alone, since a link inside a link is not
valid XHTML. A fragment-only link such as `#install` stays as written and opens the heading in
the same chapter, because the `id` it names is in the body. A heading that already carries an
`id` keeps it.

## Build the book

`EPUB.build` takes metadata, chapters, stylesheets and resources, and answers with the
publication or the first rule the input breaks:

```typescript {% title="app/books/post-epub.ts" %}
import type { Markdown } from "@sdxc/markdown";

import { EPUB } from "@sdxc/epub";
import { isFailure } from "@sdxc/result";

import bookCss from "~/app/books/book.css?raw";
import { chapterBody } from "~/app/books/chapter";

export interface PostBook {
	title: string;
	description: string;
	permalink: string;
	author: string;
	publishedAt: Date;
	updatedAt: Date;
	document: Markdown.Document;
}

export function postEpub(post: PostBook) {
	let chapter = chapterBody(post.document, post.permalink);
	if (isFailure(chapter)) return chapter;

	return EPUB.build({
		metadata: {
			identifier: post.permalink,
			title: post.title,
			language: "en",
			modified: post.updatedAt,
			published: post.publishedAt,
			creators: [{ name: post.author, role: "aut" }],
			description: post.description,
			accessibility: {
				summary: "Text with structured headings and a table of contents.",
				modes: ["textual"],
				modesSufficient: ["textual"],
				features: ["structuralNavigation", "tableOfContents"],
				hazards: ["none"],
			},
		},
		styles: [{ path: "styles/book.css", text: bookCss }],
		chapters: [
			{
				id: "post",
				title: post.title,
				body: `<h1>${escapeXml(post.title)}</h1>\n${chapter.data.body}`,
				sections: chapter.data.sections,
			},
		],
	});
}

function escapeXml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
```

The `identifier` is how a reading app recognises the book in its library. The permalink is
stable per post, so downloading the post again after an edit replaces the copy a reader already
has instead of adding a second book. `modified`, written to the second, is what tells a reading
app the file changed, so pass the time of the post's last edit.

The required metadata is `identifier`, `title`, a BCP 47 `language` and `modified`. Everything
else is optional, and `creators` takes a MARC relator `role` (`aut` for an author, `edt` for an
editor) and a sortable `fileAs` such as `Doe, Jane`.

Accessibility metadata is written only when you pass it, since it is a claim about the content.
The values above describe text with headings and a table of contents, which is what a rendered
post is. Add `conformsTo` once the book has been evaluated against a standard such as
`EPUB Accessibility 1.1 - WCAG 2.1 Level AA`.

The stylesheet is your own CSS, linked from every chapter. Keep it self-contained: a font or
background image loaded from the web fails with `remote-resource`, and one the book carries goes
in `resources`, as the next section shows.

## Serve the download

The action reads the post, builds the book and streams it. `attachment()` writes the
`Content-Disposition` value, with a non-ASCII slug carried exactly:

```typescript {% title="app/http/controllers/posts/epub.ts" %}
import { attachment } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { postEpub } from "~/app/books/post-epub";
import { readPost } from "~/app/content/posts";
import routes from "~/routes/web";

export default createAction(routes.posts.epub, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

	let post = await readPost(slug);
	if (post === null || isFailure(post)) return notFound("No such post");

	let { frontmatter, document } = post.data;
	let built = postEpub({
		title: frontmatter.title,
		description: frontmatter.description,
		permalink: new URL(routes.posts.show.href({ slug }), ctx.url).href,
		author: "Jane Doe",
		publishedAt: frontmatter.publishedAt,
		updatedAt: frontmatter.publishedAt,
		document,
	});
	if (isFailure(built)) {
		ctx.log.fail(built.error, { slug, format: "epub" });
		return new Response("This post could not be made into an ebook.", {
			status: 500,
		});
	}

	return new Response(built.data.stream(), {
		headers: {
			"Content-Type": "application/epub+zip",
			"Content-Disposition": attachment(`${slug}.epub`),
		},
	});
});
```

These posts carry no edit date, so `publishedAt` stands in for `updatedAt`; a post that records
when it last changed passes that instead. `stream()` writes `mimetype` first, as the format
requires, with every entry stored uncompressed. The whole book is already in memory, so the
response never waits on a source. `bytes()` answers the same file as one `Uint8Array` in a `Result`, for
storing it or attaching it to an email.

The book changes only when the post does, so it caches the way the post's page does.

## Read a build failure

Every failure is an `EpubError` with a `code` and the chapter id or container `path` it
concerns, which is what to log to find the input. Each code is its own subclass, so checking
`code` narrows the error:

| `code`              | When                                                                              |
| ------------------- | --------------------------------------------------------------------------------- |
| `invalid-metadata`  | An empty title or identifier, an invalid date, a malformed language tag           |
| `invalid-content`   | A body that is not well-formed, or holds `<script>`, an `on*` handler, a `<form>` |
| `missing-resource`  | A `src`, `href` or CSS `url()` naming no file, or a fragment naming no `id`       |
| `remote-resource`   | An image, stylesheet or font loaded from the web; a link to the web is fine       |
| `unsupported-media` | A resource whose extension is no EPUB core media type                             |
| `invalid-path`      | A malformed path or id, or two that differ only in case                           |

For `invalid-content`, `cause` carries the XML parser's error with the position it stopped at.
Each body is parsed and serialized again, which is also what turns a named entity such as
`&nbsp;` into the character it stands for, so markup copied from an HTML page needs no
rewriting for those.

## Carry images and several chapters

A book from a series of posts is one chapter per post, in reading order. Each chapter is written
at `EPUB/text/<id>.xhtml`, and every reference inside a body resolves from there: an image
carried at `images/diagram.svg` is `../images/diagram.svg`, and another chapter is
`<id>.xhtml`, with a fragment when it points inside it.

```typescript {% title="app/books/series-epub.ts" %}
import { EPUB } from "@sdxc/epub";

import bookCss from "~/app/books/book.css?raw";

export interface SeriesChapter {
	slug: string;
	title: string;
	body: string;
	sections: EPUB.Section[];
}

export interface SeriesBook {
	permalink: string;
	title: string;
	updatedAt: Date;
	cover: Uint8Array;
	diagram: Uint8Array;
	parts: SeriesChapter[];
}

export function seriesEpub(series: SeriesBook) {
	return EPUB.build({
		metadata: {
			identifier: series.permalink,
			title: series.title,
			language: "en",
			modified: series.updatedAt,
			creators: [{ name: "Jane Doe", role: "aut", fileAs: "Doe, Jane" }],
		},
		cover: {
			image: { path: "images/cover.jpg", bytes: series.cover },
			alt: `The cover of ${series.title}`,
		},
		styles: [{ path: "styles/book.css", text: bookCss }],
		resources: [{ path: "images/diagram.svg", bytes: series.diagram }],
		chapters: [
			{
				id: "copyright",
				title: "Copyright",
				body: `<p>© ${series.updatedAt.getUTCFullYear()} Jane Doe</p>`,
				toc: false,
			},
			...series.parts.map((part) => ({
				id: `part-${part.slug}`,
				title: part.title,
				body: part.body,
				sections: part.sections,
			})),
		],
	});
}
```

The `cover` is shown as the first page and named as the cover image to every reading system,
which is what a library view draws. The copyright page stays in the reading order but out of the
table of contents, with `toc: false`. `linear: false` takes a chapter out of the reading order
for supplementary content, and a chapter out of both is accepted only when another chapter links
to it, since a reader could never open it otherwise.

A chapter `id` starts with a letter or `_` and uses letters, digits, `.`, `_` and `-`, which is
why the slug is prefixed. Resource paths are relative and `/`-separated with the same
characters, and each one's media type comes from its extension: CSS, JPEG, PNG, GIF, WebP, SVG,
WOFF, WOFF2, OTF, TTF, MP3 and M4A. An `<svg>` or MathML inside a chapter is detected from the
content and declared for you.

Write a link between posts of the series to the other chapter (`part-setup.xhtml#install`), so
it opens inside the book. For a book in another language, `labels` sets the `contents`,
`landmarks`, `cover` and `start` text the navigation document shows.

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the `readPost`
  the download reads, with highlighted code and custom tags.
- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds) — the same posts for
  feed readers.
- [Stream several files as a ZIP](/docs/data-and-background-work/zip-downloads) — the
  container format an EPUB is written in, for downloads of your own.
- [`@sdxc/epub`](/api/epub) — every field of the input and every error subclass.
