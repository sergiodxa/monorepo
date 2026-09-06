/**
 * Deep-clone helpers for feed, entry, and extension element data, so the class
 * hands out copies and a caller cannot reach its internals through a return value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Atom } from "../index.js";

/**
 * Clones an attribute record, reporting an absent or empty one as `undefined` so
 * a document that declared nothing does not grow an empty object.
 *
 * @param attributes - The attributes to clone
 * @returns The cloned attributes, or `undefined`
 */
export function cloneAttributes(
	attributes?: Record<string, string>,
): Record<string, string> | undefined {
	if (!attributes) return undefined;
	if (Object.keys(attributes).length === 0) return undefined;
	return { ...attributes };
}

/** Clones a list of extension elements, or reports `undefined` for none. */
export function cloneExtensionElements(elements?: Atom.Element[]): Atom.Element[] | undefined {
	if (!elements) return undefined;
	return elements.map(cloneExtensionElement);
}

/** Clones one extension element and everything beneath it. */
function cloneExtensionElement(element: Atom.Element): Atom.Element {
	let children = element.children?.map((child) =>
		typeof child === "string" ? child : cloneExtensionElement(child),
	);

	return { name: element.name, attributes: cloneAttributes(element.attributes), children };
}

/** Clones a text construct, which is immutable in its string form. */
export function cloneTextInput(text?: Atom.TextInput): Atom.TextInput | undefined {
	if (text === undefined) return undefined;
	if (typeof text === "string") return text;
	return { ...text };
}

/** Clones one person construct. */
function clonePerson(person: Atom.Person): Atom.Person {
	return { ...person, extensions: cloneExtensionElements(person.extensions) };
}

/** Clones one person or a list of them, preserving which form was used. */
export function clonePersonInput(person?: Atom.PersonInput): Atom.PersonInput | undefined {
	if (person === undefined) return undefined;
	if (Array.isArray(person)) return person.map(clonePerson);
	return clonePerson(person);
}

/** Clones one link. */
function cloneLink(link: Atom.Link): Atom.Link {
	return {
		...link,
		attributes: cloneAttributes(link.attributes),
		extensions: cloneExtensionElements(link.extensions),
	};
}

/** Clones one link or a list of them, preserving which form was used. */
export function cloneLinkInput(link?: Atom.LinkInput): Atom.LinkInput | undefined {
	if (link === undefined) return undefined;
	if (Array.isArray(link)) return link.map(cloneLink);
	return cloneLink(link);
}

/** Clones one category, which stays a bare string when it carried nothing else. */
function cloneCategory(category: Atom.CategoryInput): Atom.CategoryInput {
	if (typeof category === "string") return category;
	return {
		...category,
		attributes: cloneAttributes(category.attributes),
		extensions: cloneExtensionElements(category.extensions),
	};
}

/** Clones one category or a list of them, preserving which form was used. */
export function cloneCategoryInput(
	category?: Atom.CategoryInput | Atom.CategoryInput[],
): Atom.CategoryInput | Atom.CategoryInput[] | undefined {
	if (category === undefined) return undefined;
	if (Array.isArray(category)) return category.map(cloneCategory);
	return cloneCategory(category);
}

/** Clones the source feed metadata an entry was copied with. */
function cloneSource(source: Atom.Source): Atom.Source {
	return {
		...source,
		title: cloneTextInput(source.title),
		subtitle: cloneTextInput(source.subtitle),
		rights: cloneTextInput(source.rights),
		author: clonePersonInput(source.author),
		link: cloneLinkInput(source.link),
		attributes: cloneAttributes(source.attributes),
		extensions: cloneExtensionElements(source.extensions),
	};
}

/**
 * Clones feed-level metadata deeply enough that nothing reachable from the copy
 * is shared with the original.
 *
 * @param feed - The feed to clone
 * @returns The cloned feed
 */
export function cloneFeed(feed: Atom.Feed): Atom.Feed {
	return {
		...feed,
		title: cloneTextInput(feed.title) as Atom.TextInput,
		subtitle: cloneTextInput(feed.subtitle),
		rights: cloneTextInput(feed.rights),
		author: clonePersonInput(feed.author),
		contributor: clonePersonInput(feed.contributor),
		link: cloneLinkInput(feed.link),
		category: cloneCategoryInput(feed.category),
		generator: feed.generator ? { ...feed.generator } : undefined,
		namespaces: cloneAttributes(feed.namespaces),
		attributes: cloneAttributes(feed.attributes),
		extensions: cloneExtensionElements(feed.extensions),
	};
}

/**
 * Clones one entry deeply enough that nothing reachable from the copy is shared
 * with the original.
 *
 * @param entry - The entry to clone
 * @returns The cloned entry
 */
export function cloneEntry(entry: Atom.Entry): Atom.Entry {
	return {
		...entry,
		title: cloneTextInput(entry.title) as Atom.TextInput,
		summary: cloneTextInput(entry.summary),
		rights: cloneTextInput(entry.rights),
		content: entry.content
			? { ...entry.content, attributes: cloneAttributes(entry.content.attributes) }
			: undefined,
		author: clonePersonInput(entry.author),
		contributor: clonePersonInput(entry.contributor),
		link: cloneLinkInput(entry.link),
		category: cloneCategoryInput(entry.category),
		source: entry.source ? cloneSource(entry.source) : undefined,
		attributes: cloneAttributes(entry.attributes),
		extensions: cloneExtensionElements(entry.extensions),
	};
}
