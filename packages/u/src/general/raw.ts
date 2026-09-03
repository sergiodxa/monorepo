/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

/**
 * Wraps a plain style object as a utility mixin, so bespoke declarations — a
 * property outside this package's surface, or a call-site-computed value —
 * compose inside wrappers like `when()`, whose inputs are utility mixins.
 *
 * @example u.when('&[data-color="1"]', u.raw({ color: "var(--ui-chart-1)" }))
 * @example css({ '&[data-color="1"]': { color: "var(--ui-chart-1)" } })
 */
export function raw<Node extends Element = Element>(styles: CSSStyles): UtilityMixin<Node> {
	return utility<Node>(() => styles);
}
