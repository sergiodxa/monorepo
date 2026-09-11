/**
 * Reads a parsed XML tree as a sitemap: which of the protocol's two roots arrived,
 * and the rows under it. A row keeps its URL and loses only the values the protocol
 * refuses, so one malformed field costs a caller that field rather than the document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";

import { failure, success } from "@sdxc/result";

import type { Sitemap } from "../index.js";

import { SitemapParseError } from "../index.js";

/**
 * The `<changefreq>` values the protocol defines, in the order it lists them, which
 * is also the runtime spelling of `Sitemap.Frequency`.
 */
const FREQUENCIES: readonly Sitemap.Frequency[] = [
	"always",
	"hourly",
	"daily",
	"weekly",
	"monthly",
	"yearly",
	"never",
];

/**
 * One sitemap document as reading it produced: the root that identified it, and the
 * rows that carried a usable URL.
 */
export interface SitemapDocument {
	kind: Sitemap.Kind;
	entries: Sitemap.Entry[];
}

/**
 * Reads a document as a sitemap, answering with the reason it is not one when the
 * root says so, which is the check that separates a sitemap from the error page a
 * host serves under a `200` in its place.
 *
 * @param xml - The parsed document to read
 * @returns The document type and its entries, or why the document is not a sitemap
 */
export function parseDocument(xml: XML): Result<SitemapDocument, SitemapParseError> {
	let root = xml.root;
	let kind = kindOf(localName(root.name));

	if (!kind) {
		let message = `Expected a <urlset> or <sitemapindex> root, received <${root.name}>.`;
		return failure(new SitemapParseError(message));
	}

	let row = kind === "index" ? "sitemap" : "url";
	let entries: Sitemap.Entry[] = [];

	for (let child of childElements(root)) {
		if (localName(child.name) !== row) continue;
		let entry = toEntry(child);
		if (entry) entries.push(entry);
	}

	return success({ kind, entries });
}

/**
 * Maps a root element name to the document type it identifies, reporting `undefined`
 * for every other root so the caller names what arrived.
 */
function kindOf(name: string): Sitemap.Kind | undefined {
	if (name === "urlset") return "urlset";
	if (name === "sitemapindex") return "index";
	return undefined;
}

/**
 * Reads one row, which is an entry only when it carries a `<loc>` that stands on its
 * own as an absolute URL, since that URL is the whole of what a consumer came for.
 */
function toEntry(element: XML.Element): Sitemap.Entry | undefined {
	let loc = toURL(textOf(element, "loc"));
	if (!loc) return undefined;

	let entry: Sitemap.Entry = { loc };

	let updatedAt = toDate(textOf(element, "lastmod"));
	if (updatedAt) entry.updatedAt = updatedAt;

	let frequency = toFrequency(textOf(element, "changefreq"));
	if (frequency) entry.frequency = frequency;

	let priority = toPriority(textOf(element, "priority"));
	if (priority !== undefined) entry.priority = priority;

	return entry;
}

/**
 * Reads the text of a row's own child, taking the first when a document repeats one,
 * and reporting `undefined` for an element that holds only whitespace.
 */
function textOf(element: XML.Element, name: string): string | undefined {
	let child = childElements(element).find((candidate) => localName(candidate.name) === name);
	if (!child) return undefined;

	let text = "";
	for (let node of child.children ?? []) {
		if (typeof node === "string") text += node;
	}

	return text.trim() || undefined;
}

/**
 * Lists the element children of one element, dropping the text between them.
 */
function childElements(element: XML.Element): XML.Element[] {
	let elements: XML.Element[] = [];
	for (let child of element.children ?? []) {
		if (typeof child !== "string") elements.push(child);
	}
	return elements;
}

/**
 * Strips the prefix off a qualified name, which is how this package compares element
 * names: the XML layer resolves no namespaces, so the prefix a document binds the
 * sitemap namespace to carries no meaning on its own.
 */
function localName(name: string): string {
	let separator = name.indexOf(":");
	if (separator === -1) return name;
	return name.slice(separator + 1);
}

/**
 * Reads a `<loc>` as the absolute URL the protocol requires, reporting `undefined`
 * for a relative or malformed one so the caller drops the row.
 */
function toURL(value?: string): globalThis.URL | undefined {
	if (!value) return undefined;
	try {
		return new URL(value);
	} catch {
		return undefined;
	}
}

/**
 * Reads a `<lastmod>`, which is W3C Datetime, so a date alone and a full timestamp
 * both arrive as a `Date` and anything else arrives as `undefined` rather than an
 * `Invalid Date` a consumer has to test for.
 */
function toDate(value?: string): Date | undefined {
	if (!value) return undefined;

	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return undefined;
	return date;
}

/**
 * Reads a `<changefreq>` as one of the protocol's values, so the field a consumer
 * reads is the field `append` accepts.
 */
function toFrequency(value?: string): Sitemap.Frequency | undefined {
	return FREQUENCIES.find((frequency) => frequency === value);
}

/**
 * Reads a `<priority>` as a number inside the protocol's 0.0–1.0 range, so a consumer
 * that sorts or weights by it reads either a value the protocol allows or nothing.
 */
function toPriority(value?: string): number | undefined {
	if (value === undefined) return undefined;

	let priority = Number(value);
	if (!Number.isFinite(priority)) return undefined;
	if (priority < 0 || priority > 1) return undefined;

	return priority;
}
