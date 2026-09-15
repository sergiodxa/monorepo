/**
 * The mark a link wears when following it leaves the app for a tab of its own. A feed's
 * name and a post's title both carry one, so the same glyph says the same thing wherever
 * a reader meets it.
 *
 * The icon set draws it, which is what keeps it on the same grid and stroke as every other
 * glyph on the page. It arrives decorative: the link it follows is already named, and a
 * second reading of the same thing is noise to a screen reader.
 *
 * What this wrapper adds is the layout. The component library lays every `svg` out as a
 * block, so the mark needs saying that it is a character on the line of text it follows,
 * riding far enough below the baseline to sit against that text rather than on top of it.
 * It takes its color from that text too, so it dims with whatever dims the link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { ExternalLinkIcon } from "@sdxc/icons";
import { inlineBlock, shrink } from "@sdxc/u/layout";
import { verticalAlign } from "@sdxc/u/typography";

/** Edge of the mark, sized to sit beside a line of text without crowding it. */
const SIZE = 16;

/**
 * How far the mark rides below the baseline, which is where a glyph of this size sits
 * against text rather than on top of it.
 */
const BASELINE_DROP = "-0.125em";

export namespace OutboundMark {
	export interface Props {
		/** Styling for the mark, layered after its own — the gap it keeps from the text, say. */
		mix?: TagProps<"svg">["mix"];
	}
}

/** Renders the outbound mark, inheriting the color of whatever text it follows. */
export default function OutboundMark(handle: Handle<OutboundMark.Props>) {
	return () => (
		<ExternalLinkIcon
			size={SIZE}
			mix={[inlineBlock(), shrink(), verticalAlign(BASELINE_DROP), handle.props.mix]}
		/>
	);
}
