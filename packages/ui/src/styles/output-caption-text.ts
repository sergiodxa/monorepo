/**
 * The muted caption typography shared by every live readout rendered through
 * a native `<output>` element: a small point size, a matching line height,
 * the neutral muted foreground color, and tabular digits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine } from "@sdxc/u/general";
import { tabularNums, text } from "@sdxc/u/typography";

import type { CSSStyles } from "../utils/css-styles.js";

/**
 * `text("sm")`'s font-size/line-height fallback pair matches the
 * `0.875rem`/`calc(1.25 / 0.875)` caption spec exactly, so composing it
 * directly keeps every `<output>` readout visually identical. Tabular digits
 * hold the readout's width steady while its value changes under a drag.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <output mix={[outputCaptionText(), mix]}>{value}</output>;
 */
export function outputCaptionText<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([text("sm"), fg("neutral"), tabularNums()]);
}
