/**
 * The receiving half of Webmention: reads and answers the endpoint's request without
 * fetching anything, then, in a background job, verifies the source under bounds and
 * turns its microformats into a mention ready to store and render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMDocument } from "@sdxc/html/document";
import type { MF2 } from "@sdxc/microformats";
import type { Vocabulary } from "@sdxc/microformats/vocabulary";
import type { Result } from "@sdxc/result";

import { HTML } from "@sdxc/html";
import { parseDocument } from "@sdxc/html/document";
import { fromDocument, parseJSON } from "@sdxc/microformats";
import {
	authorOf,
	postType,
	readEntry,
	representativeCard,
	responseTo,
} from "@sdxc/microformats/vocabulary";
import { release } from "@sdxc/outbound";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { Bounds } from "./lib/fetch.js";

import {
	addressable,
	essenceOf,
	fetchBounded,
	isHTML,
	readBody,
	transientStatus,
} from "./lib/fetch.js";
import { absolute, baseOf, resolve, withoutFragment } from "./lib/urls.js";

import type { Webmention, WebmentionFetchError } from "./index.js";

import { WebmentionRequestError } from "./index.js";

/** Groups the receiver's types under a single import surface. */
export namespace Receiver {
	/** What a request is read with. */
	export interface ParseOptions {
		/** The body the `formData()` middleware already read; the request stream is consumed by then. */
		formData: FormData;
		/** Whether this receiver takes mentions for `target`: a published post on this origin. */
		accepts(target: URL): boolean | Promise<boolean>;
	}

	/** What verifying a source may spend, and the name it asks under. */
	export interface VerifyOptions extends Bounds {}

	/** What a pair is after its source was read; each is stored, upserted or deleted, by the pair. */
	export type Outcome =
		| { status: "linked"; mention: Webmention.Mention; document: MF2.Document; finalUrl: string }
		/** The source answered 410; an existing mention is deleted. */
		| { status: "gone" }
		/** The source answered and no longer links to the target; an existing mention is deleted. */
		| { status: "unlinked" };
}

/** The media type the specification requires a Webmention request to be sent as. */
const FORM_MEDIA_TYPE = "application/x-www-form-urlencoded";

/** Every attribute an element links a URL with, which is where a link to the target can sit. */
const URL_ATTRIBUTES = ["href", "src", "poster", "data"] as const;

/** The document a source with no microformats reads as, so an outcome always carries one. */
const EMPTY_DOCUMENT: MF2.Document = { items: [], rels: {}, relUrls: {} };

/**
 * Reads and checks a Webmention request. Nothing is fetched: a source that names a
 * private host is refused here too, since verifying it could never succeed.
 *
 * @param request - The request, for its `Content-Type`
 * @param options - Its already-parsed body, and whether a target is one this receiver takes
 * @returns The pair to verify, or the reason the specification answers `400` with
 */
export async function parseRequest(
	request: Request,
	options: Receiver.ParseOptions,
): Promise<Result<Webmention.Pair, WebmentionRequestError>> {
	if (essenceOf(request) !== FORM_MEDIA_TYPE) {
		return failure(
			new WebmentionRequestError("media-type", `Expected a body sent as ${FORM_MEDIA_TYPE}.`),
		);
	}

	let sourceValue = options.formData.get("source");
	let targetValue = options.formData.get("target");
	if (typeof sourceValue !== "string" || sourceValue.trim() === "") {
		return failure(new WebmentionRequestError("missing", "Expected a source URL."));
	}
	if (typeof targetValue !== "string" || targetValue.trim() === "") {
		return failure(new WebmentionRequestError("missing", "Expected a target URL."));
	}

	let source = addressable(sourceValue.trim());
	if (isFailure(source)) {
		return failure(
			new WebmentionRequestError("invalid-url", `The source is not a public HTTP(S) URL.`),
		);
	}

	let target = absolute(targetValue);
	if (target === null || !isHTTP(target)) {
		return failure(new WebmentionRequestError("invalid-url", "The target is not an HTTP(S) URL."));
	}

	if (source.data.href === target.href) {
		return failure(
			new WebmentionRequestError("same-url", "The source and the target are the same URL."),
		);
	}

	if (!(await options.accepts(target))) {
		return failure(
			new WebmentionRequestError(
				"target-not-accepted",
				"The target is not a resource this endpoint takes mentions for.",
			),
		);
	}

	return success({ source: source.data, target });
}

