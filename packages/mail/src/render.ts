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

import { htmlToText } from "./lib/html-to-text.js";

/**
 * The document type every mail client is calibrated against.
 *
 * XHTML 1.0 Transitional, because Outlook renders through Word, which needs
 * this declaration to avoid a quirks mode that collapses table cell heights.
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
 * The text part is parsed from the rendered HTML, keeping link targets and
 * structure in sync; set `text` on the message to override the heuristic.
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
