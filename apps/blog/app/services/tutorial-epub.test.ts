/**
 * Tests for the tutorial EPUB: the page's highlighted document adapted for a file read away
 * from the site — links made absolute, images turned into links, sections anchored and nested
 * — under the permalink as the identifier, so a second download replaces the first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { TutorialEpubInput } from "./tutorial-epub";

import { tutorialEpub } from "./tutorial-epub";

/** The permalink every fixture tutorial lives at. */
const URL_ = "https://sergiodxa.com/tutorials/route-middleware";

/** A tutorial body exercising every adaptation the EPUB makes. */
const SOURCE = `Middleware runs before your loaders. See [the docs](/articles/middleware) or [jump down](#later).

![A diagram of the middleware chain](/images/chain.png)

[![A linked badge](https://example.com/badge.svg)](https://example.com)

## Add the Middleware

\`\`\`ts {% path="app/middleware.ts" %}
export let middleware = [timing()];
\`\`\`

### Order Matters

Run timing first.

## Final Thoughts

That is all.
`;

/** The highlighted document for {@link SOURCE}, as the page view model builds it. */
function document(source = SOURCE): Markdown.Document {
	let parsed = Markdown.parse(source);
	if (isFailure(parsed)) throw parsed.error;
	let walked = Markdown.walk(parsed.data.document, highlight);
	if (isFailure(walked)) throw walked.error;
	return walked.data;
}

/** A complete input for one tutorial, with any field overridden. */
function input(overrides: Partial<TutorialEpubInput> = {}): TutorialEpubInput {
	return {
		title: "Add Route Middleware <Safely>",
		excerpt: "Learn how middleware runs.",
		tags: ["react-router@7.9.0", "remix"],
		document: document(),
		url: URL_,
		published: new Date("2026-07-01T00:00:00Z"),
		publishedLabel: "July 1, 2026",
		modified: new Date("2026-07-02T10:00:00Z"),
		...overrides,
	};
}

/** The text of one file of the built EPUB. */
function file(built: ReturnType<typeof tutorialEpub>, path: string): string {
	if (isFailure(built)) throw built.error;
	let found = built.data.files.find((candidate) => candidate.path === path);
	if (!found) throw new Error(`No ${path} in the EPUB`);
	return new TextDecoder().decode(found.bytes);
}

describe("tutorialEpub", () => {
	test("opens with the title, the technologies used, and a link to read it online", () => {
		let chapter = file(tutorialEpub(input()), "EPUB/text/tutorial.xhtml");

		expect(chapter).toContain("<h1>Add Route Middleware &lt;Safely&gt;</h1>");
		expect(chapter).toContain('<p class="used">Used: react-router@7.9.0 · remix</p>');
		expect(chapter).toContain(`· July 1, 2026 · <a href="${URL_}">Read it online</a>`);
	});

	test("points site-relative links and fragments back at the blog", () => {
		let chapter = file(tutorialEpub(input()), "EPUB/text/tutorial.xhtml");

		expect(chapter).toContain('<a href="https://sergiodxa.com/articles/middleware">the docs</a>');
		expect(chapter).toContain(`<a href="${URL_}#later">jump down</a>`);
	});

	test("turns an image into a link to it, and a linked image into the link's text", () => {
		let chapter = file(tutorialEpub(input()), "EPUB/text/tutorial.xhtml");

		expect(chapter).toContain(
			'<a href="https://sergiodxa.com/images/chain.png">Image: A diagram of the middleware chain</a>',
		);
		expect(chapter).toContain('<a href="https://example.com/">Image: A linked badge</a>');
		expect(chapter).not.toContain("<img");
	});

	test("anchors each ## and ### and nests the table of contents the same way", () => {
		let built = tutorialEpub(input());
		let chapter = file(built, "EPUB/text/tutorial.xhtml");
		let nav = file(built, "EPUB/nav.xhtml");

		expect(chapter).toContain('<h2 id="section-add-the-middleware">Add the Middleware</h2>');
		expect(nav).toMatch(
			/#section-add-the-middleware">Add the Middleware<\/a>\s*<ol>\s*<li>\s*<a href="text\/tutorial\.xhtml#section-order-matters">Order Matters/,
		);
		expect(nav).toContain('#section-final-thoughts">Final Thoughts</a>');
	});

	test("keeps the highlighted code", () => {
		let chapter = file(tutorialEpub(input()), "EPUB/text/tutorial.xhtml");

		expect(chapter).toContain(
			'<pre class="md-code language-typescript" data-path="app/middleware.ts">',
		);
		expect(chapter).toContain('class="token keyword"');
	});

	test("uses the permalink as the identifier and the last edit as modified", () => {
		let opf = file(tutorialEpub(input()), "EPUB/package.opf");

		expect(opf).toContain(`<dc:identifier id="pub-id">${URL_}</dc:identifier>`);
		expect(opf).toContain('<meta property="dcterms:modified">2026-07-02T10:00:00Z</meta>');
		expect(opf).toContain("<dc:date>2026-07-01</dc:date>");
		expect(opf).toContain("<dc:subject>remix</dc:subject>");
		expect(opf).toContain("<dc:description>Learn how middleware runs.</dc:description>");
	});

	test("builds a tutorial with no content and no publish date", () => {
		let built = tutorialEpub(
			input({ document: null, published: null, publishedLabel: "", tags: [] }),
		);

		expect(isSuccess(built)).toBe(true);
		let chapter = file(built, "EPUB/text/tutorial.xhtml");
		expect(chapter).toContain("<p>No content.</p>");
		expect(chapter).not.toContain('class="used"');
	});

	test("gives repeated headings distinct anchors", () => {
		let built = tutorialEpub(input({ document: document("## Setup\n\nA\n\n## Setup\n\nB\n") }));
		let chapter = file(built, "EPUB/text/tutorial.xhtml");

		expect(chapter).toContain('<h2 id="section-setup">Setup</h2>');
		expect(chapter).toContain('<h2 id="section-setup-2">Setup</h2>');
	});
});
