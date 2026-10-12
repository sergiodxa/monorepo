/**
 * Normalizes CMS note and TIL form submissions so the controllers receive validated input;
 * whether the content fits X is checked after parsing, against the text that would be posted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, optional, string } from "remix/data-schema";

/** A note is its content and an optional publish date; its slug comes from that date. */
export const NoteSchema = object({
	content: defaulted(string(), ""),
	published_at: optional(string()),
});

/** A TIL always carries a title and content, so a draft saves from a partially filled form. */
export const TilSchema = object({
	title: defaulted(string(), "Untitled TIL"),
	slug: optional(string()),
	tags: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});
