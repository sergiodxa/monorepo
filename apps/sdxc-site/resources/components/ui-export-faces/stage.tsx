/**
 * Shared stage for `@sdxc/ui` export catalogue tiles: a quiet plane the live
 * animation, style diagram, mixin schematic or behavior graph sits on, so every
 * subpath's faces share one rhythm with the component explorer cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { center, relative } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, minBs, p } from "@sdxc/u/size";

/** Fixed block size of every export preview plane. */
export const EXPORT_PREVIEW_HEIGHT = "8.5rem";

namespace ExportFaceStage {
	export interface Props {
		children: RemixNode;
		/** Stretch content to the stage edges instead of centering a compact demo. */
		fill?: boolean;
	}
}

/** Centers a demo on the export card's preview plane, or fills it edge to edge. */
export default function ExportFaceStage(handle: Handle<ExportFaceStage.Props>) {
	return () => {
		let { children, fill = false } = handle.props;

		return (
			<div
				data-slot="ui-export-miniature"
				mix={[
					relative(),
					minBs(EXPORT_PREVIEW_HEIGHT),
					bs(EXPORT_PREVIEW_HEIGHT),
					overflow("hidden"),
					fill ? [is("100%"), p(0)] : [center(), is("100%"), p(4)],
					raw({
						backgroundColor: "var(--ui-bg)",
						backgroundImage:
							"radial-gradient(ellipse 80% 70% at 50% 0%, color-mix(in oklch, var(--ui-brand-fg, CanvasText) 6%, transparent), transparent 70%)",
						boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline, var(--ui-neutral-border))",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{children}
			</div>
		);
	};
}
