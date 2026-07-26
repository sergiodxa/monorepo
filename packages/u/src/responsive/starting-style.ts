/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * The `@starting-style` at-rule wrapper, for the before-first-update values a
 * transition animates from — entry fade/scale-ins on elements that start out
 * `display: none` or in the top layer, such as dialogs, tooltips, and
 * popovers. Unlike `u.media()`/`u.at()`/`u.supports()`, `@starting-style`
 * takes no query or condition, so this wrapper takes no argument beyond the
 * wrapped input.
 *
 * @example u.startingStyle(u.opacity(0))
 * @example css({ "@starting-style": { opacity: "0" } })
 */
export function startingStyle<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose(input, (styles) => nest("@starting-style", styles));
}
