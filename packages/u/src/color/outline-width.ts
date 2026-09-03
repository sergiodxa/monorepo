/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

/**
 * Sets `outline-width` alone, so a state can override the width while the
 * color and style already in effect stay in force. A bare number is treated
 * as pixels; a string passes through unchanged.
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
