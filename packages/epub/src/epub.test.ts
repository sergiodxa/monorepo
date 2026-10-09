/**
 * Covers each verification rule of `EPUB.build` — asserting the error `code`, subclass and
 * `path` — and the parts of the written publication that depend on the input: derived
 * manifest properties, entity resolution, whitespace, the NCX switch and the container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess } from "@sdxc/result";
import { unzipSync } from "fflate";
import { describe, expect, test } from "vitest";

import { EPUB } from "./epub.js";
import {
	EpubContentError,
	EpubError,
	EpubMediaTypeError,
	EpubMetadataError,
	EpubMissingResourceError,
	EpubPathError,
	EpubRemoteResourceError,
} from "./errors.js";

/** A 1-byte stand-in for an image; the build reads only the path. */
const BYTES = new Uint8Array([0]);

/** A valid input with one chapter, which each test bends one field of. */
function input(overrides: Partial<EPUB.Input> = {}): EPUB.Input {
	return {
		metadata: {
			identifier: "urn:uuid:00000000-0000-4000-8000-000000000000",
			title: "Book",
			language: "en",
			modified: new Date("2026-10-08T00:00:00Z"),
		},
		chapters: [{ id: "one", title: "One", body: "<p>One</p>" }],
		...overrides,
	};
}

/** A one-chapter input whose body is the given XHTML. */
function withBody(body: string, overrides: Partial<EPUB.Input> = {}): EPUB.Input {
	return input({ chapters: [{ id: "one", title: "One", body }], ...overrides });
}

/** The error a build fails with, failing the test when it succeeds. */
function errorOf(built: ReturnType<typeof EPUB.build>): EpubError {
	if (isSuccess(built)) throw new Error("Expected the build to fail");
	return built.error;
}

/** The text of one file of a successful build. */
function fileText(built: ReturnType<typeof EPUB.build>, path: string): string {
	if (isFailure(built)) throw built.error;
	let file = built.data.files.find((candidate) => candidate.path === path);
	if (!file) throw new Error(`No file at ${path}`);
	return new TextDecoder().decode(file.bytes);
}

describe("invalid-metadata", () => {
	test.each<[string, Partial<EPUB.Metadata>, string]>([
		["an empty identifier", { identifier: " " }, "identifier"],
		["an empty title", { title: "" }, "title"],
		["a malformed language", { language: "english!" }, "language"],
		["an invalid modified date", { modified: new Date("nope") }, "modified"],
		["an invalid published date", { published: new Date("nope") }, "published"],
		[
			"a role that is no MARC relator",
			{ creators: [{ name: "A", role: "author" }] },
			"creators[0]",
		],
		["an empty creator", { creators: [{ name: "" }] }, "creators[0]"],
		["a control character", { description: "bad\u0001" }, "description"],
	])("refuses %s", (_, metadata, path) => {
		let error = errorOf(EPUB.build(input({ metadata: { ...input().metadata, ...metadata } })));
		expect(error).toBeInstanceOf(EpubMetadataError);
		expect(error).toMatchObject({ code: "invalid-metadata", path });
	});

	test("refuses a chapter language that is not a BCP 47 tag", () => {
		let error = errorOf(
			EPUB.build(input({ chapters: [{ id: "one", title: "One", body: "", language: "e" }] })),
		);
		expect(error).toMatchObject({ code: "invalid-metadata", path: "one" });
	});

	test("refuses an empty chapter or section title", () => {
		expect(
			errorOf(EPUB.build(input({ chapters: [{ id: "one", title: " ", body: "" }] }))),
		).toMatchObject({ code: "invalid-metadata", path: "one" });
		let section = EPUB.build(
			input({
				chapters: [
					{
						id: "one",
						title: "One",
						body: '<h2 id="a">A</h2>',
						sections: [{ title: "", fragment: "a" }],
					},
				],
			}),
		);
		expect(errorOf(section)).toMatchObject({ code: "invalid-metadata", path: "one" });
	});
});

