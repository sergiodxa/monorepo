/**
 * Margin's desk: the inks that change with the colour scheme (highlighter, red pen, rules),
 * flat paper surfaces with a soft lift, and the anchor offset that keeps a linked line or
 * section clear of the sticky header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

namespace MarginPaper {
	/** The page between the theme and its bands. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * Renders a box-less wrapper, so the theme's column still lays out header, bands and
 * footer. The highlighter stays a bright yellow in dark under ink that stays dark, as a
 * real marker would on a page read under a lamp; the rules drop to a faint white.
 *
 * @param handle Runtime handle carrying the page.
 * @returns The render function producing the wrapper.
 */
export default function MarginPaper(handle: Handle<MarginPaper.Props>) {
	return () => (
		<div
			data-slot="margin-paper"
			mix={[
				raw({
					display: "contents",
					"--margin-highlighter": "oklch(0.93 0.15 102)",
					"--margin-highlighter-ink": "oklch(0.22 0.02 75)",
					"--margin-red-pen": "oklch(0.55 0.17 27)",
					"--margin-rule": "color-mix(in oklch, var(--ui-color-brand-500) 16%, transparent)",
					"--ui-landing-hairline":
						"color-mix(in oklch, var(--ui-neutral-fg-emphasis) 13%, transparent)",
					"--ui-surface-raised": "var(--ui-color-neutral-50)",
					"--ui-shadow-surface":
						"0 0 0 1px var(--ui-landing-hairline), 0 1px 1px oklch(0.4 0.03 70 / 0.06), 0 14px 28px -18px oklch(0.4 0.05 70 / 0.35)",
				}),
				dark(
					raw({
						"--margin-highlighter": "oklch(0.86 0.15 100)",
						"--margin-highlighter-ink": "oklch(0.2 0.02 75)",
						"--margin-red-pen": "oklch(0.72 0.14 27)",
						"--margin-rule": "color-mix(in oklch, white 7%, transparent)",
						"--ui-landing-hairline": "color-mix(in oklch, white 12%, transparent)",
						"--ui-surface-raised": "var(--ui-color-neutral-900)",
						"--ui-shadow-surface":
							"0 0 0 1px var(--ui-landing-hairline), 0 18px 32px -20px oklch(0 0 0 / 0.6)",
					}),
				),
				when("& [id]", raw({ scrollMarginBlockStart: "5.5rem" })),
			]}
		>
			{handle.props.children}
		</div>
	);
}
