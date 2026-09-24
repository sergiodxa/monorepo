/**
 * The microformats2 parsing algorithm over a parsed tree: find roots depth-first, read
 * each item's properties through the four value parsers, nest items that are also
 * properties, imply `name`, `photo` and `url`, and collect every `rel` on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMDocument, DOMElement } from "@sdxc/html/document";

import type { MF2 } from "../index.js";

import type { PropertyKind } from "./backcompat.js";
import type { Property, Root } from "./classes.js";
import type { DateTimeValue } from "./date-time.js";

import { hasMicroformatClass, propertiesOf, rootOf } from "./classes.js";
import { assembleDateTime, readDateTime } from "./date-time.js";
import { collectRels } from "./rels.js";
import { innerHTML } from "./serialize.js";
import { textOf } from "./text.js";
import { attributeOf, childElements, classTokens, tagName, trimSpaces } from "./tree.js";
import { documentBase, resolveUrl } from "./url.js";

/** What every step of one parse reads: the resolved base URL and the backcompat switch. */
interface Context {
	base: string;
	backcompat: boolean;
}

/**
 * The item being filled while its subtree is walked: the property kinds seen (and `h`
 * for any nested root), which decide what is implied, the date later time-only `dt-*`
 * values borrow, and the first `p-name` and `u-url`, the values a nested item carries.
 */
interface ItemState {
	item: MF2.Item;
	children: MF2.Item[];
	seen: Set<PropertyKind | "h">;
	impliedDate: string | null;
	name?: MF2.PropertyValue;
	url?: MF2.PropertyValue;
}

/**
 * Parses a whole document.
 *
 * @param document - The tree `@sdxc/html/document` built
 * @param baseUrl - The URL the page was read from, which `<base href>` refines
 * @param options - Whether classic roots are read
 */
export function parseTree(
	document: DOMDocument,
	baseUrl: string | URL,
	options: MF2.ParseOptions = {},
): MF2.Document {
	let context: Context = {
		base: documentBase(document, baseUrl),
		backcompat: options.backcompat ?? true,
	};
	let items: MF2.Item[] = [];
	let root = document.querySelector("html") ?? document.body;
	findItems(root, context, items);
	let { rels, relUrls } = collectRels(document, context.base);
	return { items, rels, relUrls };
}

/** Walks elements depth-first, parsing each root found and not descending past it. */
function findItems(element: DOMElement, context: Context, items: MF2.Item[]): void {
	let root = rootOf(element, context.backcompat);
	if (root) {
		items.push(parseItem(element, root, context).item);
		return;
	}
	for (let child of childElements(element)) findItems(child, context, items);
}

/**
 * Parses one root element into an item, implying properties for microformats2 roots
 * only, and returns it with the state its parent reads a nested value from.
 */
function parseItem(element: DOMElement, root: Root, context: Context): ItemState {
	let item: MF2.Item = { type: root.types, properties: {} };
	let state: ItemState = { item, children: [], seen: new Set(), impliedDate: null };
	for (let child of childElements(element)) walkProperties(child, root, state, context);

	if (root.vocabularies === null) implyProperties(element, state, context);
	if (state.children.length > 0) item.children = state.children;
	let id = element.getAttribute("id");
	if (id) item.id = id;
	let lang = languageOf(element);
	if (lang !== null) item.lang = lang;
	return state;
}

/**
 * Reads one descendant of an item: its properties, the nested item it starts, or the
 * child item it is, then its own descendants unless it started an item of its own.
 */
