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

import { border } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { combine } from "@pkg/u/general";

import type { CSSStyles } from "../utils/css-styles";

/**
 * A framed panel's shared border and rounding: a solid, 1px neutral border
 * with large rounding, sized and colored through the shared radius and
 * neutral border variables rather than a hardcoded value. Compose the call
 * directly in a host's `mix` array, at the top level alongside whatever
 * padding, outline, container, or `&::details-content` declarations are
 * genuinely local to that host, rather than folding its properties into
 * another `css()` call.
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
