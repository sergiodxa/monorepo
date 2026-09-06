/**
 * Small shared helpers: qualified-name handling, namespace reading, URL
 * resolution, and the deduplication every normalized item list goes through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { XML } from "@sdxc/xml";

/**
 * Strips the prefix from a qualified name, so a document that binds a format to
 * a prefix is recognized by the same comparison as one that does not.
 *
 * @param name - The qualified element name
 * @returns The name without its prefix
 */
export function localName(name: string): string {
	let separator = name.indexOf(":");
	if (separator === -1) return name;
	return name.slice(separator + 1);
}

/**
 * Reads the namespace declarations an element carries, keyed by prefix with the
 * empty string for the default.
 *
 * @param element - The element whose declarations should be read
 * @returns The declared namespaces
 */
export function readNamespaces(element: XML.Element): Record<string, string> {
	let namespaces: Record<string, string> = {};

	for (let [name, value] of Object.entries(element.attributes ?? {})) {
		if (name === "xmlns") {
			namespaces[""] = value;
			continue;
		}
		if (name.startsWith("xmlns:")) namespaces[name.slice("xmlns:".length)] = value;
	}

	return namespaces;
}

/**
 * Resolves a possibly-relative URL against the document's own.
 *
 * An unusable pair yields the original text, because a feed's own value tells a
 * consumer more than a link this package invented or dropped.
 *
 * @param value - The URL to resolve
 * @param base - The document URL to resolve against
 * @returns The absolute URL, or the original when it cannot be resolved
 */
export function resolveUrl(value: string | undefined, base?: string): string | undefined {
	if (!value) return undefined;
	if (!base) return value;

	try {
		return new URL(value, base).toString();
	} catch {
		return value;
	}
}

/**
 * Reports whether a string parses as an absolute URL, which is what decides
 * whether an identifier doubles as a link.
 *
 * @param value - The string to test
 * @returns `true` when the value is an absolute URL
 */
export function isAbsoluteUrl(value: string | undefined): boolean {
	if (!value) return false;
	try {
		return Boolean(new URL(value));
	} catch {
		return false;
	}
}

/**
 * Drops repeats, keeping the first of each, which matches how a feed reader
 * treats a document that lists the same post twice.
 *
 * @param values - The values to filter
 * @param key - Reads the identity each value is compared on
 * @returns The values with later repeats removed
 */
export function dedupeBy<T>(values: T[], key: (value: T) => string): T[] {
	let seen = new Set<string>();
	let unique: T[] = [];

	for (let value of values) {
		let identity = key(value);
		if (seen.has(identity)) continue;
		seen.add(identity);
		unique.push(value);
	}

	return unique;
}

/** Returns the first value that is a non-empty string. */
export function firstText(...values: (string | undefined)[]): string | undefined {
	for (let value of values) {
		if (value) return value;
	}
	return undefined;
}
