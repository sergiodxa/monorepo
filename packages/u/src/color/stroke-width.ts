/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Sets `stroke-width`, the SVG paint property controlling how thick a
 * `<path>`/`<circle>`/`<line>` shape's stroke renders. Unlike
 * `u.outlineWidth()`, a bare number is treated as a unitless SVG user-unit
 * value rather than pixels — SVG's `stroke-width` is unitless by default,
 * and stamping a `px` suffix on it would make the value scale with the
 * viewport instead of the SVG's own coordinate system; a string passes
 * through unchanged for a value that does need an explicit unit.
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
