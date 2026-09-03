/**
 * Parses raw XML into RSS channel and item data structures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import type { RSS } from "../index.js";

import { cloneAttributes } from "./clone.js";
import { RSS_VERSION } from "./constants.js";
import { toExtensionElement } from "./extensions.js";
import {
	collapseArray,
	getChildElements,
	getElementText,
	isEmptyRecord,
	parseOptionalNumber,
} from "./utils.js";

/**
 * Parses a validated XML tree into RSS channel and item data.
 *
 * @param xml - The parsed XML document
 * @returns The parsed RSS feed data
 */
export function parseFeed(xml: XML): Result<RSS.Feed, Error> {
	let root = xml.root;
	if (root.name !== "rss") return failure(new Error('Expected the root element to be "rss".'));
	if (root.attributes?.version !== RSS_VERSION) {
		return failure(new Error(`Expected rss version "${RSS_VERSION}".`));
	}

	let channelElement = getChildElements(root).find((child) => child.name === "channel");
	if (!channelElement) return failure(new Error("Expected one channel element."));

	let channelResult = parseChannel(channelElement, root.attributes ?? {});
	if (isFailure(channelResult)) return channelResult;

	let items: RSS.Item[] = [];
	for (let child of getChildElements(channelElement)) {
		if (child.name !== "item") continue;

		let itemResult = parseItem(child);
		if (isFailure(itemResult)) return itemResult;
		items.push(itemResult.data);
	}

	return success({ channel: channelResult.data, items });
}

/**
 * Parses channel-level RSS data and channel-scoped namespace extensions.
 *
 * @param element - The channel element
 * @param rootAttributes - The rss root attributes
 * @returns The parsed channel
 */