describe("invalid-content", () => {
	test("refuses a body that is not well-formed, carrying the parser's error as cause", () => {
		let error = errorOf(EPUB.build(withBody("<p>Line<br>break</p>")));
		expect(error).toBeInstanceOf(EpubContentError);
		expect(error).toMatchObject({ code: "invalid-content", path: "one" });
		expect(error.cause).toBeInstanceOf(Error);
	});

	test.each([
		["<script>", "<p>Hi</p><script>alert(1)</script>"],
		["an SVG <script>", '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'],
		["an event handler", '<p onclick="go()">Hi</p>'],
		["a <form>", "<form><p>Hi</p></form>"],
		["a duplicate id", '<h2 id="a">A</h2><h2 id="a">B</h2>'],
		["a character XML forbids", "<p>bell\u0007</p>"],
		["a lone surrogate", "<p>\uD800</p>"],
		["a forbidden character in an attribute", '<p title="\u0001">Hi</p>'],
		["an undeclared prefix", '<p xlink:href="a.xhtml">Hi</p>'],
	])("refuses %s", (_, body) => {
		expect(errorOf(EPUB.build(withBody(body)))).toMatchObject({
			code: "invalid-content",
			path: "one",
		});
	});

	test("refuses a publication with no chapters", () => {
		expect(errorOf(EPUB.build(input({ chapters: [] })))).toMatchObject({ code: "invalid-content" });
	});

	test("refuses a publication with no linear chapter or no table-of-contents entry", () => {
		let chapter = { id: "one", title: "One", body: "<p>One</p>" };
		expect(errorOf(EPUB.build(input({ chapters: [{ ...chapter, linear: false }] })))).toMatchObject(
			{ code: "invalid-content" },
		);
		expect(errorOf(EPUB.build(input({ chapters: [{ ...chapter, toc: false }] })))).toMatchObject({
			code: "invalid-content",
		});
	});

	test("refuses a chapter a reader could never reach, and accepts it once something links to it", () => {
		let notes = {
			id: "notes",
			title: "Notes",
			body: '<p id="n1">A note</p>',
			linear: false,
			toc: false,
		};
		let unlinked = EPUB.build(
			input({ chapters: [{ id: "one", title: "One", body: "<p>One</p>" }, notes] }),
		);
		expect(errorOf(unlinked)).toMatchObject({ code: "invalid-content", path: "notes" });

		let linked = EPUB.build(
			input({
				chapters: [
					{ id: "one", title: "One", body: '<p><a href="notes.xhtml#n1">1</a></p>' },
					notes,
				],
			}),
		);
		expect(isSuccess(linked)).toBe(true);
	});
});

