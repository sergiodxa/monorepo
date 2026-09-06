/**
 * Converts between XML elements and the package's extension element shape, so a
 * foreign module the parser does not model survives a read and a write unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

import type { Atom } from "../index.js";

import { cloneAttributes } from "./clone.js";

/**
 * Converts one XML element into the package extension element shape.
 *
 * @param element - The XML element to convert
 * @returns The package extension element
 */
export function toExtensionElement(element: XML.Element): Atom.Element {
	let children: Atom.Node[] = [];
	for (let child of element.children ?? []) {
		if (typeof child === "string") {
			children.push(child);
			continue;
		}
		children.push(toExtensionElement(child));
	}

	return { name: element.name, attributes: cloneAttributes(element.attributes), children };
}

/**
 * Converts one package extension element into the XML element shape.
 *
 * @param element - The extension element to convert
 * @returns The XML element representation
 */
export function toXMLElement(element: Atom.Element): XML.Element {
	let children: XML.Node[] = [];
	for (let child of element.children ?? []) {
		if (typeof child === "string") {
			children.push(child);
			continue;
		}
		children.push(toXMLElement(child));
	}

	return { name: element.name, attributes: cloneAttributes(element.attributes) ?? {}, children };
}
