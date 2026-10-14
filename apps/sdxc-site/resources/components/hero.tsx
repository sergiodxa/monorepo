/**
 * The `hero` tag: the band the page opens on, set over a faded grid and drawn directly
 * under the site bar, so it carries no rule of its own. Its headings are set at display
 * size; what it holds and how it is laid out come from the content file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import Band from "~/resources/components/band";
import { DisplayHeadings } from "~/resources/components/prose";

/** Renders the opening band. */
export default function Hero(handle: Handle<MarkdownProps>) {
	return () => (
		<Band tone="grid" spacing="hero" ruled={false}>
			<DisplayHeadings>{handle.props.children}</DisplayHeadings>
		</Band>
	);
}