describe("missing-resource", () => {
	test.each([
		["an image the publication lacks", '<img src="../images/missing.png" alt=""/>'],
		["a link to a chapter the publication lacks", '<a href="two.xhtml">Two</a>'],
		["a fragment no element has", '<a href="#nowhere">Up</a>'],
		["a fragment missing from another chapter", '<a href="one.xhtml#nowhere">Up</a>'],
		["a link to a resource outside the spine", '<a href="../images/a.png">See</a>'],
		["an absolute path", '<img src="/images/a.png" alt=""/>'],
		["a path climbing out of the publication", '<img src="../../../a.png" alt=""/>'],
	])("refuses %s", (_, body) => {
		let built = EPUB.build(withBody(body, { resources: [{ path: "images/a.png", bytes: BYTES }] }));
		let error = errorOf(built);
		expect(error).toBeInstanceOf(EpubMissingResourceError);
		expect(error).toMatchObject({ code: "missing-resource", path: "one" });
	});

	test("refuses a section whose fragment the chapter does not hold", () => {
		let built = EPUB.build(
			input({
				chapters: [
					{
						id: "one",
						title: "One",
						body: "<p>One</p>",
						sections: [{ title: "A", fragment: "a" }],
					},
				],
			}),
		);
		expect(errorOf(built)).toMatchObject({ code: "missing-resource", path: "one" });
	});

	test("refuses a stylesheet url() the publication lacks", () => {
		let built = EPUB.build(
			input({
				styles: [{ path: "styles/a.css", text: "body { background: url('../images/x.png'); }" }],
			}),
		);
		expect(errorOf(built)).toMatchObject({ code: "missing-resource", path: "styles/a.css" });
	});

	test("ignores a url() inside a stylesheet comment and reads one after an unclosed comment", () => {
		let commented = EPUB.build(
			input({
				styles: [
					{ path: "styles/a.css", text: "/* url('../images/x.png') */ body { color: red; }" },
				],
			}),
		);
		let unclosed = EPUB.build(
			input({
				styles: [{ path: "styles/a.css", text: "body {} /* url('../images/x.png')" }],
			}),
		);

		expect(isSuccess(commented)).toBe(true);
		expect(errorOf(unclosed)).toMatchObject({ code: "missing-resource", path: "styles/a.css" });
	});

	test("reads a stylesheet of thousands of unclosed comments in linear time", () => {
		let text = `/*${"a/*".repeat(50_000)}`;

		let started = performance.now();
		let built = EPUB.build(input({ styles: [{ path: "styles/a.css", text }] }));

		expect(performance.now() - started).toBeLessThan(2_000);
		expect(isSuccess(built)).toBe(true);
	});

	test("resolves references from text/ and decodes percent-escapes", () => {
		let built = EPUB.build(
			withBody(
				'<img src="./../images/a%2Db.png" alt=""/><a href="one.xhtml?x=1#top" id="top">Top</a>',
				{
					resources: [{ path: "images/a-b.png", bytes: BYTES }],
				},
			),
		);
		expect(isSuccess(built)).toBe(true);
	});
});

describe("remote-resource", () => {
	test.each([
		["a remote image", '<img src="https://example.com/a.png" alt=""/>'],
		["a protocol-relative image", '<img src="//example.com/a.png" alt=""/>'],
		[
			"a remote srcset candidate",
			'<img src="data:image/png;base64,AA==" srcset="https://example.com/a.png 2x" alt=""/>',
		],
		["a remote stylesheet link", '<link rel="stylesheet" href="https://example.com/a.css"/>'],
		["a link to a data: URL", '<a href="data:text/html,hi">Hi</a>'],
	])("refuses %s", (_, body) => {
		let error = errorOf(EPUB.build(withBody(body)));
		expect(error).toBeInstanceOf(EpubRemoteResourceError);
		expect(error).toMatchObject({ code: "remote-resource", path: "one" });
	});

	test("refuses a stylesheet that loads a font from the web", () => {
		let built = EPUB.build(
			input({
				styles: [{ path: "styles/a.css", text: '@import "https://fonts.example.com/a.css";' }],
			}),
		);
		expect(errorOf(built)).toMatchObject({ code: "remote-resource", path: "styles/a.css" });
	});

	test("accepts links to the web, mail links and data: images", () => {
		let built = EPUB.build(
			withBody(
				'<p><a href="https://example.com/">Web</a> <a href="mailto:a@example.com">Mail</a> <img src="data:image/png;base64,AA==" alt=""/></p>',
			),
		);
		expect(isSuccess(built)).toBe(true);
	});
});

