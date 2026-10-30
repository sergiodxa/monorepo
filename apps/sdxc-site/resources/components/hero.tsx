/**
 * The `hero` tag: the band the page opens on, set over a faded grid and drawn directly
 * under the site bar, so it carries no rule of its own. Its headings are set at display
 * size; what it holds and how it is laid out come from the content file. Keeps free-form
 * markdown children (rather than {@link LandingHero}'s structured slots) so home.md stays
 * unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import Band from "~/resources/components/band";
import { DisplayHeadings } from "~/resources/components/prose";

/**
 * The headline size beside the terminal: one step under the full display, since the copy
 * shares the row, from 40px on a phone to 64px wide.
 */
const HERO_DISPLAY_SIZE = "clamp(2.5rem, 1.6rem + 3cqi, 4rem)";

/** Renders the opening band. */
export default function Hero(handle: Handle<MarkdownProps>) {
	return () => (
		<Band tone="grid" spacing="hero" ruled={false}>
			<div mix={[raw({ "--ui-marketing-display-size": HERO_DISPLAY_SIZE })]}>
				<DisplayHeadings>{handle.props.children}</DisplayHeadings>
			</div>
		</Band>
	);
}
