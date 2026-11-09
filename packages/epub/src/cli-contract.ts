/**
 * The `sdxc-epub` command line as a contract: `build` writes an EPUB from a Markdown file or a
 * book folder, and `check` runs the same build without writing it. Help, usage errors and each
 * handler's typed `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The book argument both commands take: a Markdown file, a book folder, or stdin. */
function book() {
	return argument(s.string(), {
		default: "-",
		description:
			"A Markdown file, a folder holding index.md and ch<N>.md files, or - (or absent) for stdin",
	});
}

/** The flags that decide what goes into the book, shared by `build` and `check`. */
function bookFlags() {
	return {
		title: flag.string("title", {
			valueName: "text",
			description: 'The title, in place of the frontmatter and the "#" heading',
			heading: "Metadata",
		}),
		author: flag
			.string("author", {
				valueName: "name",
				description: "An author, in place of the frontmatter's; repeat for several",
				heading: "Metadata",
			})
			.multiple(),
		language: flag.string("language", {
			valueName: "tag",
			description: "A BCP 47 language tag such as en or es-419 (default: frontmatter, then en)",
			heading: "Metadata",
		}),
		identifier: flag.string("identifier", {
			valueName: "urn",
			description:
				"The identifier reading systems know the book by (default: derived from title and authors)",
			heading: "Metadata",
		}),
		publisher: flag.string("publisher", { valueName: "text", heading: "Metadata" }),
		description: flag.string("description", { valueName: "text", heading: "Metadata" }),
		cover: flag.string("cover", {
			valueName: "path",
			description: "The cover image, in place of the frontmatter's cover",
			heading: "Content",
		}),
		coverAlt: flag.string("cover-alt", {
			valueName: "text",
			description: 'The cover\'s text alternative (default: "Cover of <title>")',
			heading: "Content",
		}),
		font: flag
			.string("font", {
				valueName: "path",
				description:
					"Embed a .ttf, .otf, .woff or .woff2 font; the first one's family sets the body text. Repeat for weights and styles",
				heading: "Content",
			})
			.multiple(),
		style: flag
			.string("style", {
				valueName: "path",
				description:
					"Link a stylesheet after the reading one and the folder's styles.css; repeatable",
				heading: "Content",
			})
			.multiple(),
		defaultStyle: flag.boolean("default-style", {
			default: true,
			description: "Link the reading stylesheet with the centered title page",
			heading: "Content",
		}),
		tocDepth: flag.number("toc-depth", {
			valueName: "n",
			default: 3,
			schema: s
				.number()
				.refine(
					(n) => Number.isInteger(n) && n >= 1 && n <= 5,
					"expects a whole number from 1 to 5",
				),
			description: "Heading levels the contents list, chapters included",
			heading: "Content",
		}),
		ncx: flag.boolean("ncx", {
			default: true,
			description: "Write toc.ncx for EPUB 2 reading systems and Kindle's converter",
			heading: "Content",
		}),
		allowRemote: flag.boolean("allow-remote", {
			description:
				"Download images, fonts and covers referenced by http(s) URLs into the book. You trust every URL the book names",
			heading: "Content",
		}),
		json: flag.boolean("json", {
			description: "Print the report as JSON on stdout; progress stays on stderr",
			heading: "Output",
		}),
	};
}

/** Every command `sdxc-epub` takes. */
export const EPUB_COMMANDS = commands({
	description: "sdxc-epub — EPUB 3.3 books from Markdown, checked against what epubcheck rejects",
	build: command({
		description:
			'Write an EPUB from Markdown: "#" is the title page, each "##" a chapter. A folder reads index.md, ch1.md, ch2.md… in numeric order and styles.css',
		arguments: { book: book() },
		flags: {
			output: flag.string("output", {
				short: "o",
				valueName: "file",
				description: "Where to write the EPUB (default: beside the input, named after it)",
				heading: "Output",
			}),
			...bookFlags(),
		},
		examples: [
			"build post.md",
			"build book/ --font Literata-Regular.woff2 --font Literata-Italic.woff2",
			"build book/ --allow-remote -o dist/book.epub",
			"cat post.md | build - -o post.epub",
		],
	}),
	check: command({
		description:
			"Build the EPUB without writing it. Exits 1 naming the first problem: a missing image, malformed markup, a broken link",
		arguments: { book: book() },
		flags: bookFlags(),
		examples: ["check book/", "check post.md --json"],
	}),
});