function walkProperties(
	element: DOMElement,
	parent: Root,
	state: ItemState,
	context: Context,
): void {
	let properties = propertiesOf(element, parent);
	let implied = properties.find((property) => property.nested !== undefined)?.nested;
	let root = rootOf(element, context.backcompat, properties.length > 0 ? implied : undefined);
	if (root) state.seen.add("h");

	if (properties.length > 0) {
		let nested = root ? parseItem(element, root, context) : null;
		let parsed = new Map<PropertyKind, MF2.PropertyValue>();
		for (let property of properties) {
			state.seen.add(property.kind);
			let value = property.value ?? parsed.get(property.kind);
			if (value === undefined) {
				value = parseValue(element, property.kind, state, context, [parent, root]);
				parsed.set(property.kind, value);
			}
			let values = (state.item.properties[property.name] ??= []);
			values.push(nested ? nestedValue(nested, property, value) : value);
			if (property.kind === "p" && property.name === "name") state.name ??= value;
			if (property.kind === "u" && property.name === "url") state.url ??= value;
		}
	} else if (root) {
		state.children.push(parseItem(element, root, context).item);
	}

	if (root) return;
	for (let child of childElements(element)) walkProperties(child, parent, state, context);
}

/**
 * The value a nested item carries for the property it sits in: its first `p-name` for
 * `p-*`, its first `u-url` for `u-*` (a `name` or `url` written with another prefix does
 * not count), and the markup and text for `e-*`, else what the element parses to.
 */
function nestedValue(
	nested: ItemState,
	property: Property,
	parsed: MF2.PropertyValue,
): MF2.NestedItem {
	if (property.kind === "e" && typeof parsed === "object" && "html" in parsed) {
		return { ...nested.item, ...parsed };
	}
	let own = property.kind === "p" ? nested.name : property.kind === "u" ? nested.url : undefined;
	let value = asValue(own) ?? asValue(parsed) ?? "";
	return { ...nested.item, value };
}

/** A property value usable as a nested item's `value`: a string or an image URL. */
function asValue(value: MF2.PropertyValue | undefined): string | MF2.Url | null {
	if (value === undefined) return null;
	if (typeof value === "string") return value;
	if ("type" in value || "html" in value)
		return typeof value.value === "string" ? value.value : null;
	return value;
}

/**
 * Dispatches to the parser for a property kind. A classic property reads an image as
 * its URL alone, as classic vocabularies had no notion of alternative text.
 *
 * @param scopes - The item the property belongs to and the one the element starts, whose properties bound the value-class pattern
 */
function parseValue(
	element: DOMElement,
	kind: PropertyKind,
	state: ItemState,
	context: Context,
	scopes: (Root | null)[],
): MF2.PropertyValue {
	let [parent] = scopes;
	let values = valueElements(element, scopes, context);
	if (kind === "p") return parseText(element, values, context);
	if (kind === "u") {
		let url = parseUrl(element, values, context);
		return parent?.vocabularies && typeof url === "object" ? url.value : url;
	}
	if (kind === "e") return parseEmbedded(element, context);
	let parsed = parseDateTime(element, values, state.impliedDate);
	if (parsed.date !== null) state.impliedDate = parsed.date;
	return parsed.value;
}

/** A `p-*` value, by the specification's element precedence. */
function parseText(element: DOMElement, values: DOMElement[], context: Context): string {
	return (
		valueClassText(values) ??
		attributeOf(element, "title", ["abbr", "link"]) ??
		attributeOf(element, "value", ["data", "input"]) ??
		attributeOf(element, "alt", ["img", "area"]) ??
		textOf(element, "alt-or-src", context.base)
	);
}

/** A `u-*` value, resolved: an image with `alt` keeps its alternative text beside the URL. */
function parseUrl(element: DOMElement, values: DOMElement[], context: Context): string | MF2.Url {
	let href = attributeOf(element, "href", ["a", "area", "link"]);
	if (href !== null) return resolveUrl(href, context.base);
	let image = imageValue(element, context);
	if (image !== null) return image;
	let raw =
		attributeOf(element, "src", ["audio", "video", "source", "iframe"]) ??
		attributeOf(element, "poster", ["video"]) ??
		attributeOf(element, "data", ["object"]) ??
		valueClassText(values) ??
		attributeOf(element, "title", ["abbr"]) ??
		attributeOf(element, "value", ["data", "input"]) ??
		textOf(element, "none", context.base);
	return resolveUrl(raw, context.base);
}

