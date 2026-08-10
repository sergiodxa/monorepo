/**
 * The `interactiveTransition()` style-mixin factory: the shared
 * `transition-property`/`transition-timing-function`/`transition-duration`
 * triplet composed into an interactive control's `mix` array, so a hover,
 * focus, press, selection, or validity change animates smoothly instead of
 * snapping between states. Every field is sourced from the animation layer's
 * shared duration and easing tokens instead of restating the same literal
 * values at each call site that needs them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/ui";

import { transition } from "@pkg/u/effects";

import type { CSSStyles } from "../utils/css-styles";

import { durations, easings } from "../animations/tokens";

/**
 * Composes the `transition-property`/`transition-timing-function`/
 * `transition-duration` triplet shared by every interactive control in the
 * catalog — a text field, a button, a link, and every menu/listbox/table/
 * tree row or cell that changes color, background, border, shadow, or
 * transform on hover, focus, press, selection, or validity. Covers the
 * properties those state changes touch: color and background layers, the
 * outline and box-shadow a focus ring draws, a transform a pressed or
 * expanded state offsets, and the filter/backdrop-filter pair a few
 * surfaces use for a hover glow or a backdrop-material toggle.
 *
 * Composed in a host's `mix` array alongside a separate `css()` call
 * carrying that host's own color, size, and layout declarations, so the
 * shared fragment and the host's local styling stay as two distinct mixins
 * instead of one merged object.
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
