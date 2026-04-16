import type { XML } from "@pkg/xml";

import type { RSS } from "../index";

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

/**
 * Normalizes string namespace fields into an array.
 *
 * @param value - The string or string array to normalize
 * @returns A flat array of strings
 */
export function normalizeStringArray(value?: string | string[]): string[] {
	return normalizeArray(value);
}

/**
 * Reads the comparable guid value from either guid representation.
 *
 * @param item - The RSS item to inspect
 * @returns The guid string when present
 */
export function getGuidValue(item: RSS.Item): string | undefined {
	if (typeof item.guid === "string") return item.guid;
	return item.guid?.value;
}

/**
 * Checks whether a record has no enumerable keys.
 *
 * @param record - The record to inspect
 * @returns `true` when the record is missing or empty
 */
export function isEmptyRecord(record?: Record<string, unknown>): boolean {
	if (!record) return true;
	return Object.keys(record).length === 0;
}