/**
 * `202 Accepted`, the answer to a request whose verification was queued.
 *
 * @param location - A page reporting the mention's status, sent as `Location`
 */
export function accepted(location?: string | URL): Response {
	let headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
	if (location !== undefined) headers.set("Location", String(location));
	return new Response("Accepted", { status: 202, headers });
}

/** `400 Bad Request`, with the error's message as the plain-text body. */
export function rejected(error: WebmentionRequestError): Response {
	return new Response(error.message, {
		status: 400,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

/**
 * Fetches `source` under bounds and decides what the pair now is: `410` is `gone`, and
 * any other 4xx or a body without the link is `unlinked`. HTML links by attribute, JSON
 * when a string in it is the target, and text when it contains the target.
 *
 * @param pair - The mention to verify
 * @param options - The user agent to ask under, and the bounds
 * @returns The outcome, or a fetch error whose `retryable` tells a job to retry or ack
 */
export async function verify(
	pair: Webmention.Pair,
	options: Receiver.VerifyOptions,
): Promise<Result<Receiver.Outcome, WebmentionFetchError>> {
	let fetched = await fetchBounded(pair.source, options);
	if (isFailure(fetched)) return fetched;

	let { response, url } = fetched.data;
	let transient = transientStatus(fetched.data);
	if (transient !== null) {
		release(response.body);
		return failure(transient);
	}
	if (response.status === 410) {
		release(response.body);
		return success({ status: "gone" });
	}
	if (!response.ok) {
		release(response.body);
		return success({ status: "unlinked" });
	}

	let essence = essenceOf(response);
	if (!readable(essence)) {
		release(response.body);
		return success({ status: "unlinked" });
	}

	let body = await readBody(fetched.data, options);
	if (isFailure(body)) return body;

	if (isHTML(essence)) return success(fromHTML(body.data, url, pair));
	if (isJSON(essence)) return success(fromJSON(body.data, url, pair));
	if (!body.data.includes(pair.target.href)) return success({ status: "unlinked" });
	return success(linked(EMPTY_DOCUMENT, url, pair, null));
}

/**
 * Whether a parsed page links to `target` from an `href`, `src`, `poster` or `data`
 * attribute. Each value resolves against the page's base before comparing, and
 * fragments are ignored on both sides, since `#comments` names the same page.
 *
 * @param document - The parsed page; markup inside comments or escaped text never reaches it
 * @param baseUrl - The URL the page was served from, after redirects
 * @param target - The URL being mentioned
 */
export function linksTo(document: DOMDocument, baseUrl: string, target: URL): boolean {
	let base = baseOf(document, baseUrl);
	if (base === null) return false;

	let goal = withoutFragment(target);
	let selector = URL_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(",");

	for (let element of Array.from(document.querySelectorAll(selector))) {
		if (element.localName.toLowerCase() === "base") continue;
		for (let attribute of URL_ATTRIBUTES) {
			let value = element.getAttribute(attribute);
			if (value === null) continue;
			let url = resolve(value, base);
			if (url !== null && withoutFragment(url) === goal) return true;
		}
	}
	return false;
}

/**
 * Builds the display summary from a source page's microformats: the entry responding to
 * `target` gives the kind, author, content and date; a page with no such entry is a plain
 * mention named by its `<title>`, authored by its representative `h-card`.
 *
 * @param document - The source's microformats
 * @param source - Where the source was fetched from, which relative URLs and authorship resolve against
 * @param target - The URL being mentioned
 * @param title - The page's `<title>`, the name of a mention with no entry
 */
export function summarize(
	document: MF2.Document,
	source: URL,
	target: URL,
	title: string | null = null,
): Webmention.Mention {
	let response = responseTo(document, target.href);
	let read = response === null ? null : readEntry(response.entry);

	if (response === null || read === null || !isSuccess(read)) {
		let card = representativeCard(document, source.href);
		return {
			kind: "mention",
			url: source.href,
			author: card === null ? null : authorFrom(card),
			content: null,
			name: title,
			published: null,
		};
	}

	let entry = read.data;
	let author = authorOf(response.entry, document, source.href);
	let name = postType(response.entry) === "article" ? entry.name : null;

	return {
		kind: response.type,
		url: entry.url ?? source.href,
		author: author === null ? null : authorFrom(author),
		content: contentOf(entry, source),
		name,
		published: entry.published?.instant ?? null,
	};
}

/** Whether a body in this format can be read for a link: HTML, JSON or any text. */
function readable(essence: string): boolean {
	return isHTML(essence) || isJSON(essence) || essence.startsWith("text/");
}

/** Whether a content type is JSON, `+json` suffixes included. */
function isJSON(essence: string): boolean {
	return essence === "application/json" || essence.endsWith("+json");
}

/** Whether a URL is one a Webmention may name. */
function isHTTP(url: URL): boolean {
	return url.protocol === "http:" || url.protocol === "https:";
}

/** Reads an HTML source: one tree for the link check, the microformats and the title. */
function fromHTML(source: string, url: string, pair: Webmention.Pair): Receiver.Outcome {
	let tree = parseDocument(source);
	if (isFailure(tree) || !linksTo(tree.data, url, pair.target)) return { status: "unlinked" };

	let title = tree.data.querySelector("title")?.textContent?.replaceAll(/\s+/gu, " ").trim();
	return linked(fromDocument(tree.data, url), url, pair, title || null);
}

/**
 * Reads a JSON source, which links when any string in it is the target. A body that is
 * a microformats document is summarized like an HTML one.
 */
function fromJSON(source: string, url: string, pair: Webmention.Pair): Receiver.Outcome {
	let value: unknown;
	try {
		value = JSON.parse(source);
	} catch {
		return { status: "unlinked" };
	}
	if (!containsUrl(value, withoutFragment(pair.target))) return { status: "unlinked" };

	let document = parseJSON(source);
	return linked(isSuccess(document) ? document.data : EMPTY_DOCUMENT, url, pair, null);
}

/** Whether any string in a decoded JSON value is an absolute URL naming `goal`. */
function containsUrl(value: unknown, goal: string): boolean {
	if (typeof value === "string") {
		let url = absolute(value);
		return url !== null && withoutFragment(url) === goal;
	}
	if (Array.isArray(value)) return value.some((item) => containsUrl(item, goal));
	if (typeof value === "object" && value !== null) {
		return Object.values(value).some((item) => containsUrl(item, goal));
	}
	return false;
}

/** The `linked` outcome for a source whose microformats are `document`. */
function linked(
	document: MF2.Document,
	url: string,
	pair: Webmention.Pair,
	title: string | null,
): Receiver.Outcome {
	let mention = summarize(document, new URL(url), pair.target, title);
	return { status: "linked", mention, document, finalUrl: url };
}

/** The author fields a mention keeps, from a full card or from a URL authorship ended at. */
function authorFrom(author: Vocabulary.Card | { url: string }): Webmention.Author {
	if (!("name" in author)) return { name: null, url: author.url, photo: null };
	return { name: author.name, url: author.url, photo: author.photo?.value ?? null };
}

/**
 * The entry's content, sanitized against the source so it renders as it stands; an
 * entry with only a `summary` gives that as text. `null` when the entry carries neither.
 */
function contentOf(entry: Vocabulary.Entry, source: URL): Webmention.Mention["content"] {
	let embedded = entry.content ?? (entry.summary === null ? null : textContent(entry.summary));
	if (embedded === null || embedded.value.trim() === "") return null;

	let html = HTML.sanitize(embedded.html, { baseUrl: source.href });
	return { html: isSuccess(html) ? html.data : "", text: embedded.value };
}

/** Plain text as embedded markup, escaped so it renders as the characters it is. */
function textContent(text: string): MF2.Embedded {
	let html = text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
	return { html, value: text };
}
