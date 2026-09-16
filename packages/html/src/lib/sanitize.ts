/**
 * Rewrites a page into the markup that is safe to render inside another origin:
 * an allow-list of elements and attributes, emitted from the parsed tree rather
 * than edited in place, so anything the list does not name is gone by construction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { HTML, HTMLParseError } from "../index.js";

import type { DOMElement, DOMNode } from "./dom.js";

import { parseDocument } from "./parse-document.js";

/** Node type of an element, as `Node.ELEMENT_NODE` spells it. */
const ELEMENT_NODE = 1;

/** Node type of a text node, as `Node.TEXT_NODE` spells it. */
const TEXT_NODE = 3;

/** The elements an article is written with, which are the ones that survive. */
const KEPT_ELEMENTS = new Set([
	"a",
	"abbr",
	"b",
	"blockquote",
	"br",
	"code",
	"dd",
	"del",
	"dl",
	"dt",
	"em",
	"figcaption",
	"figure",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"ins",
	"li",
	"ol",
	"p",
	"pre",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"time",
	"tr",
	"ul",
]);

/**
 * Elements whose content is code, chrome or another document, which leave with
 * their whole subtree: a script's body is a program and reading it as text would
 * put that program's source into the article.
 */
const DROPPED_SUBTREES = new Set([
	"base",
	"button",
	"embed",
	"form",
	"iframe",
	"input",
	"link",
	"math",
	"meta",
	"noscript",
	"object",
	"script",
	"select",
	"style",
	"svg",
	"template",
	"textarea",
]);

/** Elements that carry no children and therefore emit no closing tag. */
const VOID_ELEMENTS = new Set(["br", "hr", "img"]);

/** Attributes any surviving element may carry, since both describe its own text. */
const GLOBAL_ATTRIBUTES = new Set(["dir", "lang"]);

/** What each element may carry beyond the global attributes. */
const ELEMENT_ATTRIBUTES = new Map([
	["a", new Set(["href"])],
	["img", new Set(["alt", "height", "src", "width"])],
	["td", new Set(["colspan", "rowspan"])],
	["th", new Set(["colspan", "rowspan"])],
	["time", new Set(["datetime"])],
]);

/** Attributes whose value is a URL, and therefore a scheme worth checking. */
const URL_ATTRIBUTES = new Set(["href", "src"]);

/** The schemes a browser may be asked to resolve from inside an article. */
const FETCHABLE_SCHEMES = new Set(["http:", "https:"]);

/**
 * Rewrites markup into the subset that is safe to render beside a reader's own
 * session: every element and attribute is named by an allow-list, so an `on*`
 * handler, a `javascript:` URL and an inline style are absent rather than removed.
 *
 * @param source - The markup as the server sent it, a full page or a fragment
 * @param policy - The article's final URL, which relative URLs resolve against
 * @returns The sanitized markup, or the failure a source carrying none produces
 */
export function sanitize(
	source: string,
	policy: HTML.SanitizePolicy = {},
): Result<string, HTMLParseError> {
	let document = parseDocument(source);
	if (isFailure(document)) return document;
	return success(emitChildren(document.data.body, policy));
}

/** Emits every child of a node in document order, which is the article's own order. */
function emitChildren(node: DOMNode, policy: HTML.SanitizePolicy): string {
	let markup = "";
	for (let child of Array.from(node.childNodes)) markup += emitNode(child, policy);
	return markup;
}

/**
 * Emits one node: text as escaped text, a kept element as itself, a dropped element
 * as nothing, and anything else as its children, so a `<div>` disappears while the
 * paragraphs it wrapped stay where they were.
 */
function emitNode(node: DOMNode, policy: HTML.SanitizePolicy): string {
	if (node.nodeType === TEXT_NODE) return escapeText(node.nodeValue ?? "");
	if (node.nodeType !== ELEMENT_NODE) return "";

	let element = node as DOMElement;
	let tag = element.localName.toLowerCase();

	if (DROPPED_SUBTREES.has(tag)) return "";
	if (!KEPT_ELEMENTS.has(tag)) return emitChildren(element, policy);
	if (tag === "img" && isTrackingPixel(element)) return "";

	let attributes = emitAttributes(element, tag, policy);
	if (VOID_ELEMENTS.has(tag)) return `<${tag}${attributes}>`;

	return `<${tag}${attributes}>${emitChildren(element, policy)}</${tag}>`;
}

/**
 * Emits the attributes an element may keep, each double-quoted and escaped. An
 * image also gains the two attributes that bound what loading it tells its host:
 * the referrer it withholds, and the request a reader who stops short never makes.
 */
function emitAttributes(element: DOMElement, tag: string, policy: HTML.SanitizePolicy): string {
	let markup = "";

	for (let attribute of Array.from(element.attributes)) {
		let name = attribute.name.toLowerCase();
		if (!isAllowed(tag, name)) continue;

		let value = attribute.value;

		if (URL_ATTRIBUTES.has(name)) {
			let url = acceptableUrl(value, name, policy.baseUrl);
			if (url === null) continue;
			value = url;
		}

		markup += ` ${name}="${escapeAttribute(value)}"`;
	}

	if (tag === "img") markup += ` referrerpolicy="no-referrer" loading="lazy"`;

	return markup;
}

/** Reports whether an element may carry an attribute, by name and by element. */
function isAllowed(tag: string, name: string): boolean {
	if (GLOBAL_ATTRIBUTES.has(name)) return true;
	return ELEMENT_ATTRIBUTES.get(tag)?.has(name) === true;
}

/**
 * Resolves a URL and answers with it only when a browser may fetch or hand it off:
 * `http:` and `https:` anywhere, `mailto:` on a link. A relative URL resolves
 * against the article's own address, so it can never point at the reader's origin.
 *
 * @returns The absolute URL, or `null` when the attribute has to be dropped
 */
function acceptableUrl(value: string, name: string, baseUrl: string | undefined): string | null {
	let url: URL;

	try {
		url = baseUrl === undefined ? new URL(value) : new URL(value, baseUrl);
	} catch {
		return null;
	}

	if (FETCHABLE_SCHEMES.has(url.protocol)) return url.href;
	if (name === "href" && url.protocol === "mailto:") return url.href;

	return null;
}

/** Reports whether an image declares a side of one pixel, which is never content. */
function isTrackingPixel(element: DOMElement): boolean {
	return ["width", "height"].some((side) => element.getAttribute(side)?.trim() === "1");
}

/** Escapes text so the characters that open markup arrive as the characters they are. */
function escapeText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escapes an attribute value, the quote included, since values are emitted quoted. */
function escapeAttribute(value: string): string {
	return escapeText(value).replaceAll(`"`, "&quot;");
}
