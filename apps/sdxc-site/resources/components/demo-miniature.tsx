/**
 * The frame a demo's gallery card draws its miniature in: the demo's own palettes, faces and
 * radii scoped to a fixed-height stage, hidden from assistive tech, so a card shows the art
 * direction at a glance while the card's link carries its name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";

import type { DemoPalette } from "~/resources/components/demo-theme";

import { demoThemeTokens } from "~/resources/components/demo-theme";

namespace DemoMiniature {
	export interface Props extends DemoPalette {
		/** The scene, drawn at the stage's size with the demo's tokens in scope. */
		children: RemixNode;
	}
}

/**
 * Renders one demo's miniature stage. Every stage is the same height, so cards in a row
 * line up whatever scene they hold.
 */
export default function DemoMiniature(handle: Handle<DemoMiniature.Props>) {
	return () => {
		let { children, ...theme } = handle.props;
		return (
			<div
				aria-hidden="true"
				data-slot="demo-miniature"
				mix={[
					themeScope(),
					raw({
						...demoThemeTokens(theme),
						position: "relative",
						overflow: "hidden",
						blockSize: "11rem",
						borderRadius: "0.75rem",
						backgroundColor: "var(--ui-bg)",
						color: "var(--ui-neutral-fg-emphasis)",
						fontFamily: "var(--ui-font-sans)",
						fontSize: "11px",
						lineHeight: "1.3",
						boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
					}),
				]}
			>
				{children}
			</div>
		);
	};
}
