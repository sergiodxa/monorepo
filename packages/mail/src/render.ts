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
 * @param element - The body tree to render.
 * @returns The HTML part and the plain-text alternative derived from it.
 * @example let { html, text } = await render(<InviteBody url={url} />);
 */
export async function render(element: RemixElement): Promise<RenderedEmail> {
	let html = await renderToString(element);
	return { html, text: htmlToText(html) };
}
