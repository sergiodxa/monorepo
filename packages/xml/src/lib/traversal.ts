/**
 * Traverses and queries XML element trees by predicate or by `/`-delimited
 * child-name path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "../index";

import { cloneElement } from "./clone-element";

/**
 * Returns the first element matching the predicate in depth-first order.
 *
 * @param element - The root element to traverse
 * @param predicate - The predicate to match against
 * @returns The first matching element, if one exists
 */
export function findInElement(
	element: XML.Element,
	predicate: XML.Predicate,
): XML.Element | undefined {
	if (predicate(element)) return cloneElement(element);

	for (let child of element.children ?? []) {
		if (typeof child === "string") continue;

		let match = findInElement(child, predicate);
		if (match) return match;
	}

	return undefined;
}

/**
 * Collects all elements matching the predicate in depth-first order.
 *
 * @param element - The root element to traverse
 * @param predicate - The predicate to match against
 * @param matches - The array to append matches to
 */
export function collectInElement(
	element: XML.Element,
	predicate: XML.Predicate,
	matches: XML.Element[],
): void {
	if (predicate(element)) matches.push(cloneElement(element));

	for (let child of element.children ?? []) {
		if (typeof child === "string") continue;
		collectInElement(child, predicate, matches);
	}
}

/**
 * Normalizes a `/`-delimited path into non-empty segments.
 *
 * @param path - The raw query path
 * @returns The normalized path segments
 */
export function normalizePath(path: string): string[] {
	return path
		.split("/")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0);
}

/**
 * Checks whether the path is rooted at the provided root element name.
 *
 * @param segments - The normalized path segments
 * @param rootName - The root element name
 * @returns `true` when the first segment matches the root name
 */
export function startsWithRoot(segments: string[], rootName: string): boolean {
	return segments[0] === rootName;
}

/**
 * Traverses the tree by exact child-name matches for each path segment.
 *
 * @param elements - The current set of elements to match from
 * @param segments - The remaining path segments
 * @returns The elements that match the full path
 */
export function queryFromElements(elements: XML.Element[], segments: string[]): XML.Element[] {
	if (segments.length === 0) return elements;

	let [segment, ...rest] = segments;
	let matches: XML.Element[] = [];

	for (let element of elements) {
		for (let child of element.children ?? []) {
			if (typeof child === "string") continue;
			if (child.name !== segment) continue;
			matches.push(child);
		}
	}

	if (rest.length === 0) return matches;
	return queryFromElements(matches, rest);
}
