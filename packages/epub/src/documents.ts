/**
 * Writes the documents of a publication the package owns — the OCF container, the package
 * document, the navigation document, the EPUB 2 NCX, the cover page and each chapter's
 * wrapper — as `@sdxc/xml` trees, indented where whitespace carries no meaning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { EPUB_NAMESPACE, XHTML_NAMESPACE } from "./content.js";
import { relativePath } from "./paths.js";

/** The prolog of every XML document the package writes. */
const DECLARATION = `<?xml version="1.0" encoding="UTF-8"?>\n`;

/** One manifest item, as the package document lists it. */
export interface ManifestItem {
	id: string;
	/** Relative to `EPUB/`, which is also where the package document sits. */
	href: string;
	mediaType: string;
	properties: string[];
}

/** One spine entry, in reading order. */
export interface SpineItem {
	idref: string;
	linear: boolean;
}

/** One table-of-contents entry with the entries nested under it. */
export interface TocEntry {
	title: string;
	/** Relative to `EPUB/`, with the fragment when there is one. */
	href: string;
	children: TocEntry[];
}

/** The text of `META-INF/container.xml`, pointing reading systems at the package document. */
export function containerDocument(): Result<string, Error> {
	let root = element(
		"container",
		{ version: "1.0", xmlns: "urn:oasis:names:tc:opendocument:xmlns:container" },
		[
			element("rootfiles", {}, [
				element("rootfile", {
					"full-path": "EPUB/package.opf",
					"media-type": "application/oebps-package+xml",
				}),
			]),
		],
	);
	return stringify(root);
}

/** What the package document is written from. */
export interface PackageInput {
	language: string;
	uniqueIdentifier: string;
	/** The Dublin Core and `<meta>` elements, in document order. */
	metadata: XML.Element[];
	manifest: ManifestItem[];
	spine: SpineItem[];
	ncxId?: string;
}

/** The text of `EPUB/package.opf`: metadata, the manifest and the spine. */
export function packageDocument(input: PackageInput): Result<string, Error> {
	let manifest = input.manifest.map((item) =>
		element("item", {
			id: item.id,
			href: item.href,
			"media-type": item.mediaType,
			...(item.properties.length > 0 ? { properties: item.properties.join(" ") } : {}),
		}),
	);
	let spine = input.spine.map((item) =>
		element("itemref", { idref: item.idref, ...(item.linear ? {} : { linear: "no" }) }),
	);
	let root = element(
		"package",
		{
			xmlns: "http://www.idpf.org/2007/opf",
			version: "3.0",
			"unique-identifier": input.uniqueIdentifier,
			"xml:lang": input.language,
		},
		[
			element("metadata", { "xmlns:dc": "http://purl.org/dc/elements/1.1/" }, input.metadata),
			element("manifest", {}, manifest),
			element("spine", input.ncxId ? { toc: input.ncxId } : {}, spine),
		],
	);
	return stringify(root);
}

/** One landmark of the navigation document. */
export interface Landmark {
	type: "cover" | "toc" | "bodymatter";
	title: string;
	href: string;
}

/** What the navigation document is written from. */
export interface NavigationInput {
	language: string;
	title: string;
	contentsLabel: string;
	landmarksLabel: string;
	toc: TocEntry[];
	landmarks: Landmark[];
}

/**
 * The text of `EPUB/nav.xhtml`: the table of contents a reading system shows, and hidden
 * landmarks that let it open the book at the cover or the first chapter.
 */
export function navigationDocument(input: NavigationInput): Result<string, Error> {
	let toc = element("nav", { "epub:type": "toc", id: "toc" }, [
		element("h1", {}, [input.contentsLabel]),
		tocList(input.toc),
	]);
	let landmarks = element("nav", { "epub:type": "landmarks", hidden: "hidden" }, [
		element("h2", {}, [input.landmarksLabel]),
		element(
			"ol",
			{},
			input.landmarks.map((landmark) =>
				element("li", {}, [
					element("a", { "epub:type": landmark.type, href: landmark.href }, [landmark.title]),
				]),
			),
		),
	]);
	return xhtmlDocument({
		language: input.language,
		title: input.title,
		stylesheets: [],
		body: [toc, landmarks],
		indentBody: true,
	});
}

/** An `<ol>` of entries, each an `<a>` with its own `<ol>` when it has children. */
function tocList(entries: TocEntry[]): XML.Element {
	return element(
		"ol",
		{},
		entries.map((entry) =>
			element("li", {}, [
				element("a", { href: entry.href }, [entry.title]),
				...(entry.children.length > 0 ? [tocList(entry.children)] : []),
			]),
		),
	);
}

/** What the NCX is written from. */
export interface NcxInput {
	identifier: string;
	language: string;
	title: string;
	toc: TocEntry[];
}

/**
 * The text of `EPUB/toc.ncx`, the EPUB 2 table of contents older reading systems and
 * Kindle's converter read. `dtb:uid` repeats the identifier, which epubcheck requires.
 */
