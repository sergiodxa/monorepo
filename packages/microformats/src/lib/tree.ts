/**
 * The handful of tree reads the parser makes, over the DOM vocabulary the HTML package
 * publishes: element children with `<template>` removed, class tokens, and attributes
 * read only on the elements a parsing rule names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMElement } from "@sdxc/html/document";

/** Node types a text read tells apart. */
export const ELEMENT_NODE = 1;

export const TEXT_NODE = 3;

/** The characters HTML calls spaces, which is what the parsing rules trim. */
const HTML_SPACES = /[ \t\n\f\r]+/u;

/**
 * An element's children, minus `<template>`, whose content HTML parsing keeps out of
 * the document a browser builds.
 */
export function childElements(element: DOMElement): DOMElement[] {
	let children: DOMElement[] = [];
	for (let child of Array.from(element.children)) {
		if (tagName(child) !== "template") children.push(child);
	}
	return children;
}

/** The lowercase tag name, which is how every rule names an element. */
export function tagName(element: DOMElement): string {
	return element.localName.toLowerCase();
}

/** The element's class attribute as tokens, in document order, duplicates included. */
export function classTokens(element: DOMElement): string[] {
	let value = element.getAttribute("class");
	if (!value) return [];
	return value.split(HTML_SPACES).filter((token) => token.length > 0);
}

/**
 * Reads an attribute only when the element is one of `tags`, which is how every
 * precedence rule in the parsing specification is written (`abbr[title]`, `data[value]`).
 *
 * @returns The attribute value, or `null` for another element or an absent attribute
 */
export function attributeOf(
	element: DOMElement,
	name: string,
	tags: readonly string[],
): string | null {
	if (!tags.includes(tagName(element))) return null;
	return element.getAttribute(name);
}

/** Removes leading and trailing HTML spaces, leaving non-breaking spaces as authored. */
export function trimSpaces(value: string): string {
	return value.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/gu, "");
}
