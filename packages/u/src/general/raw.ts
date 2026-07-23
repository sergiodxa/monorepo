/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Wraps a plain style object as a utility mixin, so an otherwise bespoke,
 * one-off declaration set — a property this package has no dedicated utility
 * for, or a value computed from something this package doesn't model, such
 * as a loop index — can still compose inside `when()`, `combine()`, and every
 * other wrapper utility, which only accept utility mixins as input, never
 * the plain `css()` mixins they're built on top of.
 *
 * @example u.when('&[data-color="1"]', u.raw({ color: "var(--ui-chart-1)" }))
 * @example css({ '&[data-color="1"]': { color: "var(--ui-chart-1)" } })
 */
export function raw<Node extends Element = Element>(styles: CSSStyles): UtilityMixin<Node> {
	return utility<Node>(() => styles);
}
