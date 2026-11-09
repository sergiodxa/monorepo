/**
 * Tests for `fromMarkdown`: how a file or a book folder becomes title page, opening page and
 * chapters, how references are placed and rewritten, which structures are refused, and that
 * every input it answers builds into a publication `EPUB.build` accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { MarkdownBook } from "./markdown.js";

import { EPUB } from "./epub.js";
import { fromMarkdown } from "./markdown.js";

/** A one-pixel PNG, enough for an image reference to resolve. */
const PIXEL = readFileSync(path.join(import.meta.dirname, "fixtures/media/EPUB/images/pixel.png"));

/** A small TrueType font whose license allows embedding. */
const FONT = readFileSync(
	path.join(import.meta.dirname, "../../font/src/fixtures/RobotoSerif/RobotoSerif-Subset.ttf"),
);

/** A fixed `modified`, so derived output does not depend on the clock. */
const MODIFIED = new Date("2026-11-08T00:00:00Z");

/** A `read` over an in-memory folder; the paths it was asked for are recorded in order. */
function memory(files: Record<string, string | Uint8Array>) {
	let asked: string[] = [];
	let read = async (file: string): Promise<MarkdownBook.File | null> => {
		asked.push(file);
		let content = files[file];
		if (content === undefined) return null;
		return { bytes: typeof content === "string" ? new TextEncoder().encode(content) : content };
	};
	return { read, asked, files: Object.keys(files) };
}

/** Builds a single-file book and answers its input, failing the test on any error. */
async function single(
	text: string,
	files: Record<string, string | Uint8Array> = {},
	options: Partial<MarkdownBook.Options> = {},
): Promise<MarkdownBook.Book> {
	let book = await fromMarkdown({
		source: { file: "book.md", text },
		read: memory(files).read,
		metadata: { modified: MODIFIED },
		...options,
	});
	if (isFailure(book)) throw book.error;
	return book.data;
}

/** The XHTML body of a page, as `EPUB.build` writes it. */
function page(book: MarkdownBook.Book, id: string): string {
	let built = EPUB.build(book.input);
	if (isFailure(built)) throw built.error;
	let file = built.data.files.find((candidate) => candidate.path === `EPUB/text/${id}.xhtml`);
	return new TextDecoder().decode(file?.bytes);
}

/** A file of the built container as text. */
function container(book: MarkdownBook.Book, file: string): string {
	let built = EPUB.build(book.input);
	if (isFailure(built)) throw built.error;
	return new TextDecoder().decode(
		built.data.files.find((candidate) => candidate.path === file)?.bytes,
	);
}

describe("fromMarkdown with a single file", () => {
	test("makes the # heading a title page and each ## heading a chapter", async () => {
		let book = await single(
			"---\nauthor: Jane Doe\n---\n# A Book\n\nFor Sam.\n\n## One\n\nHi.\n\n## Two\n\nBye.\n",
		);

		expect(book.input.metadata.title).toBe("A Book");
		expect(book.input.chapters.map((chapter) => [chapter.id, chapter.toc !== false])).toEqual([
			["title-page", false],
			["opening", false],
			["one", true],
			["two", true],
		]);
		expect(page(book, "title-page")).toContain(
			'<section class="title-page"><h1 id="a-book">A Book</h1><p class="title-page-authors">Jane Doe</p></section>',
		);
		expect(page(book, "opening")).toContain("<p>For Sam.</p>");
	});

	test("turns a file with no ## heading into one chapter titled after the book", async () => {
		let book = await single("# Notes\n\nJust a page.\n");

		expect(book.input.chapters.map((chapter) => [chapter.id, chapter.title])).toEqual([
			["title-page", "Notes"],
			["chapter-1", "Notes"],
		]);
	});

	test("lists deeper headings as sections down to tocDepth", async () => {
		let text = "# B\n\n## One\n\n### Part\n\n#### Detail\n\n##### Deep\n";

		let three = await single(text);
		let one = await single(text, {}, { tocDepth: 1 });

		expect(three.input.chapters.at(-1)?.sections).toEqual([
			{
				title: "Part",
				fragment: "part",
				sections: [{ title: "Detail", fragment: "detail", sections: [] }],
			},
		]);
		expect(one.input.chapters.at(-1)?.sections).toBeUndefined();
	});

	test("points images at their container path and links at the chapter holding the heading", async () => {
		let book = await single(
			"# B\n\n## One\n\nSee [two](#two) and ![dot](img/dot.png).\n\n## Two\n\n![up](../shared/dot.png)\n",
			{ "img/dot.png": PIXEL, "../shared/dot.png": PIXEL },
		);

		expect(page(book, "one")).toContain('<a href="two.xhtml#two">two</a>');
		expect(page(book, "one")).toContain('<img src="../img/dot.png" alt="dot"/>');
		expect(page(book, "two")).toContain('<img src="../_parent/shared/dot.png" alt="up"/>');
	});

	test("keeps each footnote with the chapter that cites it", async () => {
		let book = await single("# B\n\n## One\n\nA.[^x]\n\n## Two\n\nB.\n\n[^x]: Only in one.\n");

		expect(page(book, "one")).toContain("Only in one.");
		expect(page(book, "two")).not.toContain("Only in one.");
	});

	test("lets the caller's metadata win over the frontmatter and the heading", async () => {
		let book = await single(
			"---\ntitle: From YAML\nlanguage: fr\n---\n# From Heading\n\n## One\n",
			{},
			{
				metadata: { title: "From Caller", modified: MODIFIED },
			},
		);

		expect(book.input.metadata.title).toBe("From Caller");
		expect(book.input.metadata.language).toBe("fr");
	});

	test("derives the same identifier for the same title and authors", async () => {
		let first = await single("---\nauthor: A\n---\n# T\n\n## One\n");
		let second = await single("---\nauthor: A\n---\n# T\n\n## Other\n");
		let other = await single("---\nauthor: B\n---\n# T\n\n## One\n");

		expect(first.input.metadata.identifier).toMatch(
			/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
		);
		expect(second.input.metadata.identifier).toBe(first.input.metadata.identifier);
		expect(other.input.metadata.identifier).not.toBe(first.input.metadata.identifier);
	});

	test("reads the cover the frontmatter names", async () => {
		let book = await single("---\ncover: cover.png\ncover-alt: A dot\n---\n# B\n\n## One\n", {
			"cover.png": PIXEL,
		});

		expect(book.input.cover?.image.path).toBe("cover.png");
		expect(book.input.cover?.alt).toBe("A dot");
		expect(book.input.resources).toEqual([]);
	});
});

