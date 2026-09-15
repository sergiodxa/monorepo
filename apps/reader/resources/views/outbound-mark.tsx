/**
 * The mark a link wears when following it leaves the app for a tab of its own. A feed's
 * name and a post's title both carry one, so the same glyph says the same thing wherever
 * a reader meets it.
 *
 * It is drawn on the 24-unit grid at the stroke the component library's own icons use, so
 * it sits with them rather than beside them, and it is decorative: the link it follows is
 * already named, and a second reading of the same thing is noise to a screen reader.
 *
 * It inherits the color of the text it follows, so it dims with whatever dims that text,
 * and it lays out as a character on that text's line rather than as a box of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

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
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			width={SIZE}
			height={SIZE}
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			mix={[inlineBlock(), shrink(), verticalAlign(BASELINE_DROP), handle.props.mix]}
		>
			<path d="M13 5h6v6" />
			<path d="M19 5 10 14" />
			<path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
		</svg>
	);
}