export function ncxDocument(input: NcxInput): Result<string, Error> {
	let order = 0;
	let points = (entries: TocEntry[]): XML.Element[] =>
		entries.map((entry) => {
			order++;
			return element("navPoint", { id: `navpoint-${order}`, playOrder: String(order) }, [
				element("navLabel", {}, [element("text", {}, [entry.title])]),
				element("content", { src: entry.href }),
				...points(entry.children),
			]);
		});
	let root = element(
		"ncx",
		{
			xmlns: "http://www.daisy.org/z3986/2005/ncx/",
			version: "2005-1",
			"xml:lang": input.language,
		},
		[
			element("head", {}, [
				element("meta", { name: "dtb:uid", content: input.identifier }),
				element("meta", { name: "dtb:depth", content: String(depth(input.toc)) }),
				element("meta", { name: "dtb:totalPageCount", content: "0" }),
				element("meta", { name: "dtb:maxPageNumber", content: "0" }),
			]),
			element("docTitle", {}, [element("text", {}, [input.title])]),
			element("navMap", {}, points(input.toc)),
		],
	);
	return stringify(root);
}

/** How many levels a table of contents nests, at least one. */
function depth(entries: TocEntry[]): number {
	return Math.max(
		1,
		...entries.map((entry) => 1 + (entry.children.length > 0 ? depth(entry.children) : 0)),
	);
}

/** The text of `EPUB/cover.xhtml`, a page that shows the cover image and nothing else. */
export function coverDocument(input: {
	language: string;
	title: string;
	image: string;
	alt: string;
}): Result<string, Error> {
	let section = element("section", { "epub:type": "cover", class: "cover" }, [
		element("img", { src: relativePath("cover.xhtml", input.image), alt: input.alt }),
	]);
	return xhtmlDocument({
		language: input.language,
		title: input.title,
		stylesheets: [],
		body: [section],
		indentBody: true,
	});
}

/** What a chapter's content document is written from. */
export interface ChapterInput {
	path: string;
	language: string;
	title: string;
	stylesheets: string[];
	body: XML.Node[];
}

/**
 * The text of one chapter's content document, wrapping the parsed body. Serializing fails
 * for a namespace prefix the body uses without declaring.
 */
export function chapterDocument(input: ChapterInput): Result<string, Error> {
	return xhtmlDocument({
		language: input.language,
		title: input.title,
		stylesheets: input.stylesheets.map((style) => relativePath(input.path, style)),
		body: input.body,
	});
}

/** What any XHTML document the package writes is built from. */
interface XhtmlInput {
	language: string;
	title: string;
	stylesheets: string[];
	body: XML.Node[];
	/** Indents a body the package wrote itself; a chapter body is written exactly as parsed. */
	indentBody?: boolean;
}

/**
 * An XHTML content document: the `html` root declaring the XHTML and `epub` namespaces and
 * the language as both `lang` and `xml:lang`, a head with the title and stylesheets, and the
 * body nodes as given. The head and root are indented, and the body when `indentBody` says so.
 */
function xhtmlDocument(input: XhtmlInput): Result<string, Error> {
	let head = element("head", {}, [
		element("title", {}, [input.title]),
		...input.stylesheets.map((href) =>
			element("link", { rel: "stylesheet", type: "text/css", href }),
		),
	]);
	let body = element("body", {}, input.body);
	if (input.indentBody) body = indent(body, 1);
	let root = element(
		"html",
		{
			xmlns: XHTML_NAMESPACE,
			"xmlns:epub": EPUB_NAMESPACE,
			lang: input.language,
			"xml:lang": input.language,
		},
		["\n\t", indent(head, 1), "\n\t", body, "\n"],
	);
	let result = XML.stringify(root);
	if (result.status === "failure") return failure(result.error);
	return success(`${DECLARATION}<!DOCTYPE html>\n${result.data}\n`);
}

/** Shorthand for an element literal. */
export function element(
	name: string,
	attributes: Record<string, string> = {},
	children: XML.Node[] = [],
): XML.Element {
	return { name, attributes, children };
}

/** Serializes a tree the package built, indented throughout and with the XML declaration. */
function stringify(root: XML.Element): Result<string, Error> {
	let result = XML.stringify(indent(root, 0));
	if (result.status === "failure") return failure(result.error);
	return success(`${DECLARATION}${result.data}\n`);
}

/**
 * Puts each child of an element-only element on its own line, one tab deeper, so the
 * package's documents read well in a diff. An element holding text is left as it is, since
 * whitespace beside text is content.
 */
function indent(node: XML.Element, level: number): XML.Element {
	let children = node.children ?? [];
	if (children.length === 0 || children.some((child) => typeof child === "string")) return node;
	let inner = `\n${"\t".repeat(level + 1)}`;
	let indented: XML.Node[] = [];
	for (let child of children) {
		indented.push(inner, typeof child === "string" ? child : indent(child, level + 1));
	}
	indented.push(`\n${"\t".repeat(level)}`);
	return { ...node, children: indented };
}
