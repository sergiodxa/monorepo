/**
 * Reads the author forms the two formats use: Atom's structured person construct
 * and RSS's RFC 822 mailbox, which packs a display name into a comment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Atom } from "@sdxc/atom";

import type { Feed } from "../index.js";

/** Matches `person@example.com (Display Name)`, the form RFC 822 §6 defines. */
const MAILBOX_PATTERN = /^\s*(\S+@\S+?)\s*\((.+)\)\s*$/;

/**
 * Reads an RSS author value.
 *
 * The mailbox form yields both halves; anything else is taken as a display name,
 * because a feed that writes a bare name there is far more common than one that
 * writes an address a reader would want to mail.
 *
 * @param value - The author text a feed carried
 * @returns The author, or `undefined` when there is nothing to read
 */
export function parseMailbox(value?: string): Feed.Author | undefined {
	if (!value?.trim()) return undefined;

	let match = value.match(MAILBOX_PATTERN);
	if (match?.[1] && match[2]) return { name: match[2].trim(), email: match[1] };

	if (value.includes("@") && !value.includes(" "))
		return { name: value.trim(), email: value.trim() };

	return { name: value.trim() };
}

/**
 * Converts Atom person constructs into the normalized author shape.
 *
 * @param person - One person or several, as the document wrote them
 * @returns The authors, in document order
 */
export function fromPersons(person?: Atom.PersonInput): Feed.Author[] {
	if (person === undefined) return [];

	let persons = Array.isArray(person) ? person : [person];
	let authors: Feed.Author[] = [];

	for (let entry of persons) {
		if (!entry.name && !entry.email) continue;
		let author: Feed.Author = { name: entry.name || (entry.email ?? "") };
		if (entry.uri) author.url = entry.uri;
		if (entry.email) author.email = entry.email;
		authors.push(author);
	}

	return authors;
}
