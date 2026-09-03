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

import { fg } from "@sdxc/u/color";
import { combine } from "@sdxc/u/general";
import { shrink } from "@sdxc/u/layout";
import { mbs } from "@sdxc/u/size";

import type { CSSStyles } from "../utils/css-styles";

/**
 * A shrink-resistant, nudged-down, current-colored mixin for a leading
 * graphic slot, keeping an icon and a loading graphic laid out identically.
 * `fg("currentcolor")` matches `@sdxc/u`'s case-normalized token lookup.
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
	return combine<Node>([shrink(), mbs("0.125rem"), fg("currentcolor")]);
}
