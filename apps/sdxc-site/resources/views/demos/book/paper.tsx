/**
 * The book page's sheet: the rules and surfaces that change with the colour scheme, and
 * the anchor offset that keeps a linked section's title clear of the sticky header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

namespace BookPaper {
	/** The page between the theme and its bands. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * Renders a box-less wrapper, so the theme's column still lays out header, bands and footer.
 * Rules are ink or paper at 16%, strong enough to read as print; surfaces stay the paper
 * colour, their edges declared beside the rule colour so both schemes draw this page's rule.
 *
 * @param handle Runtime handle carrying the page.
 * @returns The render function producing the wrapper.
 */
export default function BookPaper(handle: Handle<BookPaper.Props>) {
	return () => (
		<div
			data-slot="book-paper"
			mix={[
				raw({
					display: "contents",
					"--ui-marketing-hairline":
						"color-mix(in oklch, var(--ui-neutral-fg-emphasis) 16%, transparent)",
					"--ui-surface-raised": "var(--ui-bg)",
					"--ui-shadow-surface": "0 0 0 1px var(--ui-marketing-hairline)",
					"--ui-shadow-stage": "0 0 0 1px var(--ui-marketing-hairline)",
				}),
				dark(
					raw({
						"--ui-marketing-hairline": "color-mix(in oklch, white 16%, transparent)",
						"--ui-surface-raised": "var(--ui-bg)",
						"--ui-shadow-surface": "0 0 0 1px var(--ui-marketing-hairline)",
						"--ui-shadow-stage": "0 0 0 1px var(--ui-marketing-hairline)",
					}),
				),
				when("& [id]", raw({ scrollMarginBlockStart: "5rem" })),
			]}
		>
			{handle.props.children}
		</div>
	);
}
