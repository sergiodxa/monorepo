/**
 * The magnifier the search trigger and the search dialog's box lead with, drawn inline at
 * the size of the text beside it and in its color, so it reads as part of the label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { shrink } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

/** Renders the decorative magnifier; the control it sits in carries the accessible name. */
export function SearchGlyph(handle: Handle<{ mix?: TagProps<"svg">["mix"] }>) {
	return () => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			focusable="false"
			mix={[is("1em"), bs("1em"), shrink(0), handle.props.mix]}
		>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.34-4.34" />
		</svg>
	);
}
