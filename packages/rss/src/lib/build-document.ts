/**
 * Builds the XML document tree for an RSS 2.0 feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import type { RSS } from "../index.js";

import { cloneAttributes } from "./clone.js";
import {
	ATOM_NAMESPACE,
	CONTENT_NAMESPACE,
	DUBLIN_CORE_NAMESPACE,
	RSS_VERSION,
	SLASH_NAMESPACE,
} from "./constants.js";
import { toXMLElement } from "./extensions.js";
import { normalizeArray, normalizeStringArray } from "./utils.js";

/**
 * Builds the XML document used to serialize the feed.
 *
 * @param channel - The RSS channel data
 * @param items - The RSS items
 * @returns The XML document data
 */
export function buildDocument(channel: RSS.Channel, items: RSS.Item[]): XML.Document {
	let namespaces = collectNamespaces(channel, items);
	let rootAttributes: Record<string, string> = { version: RSS_VERSION };

	for (let [prefix, uri] of Object.entries(namespaces)) {
		rootAttributes[prefix === "" ? "xmlns" : `xmlns:${prefix}`] = uri;
	}

	let channelChildren: XML.Node[] = [];
	channelChildren.push(createTextElement("title", channel.title));
	channelChildren.push(createTextElement("link", channel.link));
	channelChildren.push(createTextElement("description", channel.description));

	pushOptionalTextElement(channelChildren, "language", channel.language);
	pushOptionalTextElement(channelChildren, "copyright", channel.copyright);
	pushOptionalTextElement(channelChildren, "managingEditor", channel.managingEditor);
	pushOptionalTextElement(channelChildren, "webMaster", channel.webMaster);
	pushOptionalTextElement(channelChildren, "pubDate", channel.pubDate);
	pushOptionalTextElement(channelChildren, "lastBuildDate", channel.lastBuildDate);

	for (let category of normalizeArray(channel.category)) {
		channelChildren.push(buildCategoryElement(category));
	}

	pushOptionalTextElement(channelChildren, "generator", channel.generator);
	pushOptionalTextElement(channelChildren, "docs", channel.docs ?? undefined);

	if (channel.cloud) channelChildren.push(buildCloudElement(channel.cloud));
	if (typeof channel.ttl === "number")
		channelChildren.push(createTextElement("ttl", String(channel.ttl)));
	if (channel.image) channelChildren.push(buildImageElement(channel.image));
	pushOptionalTextElement(channelChildren, "rating", channel.rating);
	if (channel.textInput) channelChildren.push(buildTextInputElement(channel.textInput));

	if (channel.skipHours && channel.skipHours.length > 0) {
		channelChildren.push({
			name: "skipHours",
			attributes: {},
			children: channel.skipHours.map((hour) => createTextElement("hour", String(hour))),
		});
	}

	if (channel.skipDays && channel.skipDays.length > 0) {
		channelChildren.push({
			name: "skipDays",
			attributes: {},
			children: channel.skipDays.map((day) => createTextElement("day", day)),
		});
	}

	for (let atomLink of normalizeArray(channel.atomLink)) {
		channelChildren.push(buildAtomLinkElement(atomLink));
	}

	for (let creator of normalizeStringArray(channel.dcCreator)) {
		channelChildren.push(createTextElement("dc:creator", creator));
	}

	for (let extension of channel.extensions ?? []) {
		channelChildren.push(toXMLElement(extension));
	}

	for (let item of items) {
		channelChildren.push(buildItemElement(item));
	}

	let channelElement: XML.Element = {
		name: "channel",
		attributes: cloneAttributes(channel.attributes) ?? {},
		children: channelChildren,
	};

	return {
		declaration: { version: "1.0", encoding: "UTF-8" },
		root: {
			name: "rss",
			attributes: rootAttributes,
			children: [channelElement],
		},
	};
}

/**
 * Builds one item element in RSS order.
 *
 * @param item - The item to serialize
 * @returns The XML item element
 */
