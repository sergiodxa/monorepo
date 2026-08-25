/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Sets the SVG `fill-opacity` paint property. A bare number is read as a 0-100
 * integer, matching `u.opacity()`. The ratio is stringified because the
 * serializer appends `px`, and `fill-opacity: 0.5px` is dropped as invalid.
 *
 * @example u.fillOpacity(50)
 * @example css({ fillOpacity: "0.5" })
 * @example u.fillOpacity("var(--chart-fill-opacity)")
 * @example css({ fillOpacity: "var(--chart-fill-opacity)" })
 */
export function fillOpacity<Node extends Element = Element>(
	value: number | (string & {}),
): UtilityMixin<Node> {
	return utility<Node>(
		() =>
			({
				fillOpacity: typeof value === "number" ? String(value / 100) : value,
			}) as CSSStyles,
	);
}
