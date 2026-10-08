/**
 * Builds the golden publications and compares every file, and the `.epub` itself, byte for
 * byte with the fixtures under `src/fixtures`, which `bun run epubcheck` validates. Run with
 * `UPDATE_EPUB_FIXTURES=1` to rewrite them after a deliberate change, then run epubcheck.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";
import { unzipSync } from "fflate";
import { describe, expect, test } from "vitest";

import { EPUB } from "./epub.js";

/** Where the expanded fixtures and their `.epub` files live. */
const FIXTURES = path.join(import.meta.dirname, "fixtures");

/** Set to rewrite the fixtures from the current output instead of comparing against them. */
const UPDATE = process.env.UPDATE_EPUB_FIXTURES === "1";

/** A 1×1 PNG, real enough for epubcheck to match its bytes against `image/png`. */
const PNG = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	),
	(character) => character.charCodeAt(0),
);

/** A small SVG diagram, the kind a tutorial includes as an image. */
const FLOW_SVG = new TextEncoder().encode(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" role="img"><title>Flow</title><rect x="1" y="1" width="118" height="38" fill="none" stroke="black"/><text x="60" y="25" text-anchor="middle">client → server</text></svg>\n`,
);

/** The fixed moment every fixture is built at, so the output is byte-stable. */
const MODIFIED = new Date("2026-10-08T00:00:00Z");

/** A stylesheet shared by the fixtures that carry one. */
const BOOK_CSS = `body { font-family: serif; line-height: 1.5; }\npre { white-space: pre-wrap; }\n.cover img { max-width: 100%; }\n`;

/** The long-form chapter, written in Markdown and rendered as XHTML. */
function longFormBody(): string {
	let parsed = Markdown.parse(readFileSync(path.join(FIXTURES, "long-form.md"), "utf8"));
	if (isFailure(parsed)) throw parsed.error;
	return toHTML(parsed.data.document, { syntax: "xhtml" });
}

