/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";

import { utility } from "../internal/descriptor";

export interface TransitionOptions {
	/** Sets `transition-duration`. A bare number is treated as milliseconds; a string passes through unchanged. Defaults to `150ms`. */
	duration?: number | (string & {});
	/** Sets `transition-timing-function`. Defaults to the standard ease-in-out curve (`cubic-bezier(0.4, 0, 0.2, 1)`). */
	easing?: string;
}

/**
 * Applies the `transition-property`/`transition-timing-function`/
 * `transition-duration` triplet for the given CSS property list — the
 * shared pattern behind most hover/focus/press/selection state changes,
 * so a call site only has to name which properties animate.
 *
 * @example u.transition("color, background-color")
 * @example css({ transitionProperty: "color, background-color", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" })
 * @example u.transition("transform", { duration: 200 })
 * @example css({ transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "200ms" })
 */
export function transition<Node extends Element = Element>(
	properties: string,
	options: TransitionOptions = {},
) {
	return utility<Node>(
		() =>
			({
				transitionProperty: properties,
				transitionTimingFunction: options.easing ?? "cubic-bezier(0.4, 0, 0.2, 1)",
				transitionDuration:
					typeof options.duration === "number"
						? `${options.duration}ms`
						: (options.duration ?? "150ms"),
			}) as CSSStyles,
	);
}
