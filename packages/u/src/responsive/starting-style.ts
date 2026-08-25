/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { compose, nest } from "../internal/descriptor";

/**
 * Wraps utilities in `@starting-style`, defining the values a transition
 * animates from — for entry fade/scale-ins on dialogs, tooltips, popovers,
 * and other elements starting `display: none` or in the top layer.
 *
 * @example u.startingStyle(u.opacity(0))
 * @example css({ "@starting-style": { opacity: "0" } })
 */
export function startingStyle<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return compose(input, (styles) => nest("@starting-style", styles));
}
