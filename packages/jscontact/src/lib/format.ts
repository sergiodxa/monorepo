/**
 * Tells JSContact, vCard text and jCard apart from the text alone, for input that arrives
 * without a media type: a file, a paste or a pipe. vCard text opens with `BEGIN:VCARD`, a
 * jCard is a `["vcard", …]` array, and any other JSON object is read as a Card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The three ways a contact is written. */
export type ContactFormat = "jscontact" | "vcard" | "jcard";

/** Whether `value` is one jCard document, `["vcard", […]]`. */
function isJCard(value: unknown): boolean {
	return Array.isArray(value) && value[0] === "vcard";
}

/** Whether `value` is a JSON object, the shape every Card has. */
function isObject(value: unknown): boolean {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The format `text` is written in. A JSON array is a jCard when it is one or every element is
 * one, and Cards when every element is an object; an empty array, other JSON and text that is
 * neither JSON nor a vCard answer `null`.
 *
 * @param text - The whole document, a leading byte order mark and whitespace allowed
 * @example detectFormat("BEGIN:VCARD\r\n…"); // "vcard"
 */
export function detectFormat(text: string): ContactFormat | null {
	let trimmed = text.replace(/^﻿/, "").trimStart();
	if (/^BEGIN:VCARD\b/i.test(trimmed)) return "vcard";
	let value: unknown;
	try {
		value = JSON.parse(trimmed);
	} catch {
		return null;
	}
	if (isObject(value)) return "jscontact";
	if (!Array.isArray(value) || value.length === 0) return null;
	if (isJCard(value) || value.every(isJCard)) return "jcard";
	if (value.every(isObject)) return "jscontact";
	return null;
}