describe("fromMarkdown with a folder", () => {
	test("reads index.md then chapter files in numeric order, and reports other Markdown files", async () => {
		let folder = memory({
			"index.md": "# Book\n",
			"ch10.md": "## Ten\n",
			"ch2.md": "## Two\n",
			"ch1-start.md": "## One\n",
			"ch09.md": "## Nine\n",
			"README.md": "# Notes\n",
		});

		let book = await fromMarkdown({ source: { files: folder.files }, read: folder.read });

		if (isFailure(book)) throw book.error;
		expect(book.data.input.chapters.map((chapter) => chapter.title)).toEqual([
			"Book",
			"One",
			"Two",
			"Nine",
			"Ten",
		]);
		expect(folder.asked).toEqual(["index.md", "ch1-start.md", "ch2.md", "ch09.md", "ch10.md"]);
		expect(book.data.ignored).toEqual(["README.md"]);
	});

	test("links styles.css after the reading stylesheet, with its url()s pointing at the files", async () => {
		let folder = memory({
			"index.md": "# Book\n\n## One\n",
			"styles.css": '@font-face { font-family: X; src: url("fonts/x.ttf"); }',
			"fonts/x.ttf": FONT,
		});

		let book = await fromMarkdown({ source: { files: folder.files }, read: folder.read });

		if (isFailure(book)) throw book.error;
		expect(book.data.input.styles?.map((style) => style.path)).toEqual([
			"_book/book.css",
			"styles.css",
		]);
		expect(book.data.input.styles?.[1]?.text).toContain('url("fonts/x.ttf")');
		expect(book.data.input.resources?.map((resource) => resource.path)).toEqual(["fonts/x.ttf"]);
	});

	test("points a link to another chapter file at its first chapter", async () => {
		let folder = memory({
			"ch1.md": "## One\n\nNext is [two](ch2.md).\n",
			"ch2.md": "## Two\n\nBack to [one](ch1.md#one).\n",
		});

		let book = await fromMarkdown({
			source: { files: folder.files },
			read: folder.read,
			metadata: { title: "T" },
		});

		if (isFailure(book)) throw book.error;
		expect(page(book.data, "one")).toContain('<a href="two.xhtml">two</a>');
		expect(page(book.data, "two")).toContain('<a href="one.xhtml#one">one</a>');
	});

	test("numbers footnotes per file, so two files may both write [^1]", async () => {
		let folder = memory({
			"ch1.md": "## One\n\nA.[^1]\n\n[^1]: First.\n",
			"ch2.md": "## Two\n\nB.[^1]\n\n[^1]: Second.\n",
		});

		let book = await fromMarkdown({
			source: { files: folder.files },
			read: folder.read,
			metadata: { title: "T" },
		});

		if (isFailure(book)) throw book.error;
		expect(page(book.data, "one")).toContain("First.");
		expect(page(book.data, "two")).toContain("Second.");
		expect(page(book.data, "two")).not.toContain("First.");
	});
});

