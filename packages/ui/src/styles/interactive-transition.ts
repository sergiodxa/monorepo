/**
 * The `interactiveTransition()` style-mixin factory: the shared
 * `transition-property`/`transition-timing-function`/`transition-duration`
 * triplet composed into an interactive control's `mix` array, animating a
 * hover, focus, press, selection, or validity change instead of snapping
 * between states, sourced from the animation layer's shared tokens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/ui";

import { transition } from "@sdxc/u/effects";

import type { CSSStyles } from "../utils/css-styles.js";

import { durations, easings } from "../animations/tokens.js";

/**
 * Composes the transition-property/timing-function/duration triplet shared
 * by every interactive control's hover, focus, press, selection, and
 * validity-state changes, for use alongside a host's own `css()` styling.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <input
 * 	mix={[
 * 		interactiveTransition(),
 * 		css({
 * 			borderColor: "var(--ui-neutral-border)",
 * 			"&:hover": { borderColor: "var(--ui-neutral-border-strong)" },
 * 		}),
 * 	]}
 * />;
 */
export function interactiveTransition<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	return transition<Node>(
		"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
		{ duration: durations.fast, easing: easings.standard },
	);
}
