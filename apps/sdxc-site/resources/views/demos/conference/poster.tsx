/**
 * The sheet the conference page is printed on: a layer of risograph grain over everything
 * below the header, and the sticky header clearing every in-page target, so the page reads as
 * one pulled print rather than a stack of screens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { css } from "remix/component";

import { GRAIN } from "~/resources/views/demos/conference/ink";

namespace ConferencePoster {
	export interface Props {
		children: RemixNode;
	}
}

/**
 * Renders the sheet. The grain is a fixed layer that ignores the pointer, multiplied over
 * paper in light and screened in dark, where a dark speck would vanish; `--op-blend` tells
 * every overprinted shape below which of the two its inks combine by.
 *
 * @param handle Runtime handle carrying the page.
 * @returns The render function producing the sheet.
 */
export default function ConferencePoster(handle: Handle<ConferencePoster.Props>) {
	return () => (
		<div
			data-slot="conference-poster"
			mix={css({
				position: "relative",
				display: "flex",
				flexDirection: "column",
				flex: "1",
				isolation: "isolate",
				"--op-blend": "multiply",
				"& main [id]": { scrollMarginBlockStart: "4.5rem" },
				"&::after": {
					content: '""',
					position: "fixed",
					inset: "0",
					zIndex: "30",
					pointerEvents: "none",
					backgroundImage: GRAIN,
					opacity: "0.2",
					mixBlendMode: "multiply",
				},
				":is(.dark) &": { "--op-blend": "screen" },
				":is(.dark) &::after": { mixBlendMode: "screen", filter: "invert(1)", opacity: "0.16" },
				"@media (prefers-color-scheme: dark)": {
					":is(.system) &": { "--op-blend": "screen" },
					":is(.system) &::after": { mixBlendMode: "screen", filter: "invert(1)", opacity: "0.16" },
				},
				"@media print": { "&::after": { display: "none" } },
			})}
		>
			{handle.props.children}
		</div>
	);
}
