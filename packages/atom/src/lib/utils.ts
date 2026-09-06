/**
 * Shared helpers for reading XML elements, splitting qualified names, and
 * normalizing the package's scalar-or-array data shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

/**
 * Returns the direct child elements of an XML element.
 *
 * @param element - The element whose child elements should be returned
 * @returns The direct child elements in source order
 */
export function getChildElements(element: XML.Element): XML.Element[] {
	let children: XML.Element[] = [];
	for (let child of element.children ?? []) {
		if (typeof child === "string") continue;
		children.push(child);
	}
	return children;
}

/**
 * Reads the concatenated text content of one XML element.
 *
 * @param element - The element whose text content should be collected
 * @returns The concatenated text content
 */
export function getElementText(element: XML.Element): string {
	let content = "";
	for (let child of element.children ?? []) {
		if (typeof child !== "string") continue;
		content += child;
	}
	return content;
}

/**
 * Splits the prefix off a qualified name.
 *
 * @param name - The qualified element or attribute name
 * @returns The prefix, or an empty string for an unprefixed name
 */
export function prefixOf(name: string): string {
	let separator = name.indexOf(":");
	if (separator === -1) return "";
	return name.slice(0, separator);
}

/**
 * Strips the prefix from a qualified name, which is how this package compares
 * element names: the XML layer resolves no namespaces, so the prefix a document
 * binds Atom to carries no meaning on its own.
 *
 * @param name - The qualified element or attribute name
 * @returns The name without its prefix
 */
export function localName(name: string): string {
	let separator = name.indexOf(":");
	if (separator === -1) return name;
	return name.slice(separator + 1);
}

/**
 * Parses one optional numeric text value.
 *
 * @param value - The raw string to parse
 * @returns The parsed number or `NaN`
 */
export function parseOptionalNumber(value: string): number {
	let number = Number(value);
	if (Number.isFinite(number)) return number;
	return Number.NaN;
}

/**
 * Collapses one-item arrays back to the package's scalar-friendly API shape.
 *
 * @param values - The values to collapse
 * @returns One value or the full array
 */
export function collapseArray<T>(values: T[]): T | T[] {
	if (values.length === 1) return values[0] as T;
	return values;
}

/**
 * Normalizes undefined, scalar, and array values into a flat array.
 *
 * @param value - The value to normalize
 * @returns A flat array representation
 */
export function normalizeArray<T>(value?: T | T[]): T[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) return value;
	return [value];
}