describe("fromMarkdown refuses", () => {
	test.each([
		["a # title in a chapter file", { "index.md": "# A\n", "ch1.md": "# B\n\n## One\n" }, "ch1.md"],
		["a second # title", { "index.md": "# A\n\n# B\n\n## One\n" }, "index.md"],
		[
			"text before a chapter file's first ##",
			{ "index.md": "# A\n", "ch1.md": "Hi.\n\n## One\n" },
			"ch1.md",
		],
		["a chapter file with no ##", { "index.md": "# A\n", "ch1.md": "" }, "ch1.md"],
		["two files with one chapter number", { "ch1.md": "## A\n", "ch01.md": "## B\n" }, "ch01.md"],
	])("%s", async (_, files, where) => {
		let folder = memory(files);

		let book = await fromMarkdown({ source: { files: folder.files }, read: folder.read });

		expect(isFailure(book) && book.error.path).toBe(where);
	});

	test("a book without a title", async () => {
		let book = await fromMarkdown({
			source: { file: "a.md", text: "## One\n" },
			read: memory({}).read,
		});

		expect(isFailure(book) && book.error.code).toBe("invalid-metadata");
	});

	test("a missing image, naming the file that references it", async () => {
		let book = await fromMarkdown({
			source: { file: "a.md", text: "# A\n\n## One\n\n![x](gone.png)\n" },
			read: memory({}).read,
		});

		expect(isFailure(book) && [book.error.code, book.error.message]).toEqual([
			"missing-resource",
			'"gone.png", referenced by "a.md", does not exist',
		]);
	});

	test("a web image without remote, before anything is downloaded", async () => {
		let folder = memory({});

		let book = await fromMarkdown({
			source: { file: "a.md", text: "# A\n\n## One\n\n![x](https://cdn.sdxc-test.com/x.png)\n" },
			read: folder.read,
		});

		expect(isFailure(book) && book.error.code).toBe("remote-resource");
		expect(folder.asked).toEqual([]);
	});

	test("a font that cannot be read", async () => {
		let book = await fromMarkdown({
			source: { file: "a.md", text: "# A\n\n## One\n" },
			read: memory({}).read,
			fonts: [{ path: "broken.ttf", bytes: new Uint8Array([1, 2, 3, 4]) }],
		});

		expect(isFailure(book) && [book.error.code, book.error.path]).toEqual([
			"invalid-font",
			"broken.ttf",
		]);
	});
});

describe("fromMarkdown with remote files", () => {
	test("stores each download once under remote/, and reports every read", async () => {
		let events: MarkdownBook.Progress[] = [];
		let read = async (file: string): Promise<MarkdownBook.File | null> =>
			file.startsWith("https://") ? { bytes: new Uint8Array(PIXEL), type: "image/png" } : null;

		let book = await fromMarkdown({
			source: {
				file: "a.md",
				text: "# A\n\n## One\n\n![x](https://cdn.sdxc-test.com/a)\n\n![y](https://cdn.sdxc-test.com/a)\n",
			},
			read,
			remote: true,
			onProgress: (event) => events.push(event),
		});

		if (isFailure(book)) throw book.error;
		let [download] = book.data.downloads;
		expect(download?.path).toMatch(/^remote\/[0-9a-f]{16}\.png$/u);
		expect(page(book.data, "one")).toContain(`<img src="../${download?.path}" alt="x"/>`);
		expect(events).toEqual([
			{ type: "sources", paths: [] },
			{ type: "assets", local: [], remote: ["https://cdn.sdxc-test.com/a"] },
			{ type: "read", path: "https://cdn.sdxc-test.com/a", remote: true, bytes: PIXEL.byteLength },
		]);
	});

	test("refuses a download whose media type EPUB cannot hold", async () => {
		let book = await fromMarkdown({
			source: { file: "a.md", text: "# A\n\n## One\n\n![x](https://cdn.sdxc-test.com/a)\n" },
			read: async () => ({ bytes: new Uint8Array([1]), type: "image/bmp" }),
			remote: true,
		});

		expect(isFailure(book) && book.error.code).toBe("unsupported-media");
	});
});

describe("fromMarkdown with fonts", () => {
	test("declares each font with @font-face, sets the first as the body face, and asks Apple Books to use it", async () => {
		let book = await single(
			"# A\n\n## One\n",
			{},
			{ fonts: [{ path: "/fonts/Roboto Serif.ttf", bytes: new Uint8Array(FONT) }] },
		);

		expect(book.fonts).toEqual([
			{
				family: "Roboto Serif Condensed",
				weight: 700,
				style: "normal",
				path: "_book/fonts/Roboto-Serif.ttf",
				source: "/fonts/Roboto Serif.ttf",
			},
		]);
		expect(book.input.styles?.[0]?.text).toContain(
			'font-family: "Roboto Serif Condensed";\n\tfont-weight: 700;',
		);
		expect(book.input.styles?.[1]?.text).toContain('font-family: "Roboto Serif Condensed", serif;');
		expect(container(book, "EPUB/package.opf")).toContain(
			'<meta property="ibooks:specified-fonts">true</meta>',
		);
	});
});
