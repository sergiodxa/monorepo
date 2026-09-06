/**
 * Parses an XML tree into Atom feed and entry data, threading the namespace and
 * base-URI scopes down the document so an element is judged by the namespace it
 * resolves to and every relative reference is read against the bases above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { XML } from "@sdxc/xml";

import { failure, success } from "@sdxc/result";

import type { Atom } from "../index.js";

import { AtomParseError } from "../index.js";

import type { NamespaceScope } from "./namespaces.js";
import type { Scope } from "./xml-base.js";

import { cloneAttributes } from "./clone.js";
import { parseContent } from "./content.js";
import { toExtensionElement } from "./extensions.js";
import { extendNamespaceScope, isAtomName, readNamespaceDeclarations } from "./namespaces.js";
import { parseText } from "./text-construct.js";
import {
	collapseArray,
	getChildElements,
	getElementText,
	localName,
	parseOptionalNumber,
} from "./utils.js";
import { extendScope, resolveUri } from "./xml-base.js";

/**
 * Parses a document into feed metadata and entries.
 *
 * @param xml - The parsed XML document
 * @param base - Document URI, seeding the base against which relative references resolve
 * @returns The feed and its entries, or the reason the document is not Atom
 */
export function parseDocument(xml: XML, base?: string): Result<Atom.Document, AtomParseError> {
	let root = xml.root;
	let namespaces = readNamespaceDeclarations(root);

	if (localName(root.name) !== "feed") {
		return failure(new AtomParseError(`Expected the root element to be "feed".`));
	}

	if (!isAtomName(root.name, namespaces)) {
		return failure(new AtomParseError("Expected the root element in the Atom namespace."));
	}

	let scope = extendScope({ base }, root);
	let feedResult = parseFeed(root, scope, namespaces);
	if (feedResult.status === "failure") return feedResult;

	let entries: Atom.Entry[] = [];
	for (let child of getChildElements(root)) {
		if (!isAtomName(child.name, namespaces) || localName(child.name) !== "entry") continue;

		let entryResult = parseEntry(child, scope, namespaces);
		if (entryResult.status === "failure") return entryResult;
		entries.push(entryResult.data);
	}

	return success({ feed: feedResult.data, entries });
}

/**
 * Parses the feed element's own children, skipping the entries, which the caller
 * collects separately so one pass does not have to build both shapes at once.
 */
