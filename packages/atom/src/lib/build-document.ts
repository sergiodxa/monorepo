/**
 * Builds the XML document for a feed, declaring the Atom namespace on the root and
 * writing every construct back in the form the format expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import type { Atom } from "../index.js";

import { ATOM_NAMESPACE } from "./constants.js";
import { buildContentElement } from "./content.js";
import { toXMLElement } from "./extensions.js";
import { buildTextElement } from "./text-construct.js";
import { normalizeArray } from "./utils.js";

/**
 * Builds the whole document.
 *
 * @param feed - The feed-level metadata
 * @param entries - The entries to write, in order
 * @returns The document, ready to serialize
 */
export function buildDocument(feed: Atom.Feed, entries: Atom.Entry[]): XML.Document {
	return {
		declaration: { version: "1.0", encoding: "UTF-8" },
		root: {
			name: "feed",
			attributes: buildRootAttributes(feed),
			children: [...buildFeedChildren(feed), ...entries.map(buildEntryElement)],
		},
	};
}

/**
 * Builds the root's attributes, declaring the Atom namespace as the default so
 * every element beneath it is unprefixed, alongside any the feed carried.
 */
function buildRootAttributes(feed: Atom.Feed): Record<string, string> {
	let attributes: Record<string, string> = {
		xmlns: ATOM_NAMESPACE,
		...feed.attributes,
	};

	for (let [prefix, uri] of Object.entries(feed.namespaces ?? {})) {
		if (prefix === "") continue;
		attributes[`xmlns:${prefix}`] = uri;
	}

	if (feed.base !== undefined) attributes["xml:base"] = feed.base;
	if (feed.lang !== undefined) attributes["xml:lang"] = feed.lang;

	return attributes;
}

/** Builds the feed element's own children, in the order RFC 4287 presents them. */
function buildFeedChildren(feed: Atom.Feed): XML.Element[] {
	let children: XML.Element[] = [
		textElement("id", feed.id),
		buildTextElement("title", feed.title),
		textElement("updated", feed.updated),
	];

	if (feed.subtitle !== undefined) children.push(buildTextElement("subtitle", feed.subtitle));
	if (feed.rights !== undefined) children.push(buildTextElement("rights", feed.rights));

	for (let author of normalizeArray(feed.author))
		children.push(buildPersonElement("author", author));
	for (let contributor of normalizeArray(feed.contributor)) {
		children.push(buildPersonElement("contributor", contributor));
	}
	for (let link of normalizeArray(feed.link)) children.push(buildLinkElement(link));
	for (let category of normalizeArray(feed.category)) children.push(buildCategoryElement(category));

	if (feed.generator) children.push(buildGeneratorElement(feed.generator));
	if (feed.icon !== undefined) children.push(textElement("icon", feed.icon));
	if (feed.logo !== undefined) children.push(textElement("logo", feed.logo));

	for (let extension of feed.extensions ?? []) children.push(toXMLElement(extension));

	return children;
}

/** Builds one entry element. */
function buildEntryElement(entry: Atom.Entry): XML.Element {
	let attributes: Record<string, string> = { ...entry.attributes };
	if (entry.base !== undefined) attributes["xml:base"] = entry.base;
	if (entry.lang !== undefined) attributes["xml:lang"] = entry.lang;

	let children: XML.Element[] = [
		textElement("id", entry.id),
		buildTextElement("title", entry.title),
		textElement("updated", entry.updated),
	];

	if (entry.published !== undefined) children.push(textElement("published", entry.published));
	if (entry.summary !== undefined) children.push(buildTextElement("summary", entry.summary));
	if (entry.content) children.push(buildContentElement(entry.content));
	if (entry.rights !== undefined) children.push(buildTextElement("rights", entry.rights));

	for (let author of normalizeArray(entry.author))
		children.push(buildPersonElement("author", author));
	for (let contributor of normalizeArray(entry.contributor)) {
		children.push(buildPersonElement("contributor", contributor));
	}
	for (let link of normalizeArray(entry.link)) children.push(buildLinkElement(link));
	for (let category of normalizeArray(entry.category))
		children.push(buildCategoryElement(category));

	if (entry.source) children.push(buildSourceElement(entry.source));
	for (let extension of entry.extensions ?? []) children.push(toXMLElement(extension));

	return { name: "entry", attributes, children };
}

/** Builds a person construct. */
function buildPersonElement(name: string, person: Atom.Person): XML.Element {
	let children: XML.Element[] = [textElement("name", person.name)];

	if (person.uri !== undefined) children.push(textElement("uri", person.uri));
	if (person.email !== undefined) children.push(textElement("email", person.email));
	for (let extension of person.extensions ?? []) children.push(toXMLElement(extension));

	return { name, attributes: {}, children };
}

/** Builds a link, which is empty and carries everything in its attributes. */
function buildLinkElement(link: Atom.Link): XML.Element {
	let attributes: Record<string, string> = { href: link.href, ...link.attributes };

	if (link.rel !== undefined) attributes["rel"] = link.rel;
	if (link.type !== undefined) attributes["type"] = link.type;
	if (link.hreflang !== undefined) attributes["hreflang"] = link.hreflang;
	if (link.title !== undefined) attributes["title"] = link.title;
	if (link.length !== undefined && Number.isFinite(link.length)) {
		attributes["length"] = String(link.length);
	}

	return {
		name: "link",
		attributes,
		children: (link.extensions ?? []).map(toXMLElement),
	};
}

/** Builds a category from either the bare-term or the structured form. */
function buildCategoryElement(category: Atom.CategoryInput): XML.Element {
	if (typeof category === "string") {
		return { name: "category", attributes: { term: category }, children: [] };
	}

	let attributes: Record<string, string> = { term: category.term, ...category.attributes };
	if (category.scheme !== undefined) attributes["scheme"] = category.scheme;
	if (category.label !== undefined) attributes["label"] = category.label;

	return {
		name: "category",
		attributes,
		children: (category.extensions ?? []).map(toXMLElement),
	};
}

/** Builds the generator element. */
function buildGeneratorElement(generator: Atom.Generator): XML.Element {
	let attributes: Record<string, string> = {};
	if (generator.uri !== undefined) attributes["uri"] = generator.uri;
	if (generator.version !== undefined) attributes["version"] = generator.version;

	return { name: "generator", attributes, children: [generator.value] };
}

/** Builds the source element an entry copied from another feed carries. */
function buildSourceElement(source: Atom.Source): XML.Element {
	let children: XML.Element[] = [];

	if (source.id !== undefined) children.push(textElement("id", source.id));
	if (source.title !== undefined) children.push(buildTextElement("title", source.title));
	if (source.subtitle !== undefined) children.push(buildTextElement("subtitle", source.subtitle));
	if (source.updated !== undefined) children.push(textElement("updated", source.updated));
	if (source.rights !== undefined) children.push(buildTextElement("rights", source.rights));

	for (let author of normalizeArray(source.author))
		children.push(buildPersonElement("author", author));
	for (let link of normalizeArray(source.link)) children.push(buildLinkElement(link));
	for (let extension of source.extensions ?? []) children.push(toXMLElement(extension));

	return { name: "source", attributes: { ...source.attributes }, children };
}

/** Builds an element holding one run of text and no attributes. */
function textElement(name: string, value: string): XML.Element {
	return { name, attributes: {}, children: [value] };
}
