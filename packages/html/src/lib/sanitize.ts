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
	"caption",
	"cite",
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
	"kbd",
	"li",
	"mark",
	"ol",
	"p",
	"pre",
	"q",
	"s",
	"samp",
	"small",
	"span",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"time",
	"tr",
	"u",
	"ul",
	"var",
]);

/**
 * Elements whose content is code, chrome or another document, which leave with
 * their whole subtree: a script's body is a program and reading it as text would
 * put that program's source into the article.
 */
const DROPPED_SUBTREES = new Set([
	"applet",
	"base",
	"button",
	"embed",
	"form",
	"head",
	"iframe",
	"input",
	"label",
	"link",
	"math",
	"meta",
	"noscript",
	"object",
	"option",
	"script",
	"select",
	"style",
	"svg",
	"template",
	"textarea",
	"title",
]);

/** Elements that carry no children and therefore emit no closing tag. */
const VOID_ELEMENTS = new Set(["br", "hr", "img"]);

/**
 * What each element may carry. The table is the whole rule: an attribute is kept
 * because an element is named here beside it, so an attribute the platform adds
 * after this was written is inert on the day it ships.
 */
const ELEMENT_ATTRIBUTES = new Map([
	["a", new Set(["href", "title"])],
	["abbr", new Set(["title"])],
	["blockquote", new Set(["cite"])],
	["img", new Set(["alt", "height", "src", "width"])],
	["li", new Set(["value"])],
	["ol", new Set(["reversed", "start", "type"])],
	["q", new Set(["cite"])],
	["td", new Set(["colspan", "rowspan"])],
	["th", new Set(["colspan", "rowspan"])],
	["time", new Set(["datetime"])],
]);

/** Attributes whose value is a URL, and therefore a scheme worth checking. */
const URL_ATTRIBUTES = new Set(["cite", "href", "src"]);

/** Attributes read as an integer, so a declared span is a number rather than markup. */
const SPAN_ATTRIBUTES = new Set(["colspan", "rowspan"]);

/**
 * The widest span a cell may declare. A table wider than this is a layout bomb
 * rather than a table, and the cap costs a publisher nothing a reader would see.
 */
const MAX_SPAN = 64;

/** The schemes a browser may be asked to navigate to or hand off from an article. */
const LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * The schemes an image may be fetched over. `data:` is absent even here, because
 * `data:image/svg+xml` is a script document an `<img>` will name as an image.
 */
const IMAGE_SCHEMES = new Set(["http:", "https:"]);

/**
 * What a link out of an article carries, written here rather than copied: a
 * publisher's own `target` navigates the reader's app frame away, and `nofollow`
 * says this app vouches for nothing a stranger's document points at.
 */
const OUTBOUND_LINK = ` target="_blank" rel="noopener noreferrer nofollow"`;

/**
 * The largest side an image may declare and still be dropped as a measurement
 * rather than rendered as content. An image two pixels across carries no picture,
 * and the one thing it reliably carries is that this reader opened this article.
 */
const PIXEL_SIDE = 2;

/** Hosts whose framed player is recognized, and what a link to the same video reads as. */
const EMBED_HOSTS = new Map([
	["www.youtube.com", "youtube"],
	["youtube.com", "youtube"],
	["m.youtube.com", "youtube"],
	["www.youtube-nocookie.com", "youtube"],
	["youtube-nocookie.com", "youtube"],
	["youtu.be", "youtube"],
	["player.vimeo.com", "vimeo"],
]);

/** A video an embed named, as the link replacing that embed carries it. */
interface Embed {
	/** Where the video is watched, which is the publisher's own site. */
	href: string;
	/** The still the link is drawn with, or `null` for a host that publishes none. */
	thumbnail: string | null;
}

/** What one pass removed, accumulated as the tree is walked. */
interface Tally {
	removedElements: number;
	removedAttributes: number;
	droppedUrls: number;
	pixels: number;
}

/**
 * Rewrites markup into the subset that is safe to render beside a reader's own
 * session: every element and attribute is named by an allow-list, so an `on*`
 * handler, a `javascript:` URL and an inline style are absent rather than removed.
 *
 * @param source - The markup as the server sent it, a full page or a fragment
 * @param policy - The article's final URL, and where a report of the pass goes
 * @returns The sanitized markup, or the failure a source carrying none produces
 */
export function sanitize(
	source: string,
	policy: HTML.SanitizePolicy = {},
): Result<string, HTMLParseError> {
	let startedAt = performance.now();

	let document = parseDocument(source);
	if (isFailure(document)) return document;

	let tally: Tally = { removedElements: 0, removedAttributes: 0, droppedUrls: 0, pixels: 0 };
	let markup = emitChildren(document.data.body, policy, tally);

	policy.report?.({ ...tally, durationMs: Math.round(performance.now() - startedAt) });

	return success(markup);
}

/** Emits every child of a node in document order, which is the article's own order. */
function emitChildren(node: DOMNode, policy: HTML.SanitizePolicy, tally: Tally): string {
	let markup = "";
	for (let child of Array.from(node.childNodes)) markup += emitNode(child, policy, tally);
	return markup;
}

/**
 * Emits one node: text as escaped text, a kept element as itself, a dropped element
 * as nothing, and anything else as its children, so a `<div>` disappears while the
 * paragraphs it wrapped stay where they were.
 */
