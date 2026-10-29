/**
 * One horizontal band of the landing page, drawn inside the page's frame: a rule across
 * the full width on top, dashed rails down both sides of the content column, and a small
 * marker where they meet. Thin adapter over {@link MarketingSection} so markdown tags and
 * page layouts keep a stable `Band` name while sharing marketing tokens with other apps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { text } from "@sdxc/u/typography";
import { MarketingSection } from "@sdxc/ui";

namespace Band {
	/** What sits behind the band: nothing, a brand glow from one corner, or a faded grid. */
	export type Tone = "plain" | "tinted" | "grid";

	/**
	 * How much room the band leaves around its content. `"none"` zeroes block padding for
	 * strips (stats) that carry their own cell padding; `"normal"` and `"hero"` map onto
	 * the shared marketing section-space steps.
	 */
	export type Spacing = "none" | "normal" | "hero";

	export interface Props {
		id?: string;
		tone?: Tone;
		/** Centers the content, for a band that carries one statement rather than a layout. */
		align?: "start" | "center";
		/** Draws the rule and its markers on top; the first band sits under the site bar instead. */
		ruled?: boolean;
		spacing?: Spacing;
		children: RemixNode;
	}
}

/** Renders one band of the frame around its content. */
export default function Band(handle: Handle<Band.Props>) {
	return () => {
		let {
			align = "start",
			children,
			id,
			ruled = true,
			spacing = "normal",
			tone = "plain",
		} = handle.props;
		let sectionSpacing: MarketingSection.Spacing = "normal";
		let isFlush = false;

		if (spacing === "none") {
			sectionSpacing = "compact";
			isFlush = true;
		} else if (spacing === "hero") {
			sectionSpacing = "hero";
		}

		return (
			<MarketingSection
				id={id}
				tone={tone}
				align={align}
				ruled={ruled}
				variant="frame"
				spacing={sectionSpacing}
				mix={[isFlush ? raw({ paddingBlock: "0" }) : [], text("base")]}
			>
				{children}
			</MarketingSection>
		);
	};
}
