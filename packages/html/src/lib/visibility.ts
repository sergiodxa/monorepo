/**
 * The markup-level visibility rules: `hidden`, `aria-hidden`, a `<template>` and an
 * inline `display`/`visibility` declaration hide an element. Every answer comes from
 * the markup, so a class that hides an element leaves it visible here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMElement, DOMStyle } from "./dom.js";

/** Elements a browser keeps out of the render tree, whatever the styles say. */
const NON_RENDERED_TAGS = new Set([
	"base",
	"head",
	"link",
	"meta",
	"noscript",
	"script",
	"style",
	"template",
	"title",
]);

/** Recognizes a tag whose contents stay out of every query and every text read. */
export function isNonRendered(tag: string): boolean {
	return NON_RENDERED_TAGS.has(tag);
}

/**
 * Reports whether the markup hides an element, itself or through an ancestor. An
 * `<input type="hidden">` counts, since it renders nothing regardless of styles.
 */
export function isHidden(element: DOMElement): boolean {
	if (element.localName.toLowerCase() === "input") {
		if (element.getAttribute("type")?.toLowerCase() === "hidden") return true;
	}

	for (let node: DOMElement | null = element; node; node = node.parentElement) {
		if (node.hasAttribute("hidden")) return true;
		if (node.getAttribute("aria-hidden") === "true") return true;
		if (isNonRendered(node.localName.toLowerCase())) return true;
		if (hiddenByStyle(node)) return true;
	}

	return false;
}

/**
 * Reads an element's inline `style` attribute as a computed style, which is the
 * only style source the package has and what accessible-name computation consults
 * when it decides a subtree is hidden.
 */
export function inlineStyle(element: DOMElement): DOMStyle {
	let declarations = parseStyle(element.getAttribute("style"));

	return {
		getPropertyValue(property: string) {
			return declarations.get(property) ?? "";
		},
	};
}

/** Applies the two inline declarations that take an element out of the render tree. */
function hiddenByStyle(element: DOMElement): boolean {
	let declarations = parseStyle(element.getAttribute("style"));
	if (declarations.get("display") === "none") return true;
	let visibility = declarations.get("visibility");
	return visibility === "hidden" || visibility === "collapse";
}

/**
 * Splits an inline `style` attribute into lowercased property/value pairs, dropping
 * an `!important` suffix so a declaration reads the same with or without it.
 */
function parseStyle(style: string | null): Map<string, string> {
	let declarations = new Map<string, string>();
	if (!style) return declarations;

	for (let declaration of style.split(";")) {
		let separator = declaration.indexOf(":");
		if (separator === -1) continue;
		let property = declaration.slice(0, separator).trim().toLowerCase();
		let value = declaration
			.slice(separator + 1)
			.replace(/!\s*important\s*$/iu, "")
			.trim()
			.toLowerCase();
		if (property) declarations.set(property, value);
	}

	return declarations;
}
