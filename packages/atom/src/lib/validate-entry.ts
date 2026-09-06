/**
 * Guards the three elements RFC 4287 §4.1.2 requires of every entry, so an
 * instance can never hold data that would serialize into an invalid document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Atom } from "../index.js";

import { AtomParseError } from "../index.js";

/**
 * Reads the string behind either text construct form, so a caller testing for
 * presence does not branch on which form the value took.
 *
 * @param text - The construct to read
 * @returns The text, or an empty string when there is none
 */
export function readTextValue(text?: Atom.TextInput): string {
	if (text === undefined) return "";
	return typeof text === "string" ? text : text.value;
}

/**
 * Checks that an entry carries an id, a title and an updated timestamp.
 *
 * @param entry - The entry to check
 * @throws AtomParseError Naming the first required element that is missing
 */
export function validateEntry(entry: Atom.Entry): void {
	if (!entry.id) throw new AtomParseError("Entry must include an id.");
	if (!readTextValue(entry.title)) throw new AtomParseError("Entry must include a title.");
	if (!entry.updated) throw new AtomParseError("Entry must include an updated timestamp.");
}
