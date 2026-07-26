/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Sets `fill-opacity`, the SVG paint property controlling a
 * `<path>`/`<circle>`/`<line>` shape's fill transparency independently of
 * `stroke-opacity`/`opacity`. A bare number is read as a 0-100 integer,
 * matching `u.opacity()`'s convention rather than the CSS property's own 0-1
 * range; a string passes through unchanged.
 *
 * @example u.fillOpacity(50)
 * @example css({ fillOpacity: 0.5 })
 * @example u.fillOpacity("var(--chart-fill-opacity)")
 * @example css({ fillOpacity: "var(--chart-fill-opacity)" })
 */
export function fillOpacity<Node extends Element = Element>(
	value: number | (string & {}),
): UtilityMixin<Node> {
	return utility<Node>(
		() =>
			({
				fillOpacity: typeof value === "number" ? value / 100 : value,
			}) as CSSStyles,
	);
}
