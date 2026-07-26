/**
 * The flex-item layout and current-color declarations shared by a leading
 * graphic slot — whichever of an icon or a loading graphic currently
 * occupies that slot — so the two stay laid out identically and a host can
 * swap between them without the rest of its layout shifting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { fg } from "@pkg/u/color";
import { combine } from "@pkg/u/general";
import { shrink } from "@pkg/u/layout";
import { mbs } from "@pkg/u/size";

import type { CSSStyles } from "../utils/css-styles";

/**
 * A shrink-resistant, nudged-down, current-colored mixin for a leading
 * graphic slot: `flexShrink: 0` keeps the slot from collapsing alongside
 * flexible text content beside it, a small block-start margin lines its
 * glyph up with the first line of that text, and `color: currentcolor` picks
 * up whatever foreground color the host already carries.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div data-slot="icon" mix={[graphicHostStyle(), css({ ...ownStyles })]}>
 *   <CircleCheckIcon />
 * </div>;
 */
export function graphicHostStyle<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		shrink(),
		mbs("0.125rem"),
		// `@pkg/u`'s internal token resolver special-cases the `currentcolor`
		// keyword (case-normalized to `currentColor`), so `fg()` covers it.
		fg("currentcolor"),
	]);
}