/** A `dt-*` value, from the value-class pattern first and the element's own data after. */
function parseDateTime(
	element: DOMElement,
	values: DOMElement[],
	impliedDate: string | null,
): DateTimeValue {
	let parts = values.map(dateTimePart);
	if (parts.length > 0) {
		let assembled = assembleDateTime(parts, impliedDate);
		if (assembled !== null) return assembled;
	}
	let raw =
		attributeOf(element, "datetime", ["time", "ins", "del"]) ??
		attributeOf(element, "title", ["abbr"]) ??
		attributeOf(element, "value", ["data", "input"]) ??
		textOf(element, "none", "");
	return readDateTime(raw, impliedDate);
}

/** An `e-*` value: the markup as authored with URLs resolved, and its text. */
function parseEmbedded(element: DOMElement, context: Context): MF2.Embedded {
	let embedded: MF2.Embedded = {
		html: innerHTML(element, context.base),
		value: textOf(element, "alt-or-src", context.base),
	};
	let lang = languageOf(element);
	if (lang !== null) embedded.lang = lang;
	return embedded;
}

/** `img[src]` as a URL, or as `{ value, alt }` when the image carries an `alt`. */
function imageValue(element: DOMElement, context: Context): string | MF2.Url | null {
	let src = attributeOf(element, "src", ["img"]);
	if (src === null) return null;
	let value = resolveUrl(src, context.base);
	let alt = element.getAttribute("alt");
	return alt === null ? value : { value, alt };
}

/**
 * The value elements of a property: descendants classed `value` or `value-title`,
 * neither searched inside nor searched past another item or another property of the
 * items in `scopes`.
 */
function valueElements(
	element: DOMElement,
	scopes: (Root | null)[],
	context: Context,
): DOMElement[] {
	let found: DOMElement[] = [];
	let visit = (parent: DOMElement) => {
		for (let child of childElements(parent)) {
			let tokens = classTokens(child);
			if (tokens.includes("value") || tokens.includes("value-title")) {
				found.push(child);
				continue;
			}
			if (hasMicroformatClass(child) || rootOf(child, context.backcompat) !== null) continue;
			if (scopes.some((scope) => scope !== null && propertiesOf(child, scope).length > 0)) continue;
			visit(child);
		}
	};
	visit(element);
	return found;
}

/** The value-class pattern for a text or URL property: the parts, concatenated. */
function valueClassText(parts: DOMElement[]): string | null {
	if (parts.length === 0) return null;
	return parts
		.map((part) => {
			if (classTokens(part).includes("value-title")) return part.getAttribute("title") ?? "";
			return (
				attributeOf(part, "alt", ["img", "area"]) ??
				attributeOf(part, "value", ["data"]) ??
				attributeOf(part, "title", ["abbr"]) ??
				part.textContent ??
				""
			);
		})
		.join("");
}

/** One value element of a `dt-*` property, trimmed. */
function dateTimePart(part: DOMElement): string {
	if (classTokens(part).includes("value-title"))
		return trimSpaces(part.getAttribute("title") ?? "");
	let value =
		attributeOf(part, "alt", ["img", "area"]) ??
		attributeOf(part, "value", ["data"]) ??
		attributeOf(part, "title", ["abbr"]) ??
		attributeOf(part, "datetime", ["del", "ins", "time"]) ??
		part.textContent ??
		"";
	return trimSpaces(value);
}

/** Adds the implied `name`, `photo` and `url` a microformats2 root is owed. */
function implyProperties(element: DOMElement, state: ItemState, context: Context): void {
	let { properties } = state.item;
	let { seen } = state;
	let blocksName = seen.has("p") || seen.has("e") || seen.has("h");
	let blocksUrl = seen.has("u") || seen.has("h");

	if (!properties.name && !blocksName) {
		state.name = impliedName(element, context);
		properties.name = [state.name];
	}
	if (!properties.photo && !blocksUrl) {
		let photo = impliedPhoto(element, context);
		if (photo !== null) properties.photo = [photo];
	}
	if (!properties.url && !blocksUrl) {
		let url = impliedUrl(element, context);
		if (url !== null) {
			state.url = url;
			properties.url = [url];
		}
	}
}

