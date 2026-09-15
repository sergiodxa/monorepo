/**
 * Readers that take an arbitrary JSON value and hand back a usable one, applied
 * wherever the parser touches a document, so a feed carrying `null`, a number
 * where a string belongs, or a stray `[]` reads as if the field were absent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONFeed } from "../index.js";

/** Matches an extension name: an underscore followed by a letter (JSON Feed 1.1). */
const EXTENSION_PATTERN = /^_[A-Za-z]/;

/**
 * Narrows a JSON value to a plain object, which is what every reader below walks.
 *
 * @param value - The value to test
 * @returns `true` when the value is a non-null object that is not an array
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Reports whether a key names a publisher extension rather than a defined field.
 *
 * @param key - The key to test
 * @returns `true` when the key is an extension name
 */
export function isExtensionKey(key: string): key is JSONFeed.ExtensionKey {
	return EXTENSION_PATTERN.test(key);
}

/**
 * Reads a non-empty string.
 *
 * @param value - The value to read
 * @returns The string, or `undefined` when there is none to read
 */
export function readString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	return value || undefined;
}

/**
 * Reads a finite number, accepting the numeric string a publisher may write for
 * a size or a duration, since a reader can use one as readily as the other.
 *
 * @param value - The value to read
 * @returns The number, or `undefined` when there is none to read
 */
export function readNumber(value: unknown): number | undefined {
	if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
	if (typeof value !== "string" || value.trim() === "") return undefined;

	let number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}

/**
 * Reads a boolean.
 *
 * @param value - The value to read
 * @returns The boolean, or `undefined` when the value is not one
 */
export function readBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

/**
 * Reads a list of non-empty strings, which is the shape an item's tags take.
 *
 * @param value - The value to read
 * @returns The strings, or `undefined` when the list holds none
 */
export function readStringArray(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;

	let strings: string[] = [];
	for (let entry of value) {
		let string = readString(entry);
		if (string) strings.push(string);
	}

	return strings.length > 0 ? strings : undefined;
}

/**
 * Reads an item's identity, coercing the number a publisher may write, as JSON
 * Feed 1.1 instructs a reader to do.
 *
 * @param value - The value to read
 * @returns The id, or `undefined` when the item carries none
 */
export function readId(value: unknown): string | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return readString(value);
}

/**
 * Reads the extensions an object carries as entries ready to copy onto another,
 * keeping each leading underscore so a custom object round-trips unchanged.
 *
 * @param source - The feed, item, or raw document to read
 * @returns The extension entries, in the order the document wrote them
 */
export function extensionsOf(source: object): [JSONFeed.ExtensionKey, unknown][] {
	let extensions: [JSONFeed.ExtensionKey, unknown][] = [];

	for (let [key, value] of Object.entries(source)) {
		if (isExtensionKey(key)) extensions.push([key, value]);
	}

	return extensions;
}
