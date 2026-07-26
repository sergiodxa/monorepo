/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/**
 * Sets only `outline-width`, leaving `outline-color`/`outline-style`
 * untouched. A bare number is treated as pixels; a string passes through
 * unchanged. Use this over `u.outline()` when a state needs to override just
 * the width without forcing a color/style that wasn't already set.
 *
 * @example u.outlineWidth(4)
 * @example css({ outlineWidth: "4px" })
 * @example u.outlineWidth("0.25rem")
 * @example css({ outlineWidth: "0.25rem" })
 */
export function outlineWidth<Node extends Element = Element>(
	value: number | (string & {}),
): UtilityMixin<Node> {
	return utility<Node>(
		() =>
			({
				outlineWidth: typeof value === "number" ? `${value}px` : value,
			}) as CSSStyles,
	);
}