/** Whether an element is itself a microformats2 root, which the implied rules skip. */
function isRoot(element: DOMElement): boolean {
	return rootOf(element, false) !== null;
}

/**
 * The implied name: the root's own `alt` or `title` even when empty, then a non-empty
 * one on the only child or grandchild, then the root's text.
 */
function impliedName(element: DOMElement, context: Context): string {
	let own = nameAttribute(element);
	if (own !== null) return own;

	let children = childElements(element);
	let [child] = children;
	if (children.length === 1 && child && !isRoot(child)) {
		let candidate: DOMElement | undefined = child;
		if (!["img", "area", "abbr"].includes(tagName(child))) {
			let grandchildren = childElements(child);
			candidate = grandchildren.length === 1 ? grandchildren[0] : undefined;
			if (candidate && isRoot(candidate)) candidate = undefined;
		}
		let value = candidate ? nameAttribute(candidate) : null;
		if (value !== null && value !== "") return value;
	}
	return textOf(element, "alt", context.base);
}

/** An `img` or `area`'s `alt`, or an `abbr`'s `title`, trimmed. */
function nameAttribute(element: DOMElement): string | null {
	let value =
		attributeOf(element, "alt", ["img", "area"]) ?? attributeOf(element, "title", ["abbr"]);
	return value === null ? null : trimSpaces(value);
}

/** The implied photo: the root's own image or object, or the only one a level or two down. */
function impliedPhoto(element: DOMElement, context: Context): string | MF2.Url | null {
	let own = photoOf(element, context);
	if (own !== null) return own;

	let children = childElements(element);
	let candidate = onlyOfType(children, "img") ?? onlyOfType(children, "object");
	let [child] = children;
	if (!candidate && children.length === 1 && child && !isRoot(child)) {
		let grandchildren = childElements(child);
		candidate = onlyOfType(grandchildren, "img") ?? onlyOfType(grandchildren, "object");
	}
	return candidate ? photoOf(candidate, context) : null;
}

/** An `img[src]` as an image value, or an `object[data]` as a URL. */
function photoOf(element: DOMElement, context: Context): string | MF2.Url | null {
	let image = imageValue(element, context);
	if (image !== null) return image;
	let data = attributeOf(element, "data", ["object"]);
	return data === null ? null : resolveUrl(data, context.base);
}

/** The implied URL: the root's own link, or the only one a level or two down. */
function impliedUrl(element: DOMElement, context: Context): string | null {
	let own = attributeOf(element, "href", ["a", "area"]);
	if (own !== null) return resolveUrl(own, context.base);

	let children = childElements(element);
	let candidate = onlyOfType(children, "a") ?? onlyOfType(children, "area");
	let [child] = children;
	if (!candidate && children.length === 1 && child && !isRoot(child)) {
		let grandchildren = childElements(child);
		candidate = onlyOfType(grandchildren, "a") ?? onlyOfType(grandchildren, "area");
	}
	let href = candidate ? attributeOf(candidate, "href", ["a", "area"]) : null;
	return href === null ? null : resolveUrl(href, context.base);
}

/** The single sibling with a tag, when exactly one has it and it is not a root. */
function onlyOfType(siblings: DOMElement[], tag: string): DOMElement | null {
	let matches = siblings.filter((sibling) => tagName(sibling) === tag);
	let [match] = matches;
	if (matches.length !== 1 || !match || isRoot(match)) return null;
	return match;
}

/** The language in scope: the nearest `lang` on the element or an ancestor. */
function languageOf(element: DOMElement): string | null {
	let scope = element.closest("[lang]");
	let lang = scope?.getAttribute("lang");
	return lang ? lang : null;
}
