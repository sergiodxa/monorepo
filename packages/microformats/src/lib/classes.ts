/**
 * Reads what an element's class names make it: the root of an item (mf2 or classic),
 * and the properties it holds for the item around it, which is where microformats2 and
 * the classic vocabularies differ and where the rest of the parser stops caring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMElement } from "@sdxc/html/document";

import type { ClassicProperty, PropertyKind } from "./backcompat.js";

import { CLASSIC_ROOTS, CLASSIC_VOCABULARIES } from "./backcompat.js";
import { classTokens, tagName } from "./tree.js";

/** `h-` then an optional vendor prefix, then lowercase words joined by hyphens. */
const ROOT_PATTERN = /^h-(?:[0-9a-z]+-)?[a-z]+(?:-[a-z]+)*$/u;

/** A property class: its kind prefix, then a name shaped like a root's. */
const PROPERTY_PATTERN = /^(p|u|dt|e)-((?:[0-9a-z]+-)?[a-z]+(?:-[a-z]+)*)$/u;

/**
 * What starts an item on an element: its sorted, unique types, and the classic
 * vocabularies its properties are read through (`null` for a microformats2 root).
 */
export interface Root {
	types: string[];
	vocabularies: string[] | null;
}

/** A property an element holds, and the value a `rel` mapping fixes for it. */
export interface Property extends ClassicProperty {
	value?: string;
}

/**
 * The root an element starts, if any. Microformats2 roots win over classic ones on the
 * same element; a classic property that implies a nested item supplies the vocabulary
 * when the element names no root of its own.
 *
 * @param backcompat - Whether classic roots count at all
 * @param implied - The classic vocabulary a property mapping says this element is
 */
export function rootOf(element: DOMElement, backcompat: boolean, implied?: string): Root | null {
	let tokens = classTokens(element);
	let types = unique(tokens.filter((token) => ROOT_PATTERN.test(token)));
	if (types.length > 0) return { types: types.sort(), vocabularies: null };
	if (!backcompat) return null;

	let vocabularies = unique(tokens.filter((token) => CLASSIC_ROOTS.has(token)));
	if (vocabularies.length === 0 && implied !== undefined) vocabularies = [implied];
	if (vocabularies.length === 0) return null;
	let classicTypes = vocabularies.flatMap((name) => {
		let vocabulary = CLASSIC_VOCABULARIES[name];
		return vocabulary ? [vocabulary.type] : [];
	});
	return { types: unique(classicTypes).sort(), vocabularies };
}

/** Whether an element carries any microformats2 root or property class. */
export function hasMicroformatClass(element: DOMElement): boolean {
	return classTokens(element).some((token) => {
		return ROOT_PATTERN.test(token) || PROPERTY_PATTERN.test(token) || CLASSIC_ROOTS.has(token);
	});
}

/**
 * The properties an element holds for the item `parent` starts. Inside a microformats2
 * root only prefixed classes count, each token as written (`p-a p-a` holds `a` twice);
 * inside a classic root that vocabulary's class names and `rel` values do, each once.
 */
export function propertiesOf(element: DOMElement, parent: Root): Property[] {
	let found: Property[] = [];
	let seen = new Set<string>();
	let add = (property: Property) => {
		let key = `${property.kind}-${property.name}`;
		if (seen.has(key)) return;
		seen.add(key);
		found.push(property);
	};

	let tokens = classTokens(element);
	if (parent.vocabularies === null) {
		for (let token of tokens) {
			let match = PROPERTY_PATTERN.exec(token);
			if (match) found.push({ kind: match[1] as PropertyKind, name: match[2] ?? "" });
		}
		return found;
	}

	for (let name of parent.vocabularies) {
		let vocabulary = CLASSIC_VOCABULARIES[name];
		if (!vocabulary) continue;
		for (let token of tokens) {
			if (!Object.hasOwn(vocabulary.properties, token)) continue;
			for (let property of vocabulary.properties[token] ?? []) add(property);
		}
		for (let property of relProperties(element, vocabulary.rels ?? {})) add(property);
	}
	return found;
}

/**
 * The properties a link's `rel` values stand for. `rel=tag` becomes a category named by
 * the last path segment of its URL, which is how a classic tag link names its tag.
 */
function relProperties(element: DOMElement, rels: Record<string, ClassicProperty>): Property[] {
	if (!["a", "area", "link"].includes(tagName(element))) return [];
	let tokens = (element.getAttribute("rel") ?? "").split(/\s+/u).filter(Boolean);
	if (tokens.length === 0) return [];

	let properties: Property[] = [];
	for (let [key, property] of Object.entries(rels)) {
		if (!key.split(" ").every((rel) => tokens.includes(rel))) continue;
		if (key !== "tag") {
			properties.push(property);
			continue;
		}
		let segment = tagSegment(element.getAttribute("href") ?? "");
		if (segment !== null) properties.push({ ...property, value: segment });
	}
	return properties;
}

/** The decoded last non-empty path segment of a tag URL. */
function tagSegment(href: string): string | null {
	let path = href.split(/[?#]/u)[0] ?? "";
	let segments = path.split("/").filter((segment) => segment.length > 0);
	let last = segments.at(-1);
	if (last === undefined) return null;
	try {
		return decodeURIComponent(last);
	} catch {
		return last;
	}
}

/** The distinct values, first occurrence kept. */
function unique(values: string[]): string[] {
	return [...new Set(values)];
}
