/**
 * The border and rounding a bordered, framed panel applies to its own host
 * element — the outer frame a scrollable region, a hierarchical tree, an
 * expand/collapse section, or a row list draws itself as, before any of its
 * own padding, layout, or interaction styling layers on top.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { combine } from "@sdxc/u/general";

import type { CSSStyles } from "../utils/css-styles";

/**
 * A framed panel's shared border and rounding: a solid, 1px neutral border
 * with large rounding, sized through the shared radius and border variables.
 * Compose it in a host's `mix` array alongside that host's own local styles.
 *
 * @returns A mixin ready for a host element's `mix` prop.
 * @example
 * <div
 * 	mix={[
 * 		panelChrome(),
 * 		css({
 * 			paddingBlock: "0.5rem",
 * 			paddingInline: "0.5rem",
 * 			outline: "none",
 * 		}),
 * 	]}
 * >
 * 	{children}
 * </div>;
 */
export function panelChrome<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([rounded("lg"), border({ color: "neutral", width: 1 })]);
}
