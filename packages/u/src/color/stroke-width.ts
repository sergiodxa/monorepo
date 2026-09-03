/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

/**
 * Sets `stroke-width` on an SVG shape. A bare number stays a unitless SVG
 * user-unit value, so the stroke scales with the SVG's own coordinate
 * system; a string passes through for a value that needs an explicit unit.
 *
 * @example u.strokeWidth(2)
 * @example css({ strokeWidth: "2" })
 * @example u.strokeWidth("0.5%")
 * @example css({ strokeWidth: "0.5%" })
 */
export function strokeWidth<Node extends Element = Element>(
	value: number | (string & {}),
): UtilityMixin<Node> {
	return utility<Node>(
		() =>
			({
				strokeWidth: typeof value === "number" ? String(value) : value,
			}) as CSSStyles,
	);
}
