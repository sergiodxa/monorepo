/**
 * HTML miniature for one `@sdxc/ui` explorer tile — the same DemoMiniature stage language
 * as `/demo`, with a per-slug scene so the gallery shows the pattern rather than a PNG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import { faceKindFor } from "~/resources/components/ui-faces/kinds";
import { renderFaceScene } from "~/resources/components/ui-faces/scenes";

namespace UiComponentMiniature {
	export interface Props {
		/** Catalogue slug whose face kind selects the scene. */
		slug: string;
	}
}

/**
 * Renders one component's miniature stage. Hidden from assistive tech — the card link
 * already names the component — and sized to the explorer tile's preview plane.
 */
export default function UiComponentMiniature(handle: Handle<UiComponentMiniature.Props>) {
	return () => {
		let kind = faceKindFor(handle.props.slug);
		return (
			<div
				aria-hidden="true"
				data-slot="ui-component-miniature"
				data-face-kind={kind}
				mix={[
					raw({
						position: "relative",
						overflow: "hidden",
						blockSize: "100%",
						minBlockSize: "100%",
						backgroundColor: "var(--ui-bg)",
						color: "var(--ui-neutral-fg-emphasis)",
						fontFamily: "var(--ui-font-sans)",
						fontSize: "11px",
						lineHeight: "1.3",
						contentVisibility: "auto",
						containIntrinsicSize: "auto 9.5rem",
					}),
				]}
			>
				{renderFaceScene(kind)}
			</div>
		);
	};
}
