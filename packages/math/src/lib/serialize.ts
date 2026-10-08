/**
 * Writes a MathML tree as markup. Every element is written with an explicit
 * closing tag, which both an HTML parser and an XML parser read the same way,
 * so the string drops into a page or an XHTML document alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MathNode } from "./tree.js";

/**
 * @param node - The tree to write
 * @returns Its markup, with every text and attribute value escaped
 */
export function serialize(node: MathNode): string {
	if (node.type === "text") return escapeText(node.value);

	let attributes = Object.entries(node.attributes)
		.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`)
		.join("");
	let children = node.children.map(serialize).join("");
	return `<${node.name}${attributes}>${children}</${node.name}>`;
}

/**
 * @param value - Text to place between tags
 * @returns The text with markup characters escaped
 */
export function escapeText(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Text escaping plus the quote that would end a double-quoted attribute. */
function escapeAttribute(value: string): string {
	return escapeText(value).replaceAll('"', "&quot;");
}