function parseChannel(
	element: XML.Element,
	rootAttributes: Record<string, string>,
): Result<RSS.Channel, Error> {
	let categories: RSS.CategoryInput[] = [];
	let atomLinks: RSS.AtomLink[] = [];
	let dcCreators: string[] = [];
	let extensions: RSS.Element[] = [];
	let channel: Partial<RSS.Channel> = {
		attributes: cloneAttributes(element.attributes),
		namespaces: parseNamespaces(rootAttributes),
	};

	for (let child of getChildElements(element)) {
		switch (child.name) {
			case "title": {
				channel.title = getElementText(child);
				break;
			}
			case "description": {
				channel.description = getElementText(child);
				break;
			}
			case "link": {
				channel.link = getElementText(child);
				break;
			}
			case "language": {
				channel.language = getElementText(child);
				break;
			}
			case "copyright": {
				channel.copyright = getElementText(child);
				break;
			}
			case "managingEditor": {
				channel.managingEditor = getElementText(child);
				break;
			}
			case "webMaster": {
				channel.webMaster = getElementText(child);
				break;
			}
			case "pubDate": {
				channel.pubDate = getElementText(child);
				break;
			}
			case "lastBuildDate": {
				channel.lastBuildDate = getElementText(child);
				break;
			}
			case "category": {
				categories.push(parseCategory(child));
				break;
			}
			case "generator": {
				channel.generator = getElementText(child);
				break;
			}
			case "docs": {
				channel.docs = getElementText(child);
				break;
			}
			case "cloud": {
				channel.cloud = parseCloud(child);
				break;
			}
			case "ttl": {
				channel.ttl = parseOptionalNumber(getElementText(child));
				break;
			}
			case "image": {
				let imageResult = parseImage(child);
				if (isFailure(imageResult)) return imageResult;
				channel.image = imageResult.data;
				break;
			}
			case "rating": {
				channel.rating = getElementText(child);
				break;
			}
			case "textInput": {
				let textInputResult = parseTextInput(child);
				if (isFailure(textInputResult)) return textInputResult;
				channel.textInput = textInputResult.data;
				break;
			}
			case "skipHours": {
				channel.skipHours = parseSkipHours(child);
				break;
			}
			case "skipDays": {
				channel.skipDays = parseSkipDays(child);
				break;
			}
			case "item": {
				break;
			}
			case "atom:link": {
				atomLinks.push(parseAtomLink(child));
				break;
			}
			case "dc:creator": {
				dcCreators.push(getElementText(child));
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (!channel.title || !channel.description || !channel.link) {
		return failure(new Error("Channel must include title, description, and link."));
	}

	if (categories.length > 0) channel.category = collapseArray(categories);
	if (atomLinks.length > 0) channel.atomLink = collapseArray(atomLinks) as RSS.AtomLinkInput;
	if (dcCreators.length > 0) channel.dcCreator = collapseArray(dcCreators) as string | string[];
	if (extensions.length > 0) channel.extensions = extensions;
	if (isEmptyRecord(channel.attributes)) delete channel.attributes;
	if (channel.namespaces && isEmptyRecord(channel.namespaces)) delete channel.namespaces;

	return success(channel as RSS.Channel);
}

/**
 * Parses one item and validates the minimum RSS item requirements.
 *
 * @param element - The item element
 * @returns The parsed item
 */
function parseItem(element: XML.Element): Result<RSS.Item, Error> {
	let categories: RSS.CategoryInput[] = [];
	let atomLinks: RSS.AtomLink[] = [];
	let dcCreators: string[] = [];
	let enclosures: RSS.Enclosure[] = [];
	let extensions: RSS.Element[] = [];
	let item: RSS.ItemBase = { attributes: cloneAttributes(element.attributes) };

	for (let child of getChildElements(element)) {
		switch (child.name) {
			case "title": {
				item.title = getElementText(child);
				break;
			}
			case "description": {
				item.description = getElementText(child);
				break;
			}
			case "link": {
				item.link = getElementText(child);
				break;
			}
			case "author": {
				item.author = getElementText(child);
				break;
			}
			case "category": {
				categories.push(parseCategory(child));
				break;
			}
			case "comments": {
				item.comments = getElementText(child);
				break;
			}
			case "enclosure": {
				enclosures.push(parseEnclosure(child));
				break;
			}
			case "guid": {
				item.guid = parseGuid(child);
				break;
			}
			case "pubDate": {
				item.pubDate = getElementText(child);
				break;
			}
			case "source": {
				item.source = parseSource(child);
				break;
			}
			case "content:encoded": {
				item.contentEncoded = getElementText(child);
				break;
			}
			case "atom:link": {
				atomLinks.push(parseAtomLink(child));
				break;
			}
			case "dc:creator": {
				dcCreators.push(getElementText(child));
				break;
			}
			case "slash:comments": {
				item.slashComments = parseOptionalNumber(getElementText(child));
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (!item.title && !item.description) {
		return failure(new Error("Item must include at least a title or description."));
	}

	if (categories.length > 0) item.category = collapseArray(categories);
	if (atomLinks.length > 0) item.atomLink = collapseArray(atomLinks) as RSS.AtomLinkInput;
	if (dcCreators.length > 0) item.dcCreator = collapseArray(dcCreators) as string | string[];
	if (enclosures.length > 0) item.enclosure = collapseArray(enclosures) as RSS.EnclosureInput;
	if (extensions.length > 0) item.extensions = extensions;
	if (isEmptyRecord(item.attributes)) delete item.attributes;

	return success(item as RSS.Item);
}

/**
 * Parses one category and keeps extra namespaced data attached to it.
 *
 * @param element - The category element
 * @returns The parsed category
 */
function parseCategory(element: XML.Element): RSS.CategoryInput {
	let attributes = cloneAttributes(element.attributes) ?? {};
	let domain = attributes.domain;
	delete attributes.domain;

	let extensions = getChildElements(element).map(toExtensionElement);
	let value = getElementText(element);

	if (!domain && isEmptyRecord(attributes) && extensions.length === 0) return value;

	let category: RSS.Category = { value };
	if (domain) category.domain = domain;
	if (!isEmptyRecord(attributes)) category.attributes = attributes;
	if (extensions.length > 0) category.extensions = extensions;
	return category;
}

/**
 * Parses the rssCloud empty element and keeps any extra namespaced data.
 *
 * @param element - The cloud element
 * @returns The parsed cloud
 */
function parseCloud(element: XML.Element): RSS.Cloud {
	let attributes = cloneAttributes(element.attributes) ?? {};
	let cloud: RSS.Cloud = {
		domain: attributes.domain ?? "",
		path: attributes.path ?? "",
		port: Number(attributes.port ?? 0),
		protocol: attributes.protocol ?? "",
		registerProcedure: attributes.registerProcedure ?? "",
	};

	delete attributes.domain;
	delete attributes.path;
	delete attributes.port;
	delete attributes.protocol;
	delete attributes.registerProcedure;

	let extensions = getChildElements(element).map(toExtensionElement);
	if (!isEmptyRecord(attributes)) cloud.attributes = attributes;
	if (extensions.length > 0) cloud.extensions = extensions;
	return cloud;
}

/**
 * Parses a channel image and validates its required fields.
 *
 * @param element - The image element
 * @returns The parsed image
 */
function parseImage(element: XML.Element): Result<RSS.Image, Error> {
	let image: Partial<RSS.Image> = { attributes: cloneAttributes(element.attributes) };
	let extensions: RSS.Element[] = [];

	for (let child of getChildElements(element)) {
		switch (child.name) {
			case "url": {
				image.url = getElementText(child);
				break;
			}
			case "title": {
				image.title = getElementText(child);
				break;
			}
			case "link": {
				image.link = getElementText(child);
				break;
			}
			case "description": {
				image.description = getElementText(child);
				break;
			}
			case "width": {
				image.width = parseOptionalNumber(getElementText(child));
				break;
			}
			case "height": {
				image.height = parseOptionalNumber(getElementText(child));
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (!image.url || !image.title || !image.link) {
		return failure(new Error("Image must include url, title, and link."));
	}

	if (extensions.length > 0) image.extensions = extensions;
	if (isEmptyRecord(image.attributes)) delete image.attributes;
	return success(image as RSS.Image);
}

/**
 * Parses a channel textInput and validates its required fields.
 *
 * @param element - The textInput element
 * @returns The parsed textInput
 */
function parseTextInput(element: XML.Element): Result<RSS.TextInput, Error> {
	let textInput: Partial<RSS.TextInput> = { attributes: cloneAttributes(element.attributes) };
	let extensions: RSS.Element[] = [];

	for (let child of getChildElements(element)) {
		switch (child.name) {
			case "title": {
				textInput.title = getElementText(child);
				break;
			}
			case "description": {
				textInput.description = getElementText(child);
				break;
			}
			case "name": {
				textInput.name = getElementText(child);
				break;
			}
			case "link": {
				textInput.link = getElementText(child);
				break;
			}
			default: {
				extensions.push(toExtensionElement(child));
			}
		}
	}

	if (!textInput.title || !textInput.description || !textInput.name || !textInput.link) {
		return failure(new Error("textInput must include title, description, name, and link."));
	}

	if (extensions.length > 0) textInput.extensions = extensions;
	if (isEmptyRecord(textInput.attributes)) delete textInput.attributes;
	return success(textInput as RSS.TextInput);
}

/**
 * Parses an item enclosure and keeps any extra namespaced data.
 *
 * @param element - The enclosure element
 * @returns The parsed enclosure
 */
function parseEnclosure(element: XML.Element): RSS.Enclosure {
	let attributes = cloneAttributes(element.attributes) ?? {};
	let enclosure: RSS.Enclosure = {
		url: attributes.url ?? "",
		length: Number(attributes.length ?? 0),
		type: attributes.type ?? "",
	};

	delete attributes.url;
	delete attributes.length;
	delete attributes.type;

	let extensions = getChildElements(element).map(toExtensionElement);
	if (!isEmptyRecord(attributes)) enclosure.attributes = attributes;
	if (extensions.length > 0) enclosure.extensions = extensions;
	return enclosure;
}

/**
 * Parses a guid and keeps it as a string when it has no structured metadata.
 *
 * @param element - The guid element
 * @returns The parsed guid
 */
function parseGuid(element: XML.Element): RSS.GuidInput {
	let attributes = cloneAttributes(element.attributes) ?? {};
	let isPermaLink = attributes.isPermaLink;
	delete attributes.isPermaLink;

	let extensions = getChildElements(element).map(toExtensionElement);
	let value = getElementText(element);

	if (isPermaLink === undefined && isEmptyRecord(attributes) && extensions.length === 0)
		return value;

	let guid: RSS.Guid = { value };
	if (isPermaLink === "true") guid.isPermaLink = true;
	if (isPermaLink === "false") guid.isPermaLink = false;
	if (!isEmptyRecord(attributes)) guid.attributes = attributes;
	if (extensions.length > 0) guid.extensions = extensions;
	return guid;
}

/**
 * Parses an RSS source element and keeps any extra namespaced data.
 *
 * @param element - The source element
 * @returns The parsed source
 */
function parseSource(element: XML.Element): RSS.Source {
	let attributes = cloneAttributes(element.attributes) ?? {};
	let url = attributes.url ?? "";
	delete attributes.url;

	let source: RSS.Source = {
		value: getElementText(element),
		url,
	};

	let extensions = getChildElements(element).map(toExtensionElement);
	if (!isEmptyRecord(attributes)) source.attributes = attributes;
	if (extensions.length > 0) source.extensions = extensions;
	return source;
}

/**
 * Parses an Atom link extension and keeps any extra namespaced data.
 *
 * @param element - The atom:link element
 * @returns The parsed Atom link
 */
function parseAtomLink(element: XML.Element): RSS.AtomLink {
	let attributes = cloneAttributes(element.attributes) ?? {};
	let atomLink: RSS.AtomLink = {
		href: attributes.href ?? "",
	};

	if (attributes.rel) atomLink.rel = attributes.rel;
	if (attributes.type) atomLink.type = attributes.type;
	if (attributes.hreflang) atomLink.hreflang = attributes.hreflang;
	if (attributes.title) atomLink.title = attributes.title;
	if (attributes.length) atomLink.length = Number(attributes.length);

	delete attributes.href;
	delete attributes.rel;
	delete attributes.type;
	delete attributes.hreflang;
	delete attributes.title;
	delete attributes.length;

	let extensions = getChildElements(element).map(toExtensionElement);
	if (!isEmptyRecord(attributes)) atomLink.attributes = attributes;
	if (extensions.length > 0) atomLink.extensions = extensions;
	return atomLink;
}

/**
 * Parses skipHours into numeric values while ignoring non-numeric entries.
 *
 * @param element - The skipHours element
 * @returns The parsed hour values
 */
function parseSkipHours(element: XML.Element): number[] {
	let hours: number[] = [];
	for (let child of getChildElements(element)) {
		if (child.name !== "hour") continue;
		let value = parseOptionalNumber(getElementText(child));
		if (Number.isNaN(value)) continue;
		hours.push(value);
	}
	return hours;
}

/**
 * Parses skipDays into string values.
 *
 * @param element - The skipDays element
 * @returns The parsed day values
 */
function parseSkipDays(element: XML.Element): string[] {
	let days: string[] = [];
	for (let child of getChildElements(element)) {
		if (child.name !== "day") continue;
		days.push(getElementText(child));
	}
	return days;
}

/**
 * Reads all `xmlns` declarations from the rss root element.
 *
 * @param attributes - The rss attributes to inspect
 * @returns The parsed namespace declarations
 */
function parseNamespaces(attributes: Record<string, string>): Record<string, string> | undefined {
	let namespaces: Record<string, string> = {};

	for (let [name, value] of Object.entries(attributes)) {
		if (name === "xmlns") namespaces[""] = value;
		if (name.startsWith("xmlns:")) namespaces[name.slice(6)] = value;
	}

	if (isEmptyRecord(namespaces)) return undefined;
	return namespaces;
}
