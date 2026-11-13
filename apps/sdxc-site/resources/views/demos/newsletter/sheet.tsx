/**
 * Undercurrent's sheet of writing paper: the hairline every rule on the page draws with,
 * flat surfaces in both schemes, and the anchor offset that keeps a linked section's title
 * clear of the sticky header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

namespace NewsletterSheet {
	/** The page between the theme and its bands. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * Renders a box-less wrapper, so the theme's column still lays out header, bands and
 * footer. Body copy takes a long leading here, which is what sets the page as a letter.
 *
 * @param handle Runtime handle carrying the page.
 * @returns The render function producing the wrapper.
 */
export default function NewsletterSheet(handle: Handle<NewsletterSheet.Props>) {
	return () => (
		<div
			data-slot="undercurrent-sheet"
			mix={[
				raw({
					display: "contents",
					"--ui-landing-hairline":
						"color-mix(in oklch, var(--ui-neutral-fg-emphasis) 14%, transparent)",
					"--ui-surface-raised": "var(--ui-bg)",
					"--ui-shadow-surface": "0 0 0 1px var(--ui-landing-hairline)",
					"--ui-shadow-stage": "0 0 0 1px var(--ui-landing-hairline)",
				}),
				dark(
					raw({
						"--ui-landing-hairline": "color-mix(in oklch, white 14%, transparent)",
						"--ui-surface-raised": "var(--ui-bg)",
						"--ui-shadow-surface": "0 0 0 1px var(--ui-landing-hairline)",
						"--ui-shadow-stage": "0 0 0 1px var(--ui-landing-hairline)",
					}),
				),
				when("& [id]", raw({ scrollMarginBlockStart: "5rem" })),
			]}
		>
			{handle.props.children}
		</div>
	);
}
