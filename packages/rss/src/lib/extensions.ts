/**
 * Converts between XML elements and the package's extension element shape.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { XML } from "@pkg/xml";

import type { RSS } from "../index";

import { cloneAttributes } from "./clone";

/**
 * Converts one XML element into the package extension element shape.
 *
 * @param element - The XML element to convert
 * @returns The package extension element
 */
export function toExtensionElement(element: XML.Element): RSS.Element {
	let children: RSS.Node[] = [];
	for (let child of element.children ?? []) {
		if (typeof child === "string") {
			children.push(child);
			continue;
		}
		children.push(toExtensionElement(child));
	}

	return {
		name: element.name,
		attributes: cloneAttributes(element.attributes),
		children,
	};
}

/**
 * Converts one package extension element into the XML element shape.
 *
 * @param element - The extension element to convert
 * @returns The XML element representation
 */
export function toXMLElement(element: RSS.Element): XML.Element {
	let children: XML.Node[] = [];
	for (let child of element.children ?? []) {
		if (typeof child === "string") {
			children.push(child);
			continue;
		}
		children.push(toXMLElement(child));
	}

	return {
		name: element.name,
		attributes: cloneAttributes(element.attributes) ?? {},
		children,
	};
}