/** Each golden publication, by fixture name. */
const BOOKS: Record<string, () => EPUB.Input> = {
	minimal: () => ({
		metadata: {
			identifier: "urn:uuid:7c1e0b3a-9a2f-4d55-9a0e-2c2b9d3f1a01",
			title: "A Minimal Book",
			language: "en",
			modified: MODIFIED,
		},
		chapters: [
			{ id: "chapter-1", title: "Chapter One", body: "<h1>Chapter One</h1><p>Hello.</p>" },
		],
	}),

	cover: () => ({
		metadata: {
			identifier: "urn:uuid:7c1e0b3a-9a2f-4d55-9a0e-2c2b9d3f1a02",
			title: "A Book With a Cover",
			language: "en",
			modified: MODIFIED,
			published: new Date("2026-09-01T00:00:00Z"),
			creators: [{ name: "Jane Doe", role: "aut", fileAs: "Doe, Jane" }],
			publisher: "Example Press",
			description: "A short book that shows its cover first.",
			rights: "© 2026 Jane Doe",
			subjects: ["Fiction"],
			accessibility: {
				summary: "This publication contains a table of contents and no hazards.",
				modes: ["textual", "visual"],
				modesSufficient: ["textual"],
				features: ["structuralNavigation", "tableOfContents", "alternativeText"],
				hazards: ["none"],
			},
		},
		cover: {
			image: { path: "images/cover.png", bytes: PNG },
			alt: "The cover of A Book With a Cover",
		},
		styles: [{ path: "styles/book.css", text: BOOK_CSS }],
		chapters: [
			{
				id: "copyright",
				title: "Copyright",
				body: '<section epub:type="copyright-page"><p>© 2026 Jane Doe. All rights reserved.</p></section>',
				toc: false,
			},
			{ id: "one", title: "One", body: "<h1>One</h1><p>It began on a&nbsp;Tuesday.</p>" },
			{
				id: "two",
				title: "Two",
				body: '<h1>Two</h1><p>It ended, <a href="one.xhtml">as it began</a>.</p>',
			},
		],
	}),

	sections: () => ({
		metadata: {
			identifier: "urn:uuid:7c1e0b3a-9a2f-4d55-9a0e-2c2b9d3f1a03",
			title: "Un libro con secciones",
			language: "es",
			modified: MODIFIED,
		},
		labels: {
			contents: "Índice",
			landmarks: "Puntos de referencia",
			cover: "Portada",
			start: "Comienzo",
		},
		chapters: [
			{
				id: "uno",
				title: "Primera parte",
				body: '<h1>Primera parte</h1><h2 id="a">Sección A</h2><p>Texto.</p><h3 id="a1">Detalle</h3><p>Más.</p><h2 id="b">Sección B</h2><p>Fin; ver <a href="#a1">el detalle</a> o <a href="notas.xhtml#n1">la nota</a>.</p>',
				sections: [
					{ title: "Sección A", fragment: "a", sections: [{ title: "Detalle", fragment: "a1" }] },
					{ title: "Sección B", fragment: "b" },
				],
			},
			{
				id: "quote",
				title: "A Quotation",
				language: "en",
				body: "<blockquote><p>To be, or not to be.</p></blockquote>",
			},
			{
				id: "notas",
				title: "Notas",
				body: '<aside epub:type="footnote" id="n1"><p>Una nota.</p></aside>',
				linear: false,
				toc: false,
			},
		],
	}),

	media: () => ({
		metadata: {
			identifier: "urn:uuid:7c1e0b3a-9a2f-4d55-9a0e-2c2b9d3f1a04",
			title: "Pictures and Formulas",
			language: "en",
			modified: MODIFIED,
		},
		styles: [
			{ path: "styles/media.css", text: "figure { background: url(../images/pixel.png); }\n" },
		],
		resources: [
			{ path: "images/pixel.png", bytes: PNG },
			{ path: "images/flow.svg", bytes: FLOW_SVG },
		],
		chapters: [
			{
				id: "svg",
				title: "Inline SVG",
				body: '<h1>Inline SVG</h1><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="100" height="100"><title>A square</title><rect width="10" height="10"/></svg>',
			},
			{
				id: "math",
				title: "MathML",
				body: '<h1>MathML</h1><p><math xmlns="http://www.w3.org/1998/Math/MathML" alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math></p>',
			},
			{
				id: "images",
				title: "Images",
				body: '<h1>Images</h1><figure><img src="../images/flow.svg" alt="The flow"/><figcaption>The flow</figcaption></figure><p><img src="../images/pixel.png" alt="A pixel"/></p><p><a href="https://example.com/">A link to the web</a></p>',
			},
		],
	}),

	"long-form": () => ({
		metadata: {
			identifier: "urn:uuid:7c1e0b3a-9a2f-4d55-9a0e-2c2b9d3f1a05",
			title: "Tokens in Simple Terms",
			language: "en",
			modified: MODIFIED,
			creators: [{ name: "Jane Doe", role: "aut" }],
			accessibility: {
				summary: "A text-only chapter with a table of contents and structured headings.",
				modes: ["textual"],
				modesSufficient: ["textual"],
				features: ["structuralNavigation", "tableOfContents"],
				hazards: ["none"],
			},
		},
		styles: [{ path: "styles/book.css", text: BOOK_CSS }],
		resources: [{ path: "images/flow.svg", bytes: FLOW_SVG }],
		chapters: [
			{
				id: "tokens",
				title: "Tokens in Simple Terms",
				body: longFormBody(),
				sections: [
					{ title: "The Parties", fragment: "the-parties" },
					{
						title: "A Request, Step by Step",
						fragment: "steps",
						sections: [{ title: "Refresh Tokens", fragment: "refresh-tokens" }],
					},
				],
			},
		],
	}),
};

describe("golden publications", () => {
	for (let [name, input] of Object.entries(BOOKS)) {
		test(`${name} matches its fixture byte for byte`, async () => {
			let built = EPUB.build(input());
			if (isFailure(built)) throw built.error;
			let bytes = await built.data.bytes();
			if (isFailure(bytes)) throw bytes.error;

			let directory = path.join(FIXTURES, name);
			let archive = path.join(FIXTURES, `${name}.epub`);
			if (UPDATE) {
				rmSync(directory, { recursive: true, force: true });
				for (let file of built.data.files) {
					let target = path.join(directory, file.path);
					mkdirSync(path.dirname(target), { recursive: true });
					writeFileSync(target, file.bytes);
				}
				writeFileSync(archive, bytes.data);
			}

			for (let file of built.data.files) {
				let fixture = path.join(directory, file.path);
				expect(existsSync(fixture), `${name}/${file.path} exists`).toBe(true);
				expect(new TextDecoder().decode(file.bytes), file.path).toBe(readFileSync(fixture, "utf8"));
				expect(new Uint8Array(readFileSync(fixture))).toEqual(file.bytes);
			}
			expect(new Uint8Array(readFileSync(archive))).toEqual(bytes.data);

			let entries = Object.keys(unzipSync(bytes.data));
			expect(entries).toEqual(built.data.files.map((file) => file.path));
		});
	}
});
