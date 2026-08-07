/**
 * Turns an email body tree into the two parts a message carries. One authored
 * tree produces both the HTML part and the plain-text alternative derived from
 * it, so a text part is never a separate piece of copy that can drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixElement } from "remix/ui";

import { renderToString } from "remix/ui/server";

import { htmlToText } from "./lib/html-to-text";

/**
 * The document type every mail client is calibrated against.
 *
 * XHTML 1.0 Transitional rather than HTML5, because the renderers that read a
 * doctype at all are the old ones, and this is the one they were built for:
 * Outlook hands the document to Word, which drops into a quirks mode that
 * collapses table cell heights when the declaration is missing or unfamiliar.
 * Clients that ignore it are unaffected either way.
 */
const DOCTYPE =
	'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

/** The two body parts produced from a single email tree. */
export interface RenderedEmail {
	/** Serialized HTML of the tree. */
	html: string;
	/** Plain-text alternative derived from that same HTML. */
	text: string;
}

/**
 * Renders an email body tree to both body parts.
 *
 * The text part is derived from the serialized HTML rather than authored twice,
 * which keeps link targets and structure but is heuristic: when the derived
 * version is not good enough, set `text` explicitly on the message instead.
 *
 * A whole document is given a doctype; a fragment is left alone, so rendering one
 * component on its own still returns just that component.
 *
 * @param element - The body tree to render.
 * @returns The HTML part and the plain-text alternative derived from it.
 * @example let { html, text } = await render(<InviteBody url={url} />);
 */
export async function render(element: RemixElement): Promise<RenderedEmail> {
	let html = await renderToString(element);
	if (html.startsWith("<html")) html = `${DOCTYPE}${html}`;
	return { html, text: htmlToText(html) };
}