function parseFeed(
	element: XML.Element,
	scope: Scope,
	namespaces: NamespaceScope,
): Result<Atom.Feed, AtomParseError> {
	let authors: Atom.Person[] = [];
	let contributors: Atom.Person[] = [];
	let links: Atom.Link[] = [];
	let categories: Atom.CategoryInput[] = [];
	let extensions: Atom.Element[] = [];

	let feed: Partial<Atom.Feed> = {
		namespaces: cloneAttributes(namespaces),
		attributes: readOwnAttributes(element),
		lang: scope.lang,
		base: scope.base,
	};

	for (let child of getChildElements(element)) {
		if (!isAtomName(child.name, extendNamespaceScope(namespaces, child))) {
			extensions.push(toExtensionElement(child));
			continue;
		}

		let childScope = extendScope(scope, child);

		switch (localName(child.name)) {
			case "id": {
				feed.id = getElementText(child);
				break;
			}
			case "title": {
				feed.title = parseText(child);
				break;
			}
			case "updated": {
				feed.updated = getElementText(child);
				break;
			}
			case "subtitle": {
				feed.subtitle = parseText(child);
				break;
			}
			case "rights": {
				feed.rights = parseText(child);
				break;
			}
			case "author": {
				authors.push(parsePerson(child, childScope, namespaces));
				break;
			}
			case "contributor": {
				contributors.push(parsePerson(child, childScope, namespaces));
				break;
			}
			case "link": {
				links.push(parseLink(child, childScope, namespaces));
				break;
			}
			case "category": {
				categories.push(parseCategory(child, namespaces));
				break;
			}
			case "generator": {
				feed.generator = parseGenerator(child, childScope);
				break;
			}
			case "icon": {
				feed.icon = resolveUri(childScope, getElementText(child));
				break;
			}
			case "logo": {
				feed.logo = resolveUri(childScope, getElementText(child));
				break;
			}
			/** Collected by the caller, which builds the entry list in its own pass. */
			case "entry": {
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (!feed.id) return failure(new AtomParseError("Feed must include an id."));
	if (feed.title === undefined) return failure(new AtomParseError("Feed must include a title."));
	if (!feed.updated) {
		return failure(new AtomParseError("Feed must include an updated timestamp."));
	}

	if (authors.length > 0) feed.author = collapseArray(authors);
	if (contributors.length > 0) feed.contributor = collapseArray(contributors);
	if (links.length > 0) feed.link = collapseArray(links);
	if (categories.length > 0) feed.category = collapseArray(categories);
	if (extensions.length > 0) feed.extensions = extensions;

	return success(feed as Atom.Feed);
}

/** Parses one entry element. */
function parseEntry(
	element: XML.Element,
	parentScope: Scope,
	namespaces: NamespaceScope,
): Result<Atom.Entry, AtomParseError> {
	let scope = extendScope(parentScope, element);
	let authors: Atom.Person[] = [];
	let contributors: Atom.Person[] = [];
	let links: Atom.Link[] = [];
	let categories: Atom.CategoryInput[] = [];
	let extensions: Atom.Element[] = [];

	let entry: Partial<Atom.Entry> = {
		attributes: readOwnAttributes(element),
		lang: scope.lang === parentScope.lang ? undefined : scope.lang,
		base: scope.base === parentScope.base ? undefined : scope.base,
	};

	for (let child of getChildElements(element)) {
		if (!isAtomName(child.name, extendNamespaceScope(namespaces, child))) {
			extensions.push(toExtensionElement(child));
			continue;
		}

		let childScope = extendScope(scope, child);

		switch (localName(child.name)) {
			case "id": {
				entry.id = getElementText(child);
				break;
			}
			case "title": {
				entry.title = parseText(child);
				break;
			}
			case "updated": {
				entry.updated = getElementText(child);
				break;
			}
			case "published": {
				entry.published = getElementText(child);
				break;
			}
			case "summary": {
				entry.summary = parseText(child);
				break;
			}
			case "content": {
				entry.content = parseContent(child, childScope);
				break;
			}
			case "rights": {
				entry.rights = parseText(child);
				break;
			}
			case "author": {
				authors.push(parsePerson(child, childScope, namespaces));
				break;
			}
			case "contributor": {
				contributors.push(parsePerson(child, childScope, namespaces));
				break;
			}
			case "link": {
				links.push(parseLink(child, childScope, namespaces));
				break;
			}
			case "category": {
				categories.push(parseCategory(child, namespaces));
				break;
			}
			case "source": {
				entry.source = parseSource(child, childScope, namespaces);
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (!entry.id) return failure(new AtomParseError("Entry must include an id."));
	if (entry.title === undefined) return failure(new AtomParseError("Entry must include a title."));
	if (!entry.updated) {
		return failure(new AtomParseError("Entry must include an updated timestamp."));
	}

	if (authors.length > 0) entry.author = collapseArray(authors);
	if (contributors.length > 0) entry.contributor = collapseArray(contributors);
	if (links.length > 0) entry.link = collapseArray(links);
	if (categories.length > 0) entry.category = collapseArray(categories);
	if (extensions.length > 0) entry.extensions = extensions;

	return success(entry as Atom.Entry);
}

/** Parses a person construct: an author or a contributor. */
function parsePerson(element: XML.Element, scope: Scope, namespaces: NamespaceScope): Atom.Person {
	let person: Atom.Person = { name: "" };
	let extensions: Atom.Element[] = [];

	for (let child of getChildElements(element)) {
		if (!isAtomName(child.name, extendNamespaceScope(namespaces, child))) {
			extensions.push(toExtensionElement(child));
			continue;
		}

		switch (localName(child.name)) {
			case "name": {
				person.name = getElementText(child);
				break;
			}
			case "uri": {
				person.uri = resolveUri(extendScope(scope, child), getElementText(child));
				break;
			}
			case "email": {
				person.email = getElementText(child);
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (extensions.length > 0) person.extensions = extensions;
	return person;
}

/**
 * Parses a link, resolving `href` against the base in scope. `rel` is left as the
 * document spelled it, absent included, because RFC 4287's `alternate` default is
 * a reader's concern rather than something to bake into stored data.
 */
function parseLink(element: XML.Element, scope: Scope, namespaces: NamespaceScope): Atom.Link {
	let attributes = { ...element.attributes };
	let link: Atom.Link = { href: resolveUri(scope, attributes["href"] ?? "") };

	if (attributes["rel"] !== undefined) link.rel = attributes["rel"];
	if (attributes["type"] !== undefined) link.type = attributes["type"];
	if (attributes["hreflang"] !== undefined) link.hreflang = attributes["hreflang"];
	if (attributes["title"] !== undefined) link.title = attributes["title"];
	if (attributes["length"] !== undefined) {
		link.length = parseOptionalNumber(attributes["length"]);
	}

	for (let name of ["href", "rel", "type", "hreflang", "title", "length"]) delete attributes[name];

	let remaining = cloneAttributes(stripScopeAttributes(attributes));
	if (remaining) link.attributes = remaining;

	let extensions = collectForeignChildren(element, namespaces);
	if (extensions.length > 0) link.extensions = extensions;

	return link;
}

/** Parses a category, collapsing to the bare term when nothing else is present. */
function parseCategory(element: XML.Element, namespaces: NamespaceScope): Atom.CategoryInput {
	let attributes = { ...element.attributes };
	let term = attributes["term"] ?? "";
	let scheme = attributes["scheme"];
	let label = attributes["label"];

	for (let name of ["term", "scheme", "label"]) delete attributes[name];

	let remaining = cloneAttributes(stripScopeAttributes(attributes));
	let extensions = collectForeignChildren(element, namespaces);

	if (scheme === undefined && label === undefined && !remaining && extensions.length === 0) {
		return term;
	}

	let category: Atom.Category = { term };
	if (scheme !== undefined) category.scheme = scheme;
	if (label !== undefined) category.label = label;
	if (remaining) category.attributes = remaining;
	if (extensions.length > 0) category.extensions = extensions;

	return category;
}

/** Parses the generator element, whose `uri` resolves against the base in scope. */
function parseGenerator(element: XML.Element, scope: Scope): Atom.Generator {
	let attributes = element.attributes ?? {};
	let generator: Atom.Generator = { value: getElementText(element) };

	if (attributes["uri"] !== undefined) generator.uri = resolveUri(scope, attributes["uri"]);
	if (attributes["version"] !== undefined) generator.version = attributes["version"];

	return generator;
}

/**
 * Parses the source element, which carries a subset of feed metadata describing
 * where a copied entry came from.
 */
function parseSource(element: XML.Element, scope: Scope, namespaces: NamespaceScope): Atom.Source {
	let source: Atom.Source = {};
	let authors: Atom.Person[] = [];
	let links: Atom.Link[] = [];
	let extensions: Atom.Element[] = [];

	for (let child of getChildElements(element)) {
		if (!isAtomName(child.name, extendNamespaceScope(namespaces, child))) {
			extensions.push(toExtensionElement(child));
			continue;
		}

		let childScope = extendScope(scope, child);

		switch (localName(child.name)) {
			case "id": {
				source.id = getElementText(child);
				break;
			}
			case "title": {
				source.title = parseText(child);
				break;
			}
			case "subtitle": {
				source.subtitle = parseText(child);
				break;
			}
			case "updated": {
				source.updated = getElementText(child);
				break;
			}
			case "rights": {
				source.rights = parseText(child);
				break;
			}
			case "author": {
				authors.push(parsePerson(child, childScope, namespaces));
				break;
			}
			case "link": {
				links.push(parseLink(child, childScope, namespaces));
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	let attributes = readOwnAttributes(element);
	if (attributes) source.attributes = attributes;
	if (authors.length > 0) source.author = collapseArray(authors);
	if (links.length > 0) source.link = collapseArray(links);
	if (extensions.length > 0) source.extensions = extensions;

	return source;
}

/** Collects the children of an element that fall outside the Atom namespace. */
function collectForeignChildren(element: XML.Element, namespaces: NamespaceScope): Atom.Element[] {
	let extensions: Atom.Element[] = [];
	for (let child of getChildElements(element)) {
		if (isAtomName(child.name, extendNamespaceScope(namespaces, child))) continue;
		extensions.push(toExtensionElement(child));
	}
	return extensions;
}

/**
 * Reads the attributes an element carries in its own right, dropping the ones
 * already modelled elsewhere: namespace declarations become `namespaces`, and
 * `xml:base`/`xml:lang` become the scope every reference was resolved against.
 */
function readOwnAttributes(element: XML.Element): Record<string, string> | undefined {
	let attributes: Record<string, string> = {};

	for (let [name, value] of Object.entries(element.attributes ?? {})) {
		if (name === "xmlns" || name.startsWith("xmlns:")) continue;
		if (name === "xml:base" || name === "xml:lang") continue;
		attributes[name] = value;
	}

	return cloneAttributes(attributes);
}

/** Drops the scope-carrying attributes from a record already stripped of its own keys. */
function stripScopeAttributes(attributes: Record<string, string>): Record<string, string> {
	let remaining: Record<string, string> = {};
	for (let [name, value] of Object.entries(attributes)) {
		if (name === "xmlns" || name.startsWith("xmlns:")) continue;
		if (name === "xml:base" || name === "xml:lang") continue;
		remaining[name] = value;
	}
	return remaining;
}
