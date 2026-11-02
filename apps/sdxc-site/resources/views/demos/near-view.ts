/**
 * Lets a demo landing's below-the-fold section skip style, layout and paint until it nears
 * the viewport, holding a measured placeholder height so the scrollbar stays put. The
 * browser remembers each section's real size once it has rendered it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combine } from "@sdxc/u/general";
import { virtualize } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";

/** Viewports up to this width take a section's phone placeholder height. */
const PHONE_QUERY = "(max-width: 40rem)";

/**
 * Renders a section only near the viewport. Heights are the section's content box (its
 * rendered block size less padding and borders) measured at 1440px and 375px wide; both
 * declarations share one class so the phone height wins wherever the query matches.
 *
 * @param desktop Content-box height in pixels at a 1440px viewport.
 * @param phone Content-box height in pixels at a 375px viewport, when it differs a lot.
 * @returns One mixin for the section's `mix`.
 * @example <FeatureBand id="learn" mix={[renderNearView(570, 1300)]} />
 */
export function renderNearView(desktop: number, phone?: number) {
	return combine([
		virtualize(`auto ${desktop}px`),
		phone === undefined ? [] : media(PHONE_QUERY, virtualize(`auto ${phone}px`)),
	]);
}
