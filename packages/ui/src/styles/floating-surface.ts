/**
 * The border, rounding, tint, and elevation shadow a floating surface — an
 * anchored popover, a hover-revealed card, a multi-item navigation panel, or
 * a searchable command list — carries on its own host element, ahead of
 * whatever placement, motion, and content styling that surface layers on
 * top.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Composes the shared floating-surface border, tint, and elevation shadow as
 * a `css()` mixin. The shadow keeps a literal fallback shaped like `@sdxc/u`'s
 * `lg` step, under the `--ui-shadow-md` variable name.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div
 * 	popover="auto"
 * 	mix={[
 * 		floatingSurface(),
 * 		css({ margin: "0", inset: "auto" }),
 * 	]}
 * >
 * 	{content}
 * </div>;
 */
export function floatingSurface<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return combine<Node>([
		rounded("lg"),
		border({ color: "neutral", width: 1 }),
		bg("neutral.tint"),
		raw({
			boxShadow:
				"var(--ui-shadow-md, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
		}),
	]);
}