function buildItemElement(item: RSS.Item): XML.Element {
	let children: XML.Node[] = [];

	pushOptionalTextElement(children, "title", item.title);
	pushOptionalTextElement(children, "link", item.link);
	pushOptionalTextElement(children, "description", item.description);
	pushOptionalTextElement(children, "author", item.author);

	for (let category of normalizeArray(item.category)) {
		children.push(buildCategoryElement(category));
	}

	pushOptionalTextElement(children, "comments", item.comments);

	for (let enclosure of normalizeArray(item.enclosure)) {
		children.push(buildEnclosureElement(enclosure));
	}

	if (item.guid !== undefined) children.push(buildGuidElement(item.guid));
	pushOptionalTextElement(children, "pubDate", item.pubDate);
	if (item.source) children.push(buildSourceElement(item.source));
	pushOptionalTextElement(children, "content:encoded", item.contentEncoded);

	for (let atomLink of normalizeArray(item.atomLink)) {
		children.push(buildAtomLinkElement(atomLink));
	}

	for (let creator of normalizeStringArray(item.dcCreator)) {
		children.push(createTextElement("dc:creator", creator));
	}

	if (typeof item.slashComments === "number") {
		children.push(createTextElement("slash:comments", String(item.slashComments)));
	}

	for (let extension of item.extensions ?? []) {
		children.push(toXMLElement(extension));
	}

	return {
		name: "item",
		attributes: cloneAttributes(item.attributes) ?? {},
		children,
	};
}

/**
 * Builds one category element from either a plain string or structured input.
 *
 * @param category - The category to serialize
 * @returns The XML category element
 */
function buildCategoryElement(category: RSS.CategoryInput): XML.Element {
	if (typeof category === "string") return createTextElement("category", category);

	let attributes = cloneAttributes(category.attributes) ?? {};
	if (category.domain) attributes.domain = category.domain;

	let children: XML.Node[] = [category.value];
	for (let extension of category.extensions ?? []) children.push(toXMLElement(extension));

	return { name: "category", attributes, children };
}

/**
 * Builds one rssCloud element.
 *
 * @param cloud - The cloud to serialize
 * @returns The XML cloud element
 */
function buildCloudElement(cloud: RSS.Cloud): XML.Element {
	let attributes = cloneAttributes(cloud.attributes) ?? {};
	attributes.domain = cloud.domain;
	attributes.port = String(cloud.port);
	attributes.path = cloud.path;
	attributes.registerProcedure = cloud.registerProcedure;
	attributes.protocol = cloud.protocol;

	let children = (cloud.extensions ?? []).map(toXMLElement);
	return { name: "cloud", attributes, children };
}

/**
 * Builds one channel image element.
 *
 * @param image - The image to serialize
 * @returns The XML image element
 */
function buildImageElement(image: RSS.Image): XML.Element {
	let children: XML.Node[] = [
		createTextElement("url", image.url),
		createTextElement("title", image.title),
		createTextElement("link", image.link),
	];

	pushOptionalTextElement(children, "description", image.description);
	if (typeof image.width === "number")
		children.push(createTextElement("width", String(image.width)));
	if (typeof image.height === "number") {
		children.push(createTextElement("height", String(image.height)));
	}
	for (let extension of image.extensions ?? []) children.push(toXMLElement(extension));

	return {
		name: "image",
		attributes: cloneAttributes(image.attributes) ?? {},
		children,
	};
}

/**
 * Builds one textInput element.
 *
 * @param textInput - The textInput to serialize
 * @returns The XML textInput element
 */
function buildTextInputElement(textInput: RSS.TextInput): XML.Element {
	let children: XML.Node[] = [
		createTextElement("title", textInput.title),
		createTextElement("description", textInput.description),
		createTextElement("name", textInput.name),
		createTextElement("link", textInput.link),
	];

	for (let extension of textInput.extensions ?? []) children.push(toXMLElement(extension));

	return {
		name: "textInput",
		attributes: cloneAttributes(textInput.attributes) ?? {},
		children,
	};
}