describe("unsupported-media", () => {
	test.each<[string, Partial<EPUB.Input>, string]>([
		[
			"a resource with no core media type",
			{ resources: [{ path: "data/a.txt", bytes: BYTES }] },
			"data/a.txt",
		],
		[
			"an XHTML resource, which belongs in chapters",
			{ resources: [{ path: "a.xhtml", bytes: BYTES }] },
			"a.xhtml",
		],
		["a script", { resources: [{ path: "a.js", bytes: BYTES }] }, "a.js"],
		["a stylesheet that is not .css", { styles: [{ path: "a.png", text: "" }] }, "a.png"],
		[
			"a cover that is not an image",
			{ cover: { image: { path: "a.css", bytes: BYTES }, alt: "" } },
			"a.css",
		],
	])("refuses %s", (_, overrides, path) => {
		let error = errorOf(EPUB.build(input(overrides)));
		expect(error).toBeInstanceOf(EpubMediaTypeError);
		expect(error).toMatchObject({ code: "unsupported-media", path });
	});
});

describe("invalid-path", () => {
	test.each([["1one"], ["one two"], ["a/b"], [""]])("refuses the chapter id %j", (id) => {
		let error = errorOf(EPUB.build(input({ chapters: [{ id, title: "One", body: "" }] })));
		expect(error).toBeInstanceOf(EpubPathError);
		expect(error).toMatchObject({ code: "invalid-path", path: id });
	});

	test("refuses chapter ids that differ only in case", () => {
		let built = EPUB.build(
			input({
				chapters: [
					{ id: "one", title: "One", body: "" },
					{ id: "ONE", title: "One", body: "" },
				],
			}),
		);
		expect(errorOf(built)).toMatchObject({ code: "invalid-path", path: "ONE" });
	});

	test.each([
		["images/my cover.png"],
		["/images/a.png"],
		["images/../a.png"],
		["images//a.png"],
		["images\\a.png"],
		["imágenes/a.png"],
	])("refuses the resource path %j", (path) => {
		let error = errorOf(EPUB.build(input({ resources: [{ path, bytes: BYTES }] })));
		expect(error).toMatchObject({ code: "invalid-path", path });
	});

	test("refuses two resources whose paths differ only in case", () => {
		let built = EPUB.build(
			input({
				resources: [
					{ path: "images/a.png", bytes: BYTES },
					{ path: "images/A.png", bytes: BYTES },
				],
			}),
		);
		expect(errorOf(built)).toMatchObject({ code: "invalid-path", path: "images/A.png" });
	});
});

