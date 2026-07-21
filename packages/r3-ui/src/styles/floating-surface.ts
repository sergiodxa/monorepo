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

import { css } from "remix/ui";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Composes the shared floating-surface chrome as its own `css()` mixin: a
 * large, rounded, solid 1px neutral border, a neutral tint background, and
 * an elevation shadow, sized and colored through the shared radius, neutral
 * border, neutral tint, and elevation shadow variables rather than a
 * hardcoded value. Every floating surface composes this alongside its own
 * `css()` call in the same `mix` array, so its placement, motion, and
 * content declarations stay disjoint sibling entries rather than folded
 * into one shared object.
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
	return css<Node>({
		borderRadius: "var(--ui-radius-lg, 0.5rem)",
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "var(--ui-neutral-border)",
		backgroundColor: "var(--ui-neutral-bg-tint)",
		boxShadow:
			"var(--ui-shadow-md, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
	});
}