/**
 * Builds one enclosure element.
 *
 * @param enclosure - The enclosure to serialize
 * @returns The XML enclosure element
 */
function buildEnclosureElement(enclosure: RSS.Enclosure): XML.Element {
	let attributes = cloneAttributes(enclosure.attributes) ?? {};
	attributes.url = enclosure.url;
	attributes.length = String(enclosure.length);
	attributes.type = enclosure.type;

	let children = (enclosure.extensions ?? []).map(toXMLElement);
	return { name: "enclosure", attributes, children };
}

/**
 * Builds one guid element.
 *
 * @param guid - The guid to serialize
 * @returns The XML guid element
 */
function buildGuidElement(guid: RSS.GuidInput): XML.Element {
	if (typeof guid === "string") return createTextElement("guid", guid);

	let attributes = cloneAttributes(guid.attributes) ?? {};
	if (guid.isPermaLink !== undefined) attributes.isPermaLink = String(guid.isPermaLink);

	let children: XML.Node[] = [guid.value];
	for (let extension of guid.extensions ?? []) children.push(toXMLElement(extension));

	return { name: "guid", attributes, children };
}

/**
 * Builds one source element.
 *
 * @param source - The source to serialize
 * @returns The XML source element
 */
function buildSourceElement(source: RSS.Source): XML.Element {
	let attributes = cloneAttributes(source.attributes) ?? {};
	attributes.url = source.url;

	let children: XML.Node[] = [source.value];
	for (let extension of source.extensions ?? []) children.push(toXMLElement(extension));

	return { name: "source", attributes, children };
}

/**
 * Builds one Atom link extension element.
 *
 * @param atomLink - The Atom link to serialize
 * @returns The XML atom:link element
 */
function buildAtomLinkElement(atomLink: RSS.AtomLink): XML.Element {
	let attributes = cloneAttributes(atomLink.attributes) ?? {};
	attributes.href = atomLink.href;
	if (atomLink.rel) attributes.rel = atomLink.rel;
	if (atomLink.type) attributes.type = atomLink.type;
	if (atomLink.hreflang) attributes.hreflang = atomLink.hreflang;
	if (atomLink.title) attributes.title = atomLink.title;
	if (typeof atomLink.length === "number") attributes.length = String(atomLink.length);

	let children = (atomLink.extensions ?? []).map(toXMLElement);
	return { name: "atom:link", attributes, children };
}

/**
 * Creates one text-only XML element.
 *
 * @param name - The element name
 * @param value - The text value
 * @returns The XML element
 */
function createTextElement(name: string, value: string): XML.Element {
	return { name, attributes: {}, children: [value] };
}

/**
 * Adds a text-only element when the value exists.
 *
 * @param children - The children array to mutate
 * @param name - The element name
 * @param value - The optional text value
 */
function pushOptionalTextElement(children: XML.Node[], name: string, value?: string): void {
	if (value === undefined) return;
	children.push(createTextElement(name, value));
}

/**
 * Collects namespace declarations required by explicit extension fields.
 *
 * @param channel - The channel data
 * @param items - The item data
 * @returns The namespace declarations to serialize on the root element
 */
function collectNamespaces(channel: RSS.Channel, items: RSS.Item[]): Record<string, string> {
	let namespaces = { ...channel.namespaces };

	if (
		normalizeArray(channel.atomLink).length > 0 ||
		items.some((item) => normalizeArray(item.atomLink).length > 0)
	) {
		namespaces.atom ??= ATOM_NAMESPACE;
	}

	if (items.some((item) => item.contentEncoded !== undefined)) {
		namespaces.content ??= CONTENT_NAMESPACE;
	}

	if (
		normalizeStringArray(channel.dcCreator).length > 0 ||
		items.some((item) => normalizeStringArray(item.dcCreator).length > 0)
	) {
		namespaces.dc ??= DUBLIN_CORE_NAMESPACE;
	}

	if (items.some((item) => typeof item.slashComments === "number")) {
		namespaces.slash ??= SLASH_NAMESPACE;
	}

	return namespaces;
}
