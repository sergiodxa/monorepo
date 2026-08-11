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
 * The converted ratio is stringified rather than left a number: the CSS
 * serializer appends `px` to any unitless number whose property isn't on its
 * unitless allow-list, and `fill-opacity` isn't on it (`opacity` is, which is
 * why `u.opacity()` can hand over a bare number and this can't).
 * `fill-opacity: 0.5px` is invalid and gets dropped, leaving the shape fully
 * opaque. Do not "simplify" the `String()` away.
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