function emitNode(node: DOMNode, policy: HTML.SanitizePolicy, tally: Tally): string {
	if (node.nodeType === TEXT_NODE) return escapeText(node.nodeValue ?? "");
	if (node.nodeType !== ELEMENT_NODE) return "";

	let element = node as DOMElement;
	let tag = element.localName.toLowerCase();

	if (tag === "iframe") {
		tally.removedElements += 1;
		let embed = embedOf(element, policy.baseUrl);
		return embed === null ? "" : emitEmbed(embed);
	}

	if (DROPPED_SUBTREES.has(tag)) {
		tally.removedElements += 1;
		return "";
	}

	if (!KEPT_ELEMENTS.has(tag)) {
		tally.removedElements += 1;
		return emitChildren(element, policy, tally);
	}

	if (tag === "img" && isTrackingPixel(element)) {
		tally.pixels += 1;
		tally.removedElements += 1;
		return "";
	}

	let attributes = emitAttributes(element, tag, policy, tally);
	if (VOID_ELEMENTS.has(tag)) return `<${tag}${attributes}>`;

	return `<${tag}${attributes}>${emitChildren(element, policy, tally)}</${tag}>`;
}

/**
 * Emits the attributes an element may keep, each double-quoted and escaped. An
 * image also gains the two attributes that bound what loading it tells its host:
 * the referrer it withholds, and the request a reader who stops short never makes.
 */
function emitAttributes(
	element: DOMElement,
	tag: string,
	policy: HTML.SanitizePolicy,
	tally: Tally,
): string {
	let markup = "";
	let hasHref = false;

	for (let attribute of Array.from(element.attributes)) {
		let name = attribute.name.toLowerCase();

		if (!isAllowed(tag, name)) {
			tally.removedAttributes += 1;
			continue;
		}

		let value = attribute.value;

		if (URL_ATTRIBUTES.has(name)) {
			let url = acceptableUrl(value, name, policy.baseUrl);
			if (url === null) {
				tally.droppedUrls += 1;
				continue;
			}
			value = url;
			if (name === "href") hasHref = true;
		}

		if (SPAN_ATTRIBUTES.has(name)) {
			let span = boundedSpan(value);
			if (span === null) {
				tally.removedAttributes += 1;
				continue;
			}
			value = span;
		}

		markup += ` ${name}="${escapeAttribute(value)}"`;
	}

	if (tag === "img") markup += ` referrerpolicy="no-referrer" loading="lazy"`;
	if (tag === "a" && hasHref) markup += OUTBOUND_LINK;

	return markup;
}

/** Reports whether an element may carry an attribute, by name and by element. */
function isAllowed(tag: string, name: string): boolean {
	return ELEMENT_ATTRIBUTES.get(tag)?.has(name) === true;
}

/**
 * A declared span as a number inside {@link MAX_SPAN}, so a cell claiming ten
 * thousand columns claims sixty-four instead of arriving as the text it was written
 * as.
 *
 * @returns The span as digits, or `null` when the value named no positive number
 */
function boundedSpan(value: string): string | null {
	let span = Number.parseInt(value.trim(), 10);
	if (!Number.isFinite(span) || span < 1) return null;
	return String(Math.min(span, MAX_SPAN));
}

/**
 * Resolves a URL and answers with it only when a browser may fetch or hand it off:
 * `http:` and `https:` anywhere, `mailto:` on a link and a citation. A relative URL
 * resolves against the article's own address, so it can never point at the reader's
 * origin.
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

	if (name === "src") return IMAGE_SCHEMES.has(url.protocol) ? url.href : null;
	return LINK_SCHEMES.has(url.protocol) ? url.href : null;
}

/**
 * Reports whether an image declares a side small enough to carry no picture, which
 * is what a measurement dressed as an image looks like when it declares anything.
 */
function isTrackingPixel(element: DOMElement): boolean {
	return ["width", "height"].some((side) => {
		let declared = element.getAttribute(side);
		if (declared === null) return false;
		let size = Number.parseInt(declared.trim(), 10);
		return Number.isFinite(size) && size <= PIXEL_SIDE;
	});
}

/**
 * The video a framed player names, read off the player's own address. A host this
 * does not recognize answers `null`, so an unknown frame leaves nothing behind at
 * all rather than a link to a page nobody can describe.
 */
function embedOf(element: DOMElement, baseUrl: string | undefined): Embed | null {
	let src = element.getAttribute("src");
	if (src === null) return null;

	let url: URL;
	try {
		url = baseUrl === undefined ? new URL(src) : new URL(src, baseUrl);
	} catch {
		return null;
	}

	let host = EMBED_HOSTS.get(url.hostname.toLowerCase());
	if (host === undefined) return null;

	if (host === "youtube") {
		let id = url.hostname.toLowerCase().endsWith("youtu.be")
			? url.pathname.slice(1)
			: (url.pathname.split("/").at(-1) ?? "");

		if (!/^[\w-]{6,20}$/u.test(id)) return null;

		return {
			href: `https://www.youtube.com/watch?v=${id}`,
			thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
		};
	}

	let id = url.pathname.split("/").at(-1) ?? "";
	if (!/^\d{4,20}$/u.test(id)) return null;

	return { href: `https://vimeo.com/${id}`, thumbnail: null };
}

/**
 * The link a framed player becomes: the video's own still where there is one, and
 * the address itself where there is none, so a reader sees what the frame held and
 * reaches it at the publisher's site rather than inside this app's own frame tree.
 */
function emitEmbed(embed: Embed): string {
	let href = escapeAttribute(embed.href);

	let body =
		embed.thumbnail === null
			? escapeText(embed.href)
			: `<img src="${escapeAttribute(embed.thumbnail)}" alt="" referrerpolicy="no-referrer" loading="lazy">`;

	return `<p><a href="${href}"${OUTBOUND_LINK}>${body}</a></p>`;
}

/** Escapes text so the characters that open markup arrive as the characters they are. */
function escapeText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escapes an attribute value, the quote included, since values are emitted quoted. */
function escapeAttribute(value: string): string {
	return escapeText(value).replaceAll(`"`, "&quot;");
}