describe("the written publication", () => {
	test("resolves named entities to characters and preserves whitespace", () => {
		let text = fileText(
			EPUB.build(
				withBody("<p>a&nbsp;b &mdash; <em>c</em> <strong>d</strong></p><pre>x\n  y</pre>"),
			),
			"EPUB/text/one.xhtml",
		);
		let nbsp = String.fromCodePoint(0xa0);
		let dash = String.fromCodePoint(0x2014);
		expect(text).toContain(
			`<p>a${nbsp}b ${dash} <em>c</em> <strong>d</strong></p><pre>x\n  y</pre>`,
		);
		expect(text).not.toContain("&nbsp;");
	});

	test("derives svg and mathml properties from the content", () => {
		let opf = fileText(
			EPUB.build(
				input({
					chapters: [
						{ id: "plain", title: "Plain", body: "<p>Text</p>" },
						{
							id: "svg",
							title: "SVG",
							body: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
						},
						{
							id: "both",
							title: "Both",
							body: '<svg xmlns="http://www.w3.org/2000/svg"/><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math>',
						},
					],
				}),
			),
			"EPUB/package.opf",
		);
		expect(opf).toContain(
			'<item id="plain" href="text/plain.xhtml" media-type="application/xhtml+xml"/>',
		);
		expect(opf).toContain(
			'<item id="svg" href="text/svg.xhtml" media-type="application/xhtml+xml" properties="svg"/>',
		);
		expect(opf).toContain('properties="mathml svg"');
		expect(opf).not.toMatch(/scripted|remote-resources/);
	});

	test('names the cover by property and by <meta name="cover">, and opens on it', () => {
		let opf = fileText(
			EPUB.build(
				input({ cover: { image: { path: "images/cover.jpg", bytes: BYTES }, alt: "Cover" } }),
			),
			"EPUB/package.opf",
		);
		expect(opf).toContain(
			'<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
		);
		expect(opf).toContain('<meta name="cover" content="cover-image"/>');
		expect(opf).toMatch(/<spine toc="ncx">\s*<itemref idref="cover"\/>/);
	});

	test("keeps generated ids clear of chapter ids", () => {
		let opf = fileText(
			EPUB.build(
				input({
					chapters: [
						{ id: "nav", title: "Nav", body: "" },
						{ id: "pub-id", title: "Id", body: "" },
					],
				}),
			),
			"EPUB/package.opf",
		);
		expect(opf).toContain('unique-identifier="pub-id-2"');
		expect(opf).toContain('<item id="nav-2" href="nav.xhtml"');
	});

	test("writes the NCX by default and leaves it out with legacyNcx: false", () => {
		let withNcx = EPUB.build(input());
		let without = EPUB.build(input({ legacyNcx: false }));
		if (isFailure(withNcx) || isFailure(without)) throw new Error("Expected both to build");
		expect(withNcx.data.files.map((file) => file.path)).toContain("EPUB/toc.ncx");
		expect(without.data.files.map((file) => file.path)).not.toContain("EPUB/toc.ncx");
		expect(fileText(without, "EPUB/package.opf")).toContain("<spine>");
	});

	test("writes a chapter's own language and links every stylesheet relative to text/", () => {
		let text = fileText(
			EPUB.build(
				input({
					styles: [
						{ path: "styles/a.css", text: "" },
						{ path: "b.css", text: "" },
					],
					chapters: [{ id: "one", title: "Uno", body: "<p>Hola</p>", language: "es" }],
				}),
			),
			"EPUB/text/one.xhtml",
		);
		expect(text).toContain('lang="es" xml:lang="es"');
		expect(text).toContain('<link rel="stylesheet" type="text/css" href="../styles/a.css"/>');
		expect(text).toContain('<link rel="stylesheet" type="text/css" href="../b.css"/>');
	});

	test("writes accessibility metadata only when given", () => {
		let none = fileText(EPUB.build(input()), "EPUB/package.opf");
		expect(none).not.toContain("schema:");
		let some = fileText(
			EPUB.build(
				input({
					metadata: {
						...input().metadata,
						accessibility: {
							modes: ["textual"],
							hazards: ["none"],
							conformsTo: "EPUB Accessibility 1.1 - WCAG 2.1 Level AA",
						},
					},
				}),
			),
			"EPUB/package.opf",
		);
		expect(some).toContain('<meta property="schema:accessMode">textual</meta>');
		expect(some).toContain('<meta property="schema:accessibilityHazard">none</meta>');
		expect(some).toContain(
			'<meta property="dcterms:conformsTo">EPUB Accessibility 1.1 - WCAG 2.1 Level AA</meta>',
		);
	});

	test("writes dcterms:modified to the second in UTC", () => {
		let opf = fileText(
			EPUB.build(
				input({
					metadata: { ...input().metadata, modified: new Date("2026-10-08T12:34:56.789Z") },
				}),
			),
			"EPUB/package.opf",
		);
		expect(opf).toContain('<meta property="dcterms:modified">2026-10-08T12:34:56Z</meta>');
	});

	test("streams a container with mimetype first and stored", async () => {
		let built = EPUB.build(input());
		if (isFailure(built)) throw built.error;
		let chunks: Uint8Array[] = [];
		for await (let chunk of built.data.stream()) chunks.push(chunk);
		let bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
		let offset = 0;
		for (let chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.length;
		}

		let view = new DataView(bytes.buffer);
		expect(view.getUint16(8, true)).toBe(0);
		expect(view.getUint16(28, true)).toBe(0);
		expect(new TextDecoder().decode(bytes.subarray(30, 58))).toBe("mimetypeapplication/epub+zip");
		expect(Object.keys(unzipSync(bytes))[0]).toBe("mimetype");
	});
});
